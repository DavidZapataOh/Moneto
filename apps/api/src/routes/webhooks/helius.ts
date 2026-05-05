import { MAINNET_MINTS, getAssetIdByMint, getAsset } from "@moneto/types";
import { createLogger } from "@moneto/utils";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createSupabaseAdminClient, type SupabaseAdminEnv } from "../../lib/supabase";
import { verifyHeaderAuth } from "../../lib/webhook-auth";
import { createPushService } from "../../services/push";
import { processIncomingTransfer } from "../../services/transfer-handler";

const log = createLogger("webhooks.helius");

/**
 * Sub-router para `/webhooks/helius/*`. Endpoints **públicos** (no
 * Privy-auth) — el caller es Helius, autentica con HMAC/header secret.
 *
 * Mounted FUERA de `/api/*` en `index.ts`. El rate limit `read` por IP
 * aplica a `/public/*` no acá — webhooks tienen su propio quota model
 * (Helius no spammea, pero un atacker podría — el HMAC verify mata
 * requests no-autenticados antes de tocar la DB).
 *
 * **Auth**: comparamos `Authorization` header contra
 * `HELIUS_WEBHOOK_SECRET` env. Constant-time comparison vía
 * `verifyHeaderAuth`. Si Helius soporta HMAC firmado en el futuro,
 * swap a `verifyHmacSignature`.
 */

interface WebhookEnv extends SupabaseAdminEnv {
  HELIUS_WEBHOOK_SECRET?: string;
}

const helius = new Hono<{ Bindings: WebhookEnv }>();

// ── Helius enhanced webhook payload schema ────────────────────────────────
//
// Doc: https://docs.helius.dev/webhooks-and-websockets/api-reference/enhanced-webhooks
//
// Helius envía un ARRAY de eventos por POST (batches). Cada evento tiene
// signature + timestamp + tokenTransfers + nativeTransfers (omitido para
// SPL flow).

const TokenTransferSchema = z.object({
  fromUserAccount: z.string(),
  toUserAccount: z.string(),
  /** Display amount (already decimal-adjusted). Helius normaliza por nosotros. */
  tokenAmount: z.number().nonnegative(),
  mint: z.string(),
});

const HeliusEventSchema = z.object({
  signature: z.string(),
  /** Block time epoch SECONDS (no ms). */
  timestamp: z.number(),
  type: z.string(), // "TRANSFER", "SWAP", etc. — filter abajo
  tokenTransfers: z.array(TokenTransferSchema).optional(),
  nativeTransfers: z.array(z.unknown()).optional(),
});

const HeliusBatchSchema = z.array(HeliusEventSchema);

/**
 * Lista de mints stablecoin que aceptamos como "incoming USD-equivalent".
 * Los locales (COPm, MXNB, etc.) también — Sprint 4.04 internacionaliza
 * el push copy. Por ahora todos van con title "Recibiste $X SYMBOL".
 */
const ACCEPTED_MINTS = new Set<string>(Object.values(MAINNET_MINTS));

helius.post("/incoming", async (c) => {
  const env = c.env;
  if (!env.HELIUS_WEBHOOK_SECRET) {
    log.error("helius webhook secret not configured");
    throw new HTTPException(500, { message: "webhook_misconfigured" });
  }

  const authHeader = c.req.header("Authorization");
  if (!verifyHeaderAuth(authHeader, env.HELIUS_WEBHOOK_SECRET)) {
    log.warn("helius webhook auth failed", {
      hasHeader: !!authHeader,
    });
    throw new HTTPException(401, { message: "invalid_webhook_signature" });
  }

  // Read RAW body para parsear como JSON. Si en el futuro switch a HMAC,
  // necesitamos el body raw para verify — leave as-is.
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "invalid_json" });
  }

  const parseResult = HeliusBatchSchema.safeParse(payload);
  if (!parseResult.success) {
    log.warn("helius schema mismatch", {
      issues: parseResult.error.issues.length,
    });
    // 200 + log — Helius reintenta agresivamente; si el shape cambió,
    // queremos NO bloquear su queue mientras debuggeamos.
    return c.json({ ok: true, processed: 0, skipped: "schema_mismatch" });
  }

  const events = parseResult.data;
  const supabase = createSupabaseAdminClient(env);
  const push = createPushService(supabase);

  let processed = 0;
  let skipped = 0;

  for (const event of events) {
    if (event.type !== "TRANSFER" || !event.tokenTransfers) {
      skipped += 1;
      continue;
    }

    for (const transfer of event.tokenTransfers) {
      // Filter por mints supported. Helius webhook con `accountAddresses`
      // puede emitir cualquier SPL hacia esos accounts — filtramos a los
      // que UI puede representar.
      if (!ACCEPTED_MINTS.has(transfer.mint)) {
        skipped += 1;
        continue;
      }

      // Lookup user_id via wallet_index (poblado en `/api/me/push-tokens`).
      // Si el wallet no está bound (user nunca abrió el mobile post-update),
      // skip — el balance se reflejará en próximo `/api/me/balance` poll.
      const { data: indexRow, error: indexErr } = await supabase
        .from("wallet_index")
        .select("user_id")
        .eq("wallet_address", transfer.toUserAccount)
        .maybeSingle();

      if (indexErr) {
        log.warn("wallet_index lookup failed", {
          code: indexErr.code,
          to: transfer.toUserAccount.slice(0, 8),
        });
        skipped += 1;
        continue;
      }
      if (!indexRow) {
        skipped += 1;
        continue;
      }

      const assetId = getAssetIdByMint(transfer.mint);
      const symbol = assetId ? getAsset(assetId).symbol : "USDC"; // safe fallback

      try {
        const result = await processIncomingTransfer(supabase, push, {
          signature: event.signature,
          mint: transfer.mint,
          toAddress: transfer.toUserAccount,
          fromAddress: transfer.fromUserAccount,
          displayAmount: transfer.tokenAmount,
          symbol,
          blockTimeMs: event.timestamp * 1000,
          userId: indexRow.user_id,
          sourceType: "unknown",
        });
        if (result.processed) processed += 1;
        else skipped += 1;
      } catch (err) {
        log.error("transfer processing failed", {
          err: err instanceof Error ? err.message : String(err),
          signature: event.signature.slice(0, 12),
        });
        // Helius reintenta si retornamos non-2xx — pero queremos que el
        // resto del batch siga procesando. Logueamos y seguimos.
        skipped += 1;
      }
    }
  }

  log.info("helius webhook processed", {
    events: events.length,
    processed,
    skipped,
  });

  return c.json({ ok: true, processed, skipped });
});

export default helius;
