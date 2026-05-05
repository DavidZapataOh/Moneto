import { createLogger } from "@moneto/utils";

import { createSupabaseAdminClient, type SupabaseAdminEnv } from "../lib/supabase";

const log = createLogger("jobs.cleanup");

/**
 * Daily cleanup jobs — disparados desde el `scheduled` handler del
 * worker (Cloudflare cron triggers). Sprint 4.03.
 *
 * Reglas:
 * - `processed_signatures > 90 días`: el risk de double-process post-90d
 *   es nulo (Helius no reintenta tan tarde). Mantener la tabla pequeña
 *   acelera los `select count(*)` del rate limit.
 * - `push_tokens` invalidated > 30 días: ya no recibe pushes; trash.
 * - `incoming_transfers > 365 días`: audit retention. 1 año cubre
 *   compliance LATAM típica + dispute windows. Sprint 6 (compliance)
 *   puede extender per regulatory needs.
 * - `early_access_requests`: NO se borran — dato de marketing valioso.
 *
 * Failure mode: si una query falla, logueamos + continuamos con la
 * próxima. No aborto el cron entero.
 */

const SIGNATURES_RETENTION_DAYS = 90;
const PUSH_TOKENS_RETENTION_DAYS = 30;
const INCOMING_TRANSFERS_RETENTION_DAYS = 365;

export interface CleanupResult {
  processedSignatures: number;
  pushTokens: number;
  incomingTransfers: number;
  errors: number;
}

export async function runCleanup(env: SupabaseAdminEnv): Promise<CleanupResult> {
  const supabase = createSupabaseAdminClient(env);
  const result: CleanupResult = {
    processedSignatures: 0,
    pushTokens: 0,
    incomingTransfers: 0,
    errors: 0,
  };

  // ── processed_signatures ──────────────────────────────────────────────
  {
    const cutoff = isoCutoff(SIGNATURES_RETENTION_DAYS);
    const { count, error } = await supabase
      .from("processed_signatures")
      .delete({ count: "exact" })
      .lt("processed_at", cutoff);
    if (error) {
      log.error("processed_signatures cleanup failed", { code: error.code });
      result.errors += 1;
    } else {
      result.processedSignatures = count ?? 0;
    }
  }

  // ── push_tokens (invalidated > 30d) ────────────────────────────────────
  {
    const cutoff = isoCutoff(PUSH_TOKENS_RETENTION_DAYS);
    const { count, error } = await supabase
      .from("push_tokens")
      .delete({ count: "exact" })
      .not("invalidated_at", "is", null)
      .lt("invalidated_at", cutoff);
    if (error) {
      log.error("push_tokens cleanup failed", { code: error.code });
      result.errors += 1;
    } else {
      result.pushTokens = count ?? 0;
    }
  }

  // ── incoming_transfers (audit retention 1y) ───────────────────────────
  {
    const cutoff = isoCutoff(INCOMING_TRANSFERS_RETENTION_DAYS);
    const { count, error } = await supabase
      .from("incoming_transfers")
      .delete({ count: "exact" })
      .lt("block_time", cutoff);
    if (error) {
      log.error("incoming_transfers cleanup failed", { code: error.code });
      result.errors += 1;
    } else {
      result.incomingTransfers = count ?? 0;
    }
  }

  log.info("cleanup completed", { ...result });
  return result;
}

function isoCutoff(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}
