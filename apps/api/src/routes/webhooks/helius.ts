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

/**
 * Anti-dust thresholds — Sprint 4.03. Si un sender hace transferencias
 * <0.01 unit, lo skipeamos (típicamente spam o test transactions). Para
 * volátiles el threshold es más bajo (0.0001 BTC ~ $5 al precio actual).
 *
 * Sprint 5 + spot price service: convertir todo a USD-equivalent con
 * floor único (e.g., $0.01). Por ahora category-based heuristic.
 */
const DUST_THRESHOLD_BY_CATEGORY: Record<string, number> = {
  stable_usd: 0.01,
  stable_eur: 0.01,
  stable_local: 0.01,
  volatile: 0.0001,
};

/**
 * Per-user rate limit anti-spam — Sprint 4.03. Si un user recibe más de
 * `RATE_LIMIT_PER_HOUR` eventos en la última hora, droppeamos los
 * subsiguientes. Implementación: COUNT en `processed_signatures` (eficiente
 * por el index `processed_signatures_user_idx`). Fail-open si la query
 * falla — preferimos delivery por sobre block estricto.
 */
const RATE_LIMIT_PER_HOUR = 100;

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
      const category = assetId ? getAsset(assetId).category : "stable_usd";

      // ── Anti-dust: skip transfers below threshold per category ─────
      const dustFloor = DUST_THRESHOLD_BY_CATEGORY[category] ?? 0.01;
      if (transfer.tokenAmount < dustFloor) {
        log.debug("dust transfer skipped", {
          mint: transfer.mint.slice(0, 8),
          category,
        });
        skipped += 1;
        continue;
      }

      // ── Per-user rate limit: count eventos last hour ───────────────
      const overLimit = await isUserOverRateLimit(supabase, indexRow.user_id, RATE_LIMIT_PER_HOUR);
      if (overLimit) {
        log.warn("user rate limit exceeded — dropping incoming event", {
          userId: indexRow.user_id,
          signature: event.signature.slice(0, 12),
        });
        skipped += 1;
        continue;
      }

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

/**
 * COUNT events del user en la última hora. Usa el index
 * `processed_signatures_user_idx (user_id, processed_at desc)` así que
 * la query es O(log N + matches).
 *
 * Fail-open: si la query falla, retornamos `false` (no over-limit) para
 * que el flujo siga. Mejor un push spam ocasional que perder un legit.
 */
async function isUserOverRateLimit(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  limitPerHour: number,
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("processed_signatures")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("processed_at", oneHourAgo);
  if (error) {
    log.warn("rate limit count failed (fail-open)", { code: error.code });
    return false;
  }
  return (count ?? 0) >= limitPerHour;
}

export default helius;
