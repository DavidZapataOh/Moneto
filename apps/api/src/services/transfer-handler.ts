import { createLogger } from "@moneto/utils";
import { type SupabaseClient } from "@supabase/supabase-js";

import type { Database, IncomingTransferSourceType } from "@moneto/db";

const log = createLogger("transfer.handler");

/**
 * Procesa una transferencia entrante detectada por el Helius webhook.
 *
 * **Idempotency**: el handler INSERTa en `processed_signatures` con `(signature,
 * mint)` como PK. Si la inserción falla por conflict (constraint
 * violation 23505), lo tratamos como "already processed" y skip.
 * Cualquier other error se propaga para que el webhook devuelva 500
 * (Helius reintenta).
 *
 * **Privacy**: NO guardamos amounts en plain text. El monto va al push
 * notification body (texto al user) pero no a logs/audit table.
 *
 * **Side effects** (orden):
 * 1. Insert idempotency lock.
 * 2. Insert audit row en `incoming_transfers`.
 * 3. Send push (best-effort — failures NO bloquean el ack del webhook).
 *
 * Sprint 5+ enchufa Umbra shielding como step 2.5 (post-audit, pre-push).
 */
export interface ProcessTransferInput {
  signature: string;
  mint: string;
  /** Pubkey del receptor (Moneto user). */
  toAddress: string;
  /** Pubkey del sender — puede ser un payer externo random. */
  fromAddress: string | null;
  /** Display amount (already decimal-adjusted by caller). */
  displayAmount: number;
  /** Human symbol del token (USD, USDC, etc.). Solo para push body. */
  symbol: string;
  /** Block time del slot, ms epoch. */
  blockTimeMs: number;
  /** El user_id del receptor — caller resuelve via wallet→userId map. */
  userId: string;
  /** Source type heuristic. Sprint 4.01 usa 'unknown' siempre; Sprint 5
   *  diferenciará 'payroll_link' usando memo del Solana Pay URL. */
  sourceType?: IncomingTransferSourceType;
}

export interface ProcessTransferResult {
  /** True si efectivamente procesamos; false si era duplicate. */
  processed: boolean;
  /** Push notification dispatched? Solo informativo — no es contrato. */
  pushDispatched: boolean;
}

export interface PushSender {
  /**
   * Envía un push a todos los tokens activos del user. Implementación
   * vive en `apps/api/src/services/push.ts`. La inyección como param
   * facilita testing.
   */
  sendToUser(input: PushSendInput): Promise<{ delivered: number }>;
}

export interface PushSendInput {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function processIncomingTransfer(
  supabase: SupabaseClient<Database>,
  push: PushSender,
  input: ProcessTransferInput,
): Promise<ProcessTransferResult> {
  // 1. Idempotency lock — INSERT con conflict ignore. Si pega un
  // duplicate-key error (23505), ya fue procesado.
  const { error: lockError } = await supabase.from("processed_signatures").insert({
    signature: input.signature,
    mint: input.mint,
    user_id: input.userId,
  });

  if (lockError) {
    if (lockError.code === "23505") {
      log.debug("duplicate signature — skipping", {
        signature: input.signature.slice(0, 12),
      });
      return { processed: false, pushDispatched: false };
    }
    log.error("failed to acquire idempotency lock", { code: lockError.code });
    throw new Error(`processed_signatures_insert_failed:${lockError.code}`);
  }

  // 2. Audit row. Sin amounts en plain text — solo signature, mint,
  // sender, source_type, block_time. UI consume esta tabla para historial.
  const { error: auditError } = await supabase.from("incoming_transfers").insert({
    signature: input.signature,
    user_id: input.userId,
    mint: input.mint,
    from_address: input.fromAddress,
    source_type: input.sourceType ?? "unknown",
    block_time: new Date(input.blockTimeMs).toISOString(),
  });

  if (auditError) {
    // No bloquemos el push por audit fail — la idempotency ya quedó
    // grabada, y un reintento de Helius no va a re-procesar. Logueamos
    // para Sentry y seguimos.
    log.warn("audit insert failed", { code: auditError.code });
  }

  // 3. Push notification — best effort. Failures se loguean pero el
  // webhook responde 200 igual (Helius no reintenta).
  let pushDispatched = false;
  try {
    const result = await push.sendToUser({
      userId: input.userId,
      title: pushTitle(input.displayAmount, input.symbol),
      body: pushBody(input.symbol),
      data: {
        type: "incoming_transfer",
        signature: input.signature,
      },
    });
    pushDispatched = result.delivered > 0;
  } catch (err) {
    log.warn("push dispatch failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  log.info("incoming transfer processed", {
    signature: input.signature.slice(0, 12),
    userId: input.userId,
    mint: input.mint,
    pushDispatched,
    // ⚠️ Sin amount ni from_address en logs.
  });

  return { processed: true, pushDispatched };
}

function pushTitle(amount: number, symbol: string): string {
  // Format conservador — sin currency symbol confusion ($ es USD).
  // Spanish conventions: comas miles, punto decimales — pero
  // `toLocaleString("es-CO")` invierte para COP. Usamos en-US para
  // valores USD-equivalentes y dejamos los locales para Sprint 4.04.
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Recibiste $${formatted} ${symbol}`;
}

function pushBody(symbol: string): string {
  // Sprint 5: cuando shielding sea live, copy "Empezá a rendir N% APY".
  // Por ahora es honesto: "Llegó".
  return symbol === "USDC" || symbol === "USDG" || symbol === "PYUSD" || symbol === "USDT"
    ? "Llegó a tu cuenta — empezá a rendir APY automáticamente"
    : "Llegó a tu cuenta Moneto";
}
