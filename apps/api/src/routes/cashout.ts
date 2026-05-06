import { zValidator } from "@hono/zod-validator";
import { createLogger } from "@moneto/utils";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createSupabaseAdminClient, type SupabaseAdminEnv } from "../lib/supabase";
import { requireUserId } from "../middleware/auth";
import { rateLimit, RATE_LIMIT_PRESETS } from "../middleware/rate-limit";

import type { CashoutLocalCurrency, CashoutStatus } from "@moneto/db";

const log = createLogger("api.cashout");

/**
 * Sub-router para `/api/cashout/*` — Sprint 4.06 STUB.
 *
 * **Sprint 4.06 (este)**: el endpoint inserta una fila con status
 * `queued` y devuelve mock ETA. Nunca ejecuta el provider real.
 *
 * **Sprint 6**: reemplaza el insert simple por:
 * 1. KYC nivel check (block si <2).
 * 2. Daily/monthly limit check (per KYC tier).
 * 3. Sanctions screening (Chainalysis).
 * 4. Lock-in del FX rate via provider quote endpoint.
 * 5. Bold API call → registra `provider_reference`.
 * 6. Webhook handler separado para transitionar status.
 *
 * El response shape del Sprint 4.06 ya matchea el target del Sprint 6
 * para que el cliente no cambie.
 *
 * **Privacy**: NO logueamos amount en plain text. Bucketed via PostHog
 * client-side.
 */

interface CashoutEnv extends SupabaseAdminEnv {
  // Sprint 6: BOLD_API_KEY, BOLD_API_BASE — secrets via wrangler.
  ENVIRONMENT?: string;
}

type Bindings = CashoutEnv;
type Variables = { userId: string };

const cashout = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Money-class rate limit — más restrictivo que el `read` default que
// aplica a `/api/*`. Apilado: el `/api/*` rate limit ya corrió a 60/min,
// este lo refina a 10/min para money.
cashout.use("*", rateLimit(RATE_LIMIT_PRESETS.money));

const SUPPORTED_LOCAL_CURRENCIES = [
  "COP",
  "MXN",
  "BRL",
  "ARS",
  "EUR",
  "USD",
] as const satisfies readonly CashoutLocalCurrency[];

/**
 * Stub fee Moneto — 0.75% del amount. Sprint 6 vendrá del provider
 * (Bold cobra ~0.5%, Moneto agrega margen).
 */
const STUB_MONETO_FEE_PCT = 0.0075;

/**
 * Stub ETA — 10 minutos para Sprint 4.06. Sprint 6 viene del provider
 * quote (Bold ACH es 5-30 min variable per banco destination).
 */
const STUB_ETA_MINUTES = 10;

/**
 * Mock processing latency — simula la espera del provider (Bold quote +
 * commit). Solo en dev/staging — production con real Bold no tiene
 * sleep artificial.
 */
const STUB_PROCESSING_DELAY_MS = 1500;

const PostCashoutSchema = z
  .object({
    /** USD-equivalent del send. Cliente computa via spotPriceUsd. */
    amount_usd: z.number().positive().max(50_000),
    /** Tasa de cambio frozen al confirm. Sprint 6 lock-in del provider. */
    exchange_rate: z.number().positive(),
    /** Moneda local target. */
    local_currency: z.enum(SUPPORTED_LOCAL_CURRENCIES),
    /** Amount en moneda local — pre-computed por cliente para audit consistency. */
    amount_local: z.number().positive(),
    /** Label del destination ("Bancolombia •••• 0284"). Sprint 4.06 mock; Sprint 6
     *  el cliente lo extrae de su `bank_accounts` linkeada. */
    destination_label: z.string().min(2).max(64),
    /** Sprint 6 — opaque ID del bank_accounts table. Optional acá. */
    destination_account_id: z.string().min(2).max(64).optional(),
  })
  .strict();

cashout.post("/", zValidator("json", PostCashoutSchema), async (c) => {
  const userId = requireUserId(c);
  const input = c.req.valid("json");
  const supabase = createSupabaseAdminClient(c.env);

  // Sprint 4.06 STUB: simulate processing delay (provider quote+commit).
  // Sprint 6 reemplaza por Bold API real.
  if (c.env.ENVIRONMENT !== "production") {
    await sleep(STUB_PROCESSING_DELAY_MS);
  }

  // Compute Moneto fee server-side (no confiamos en el cliente para fees).
  const moneto_fee_usd = round6(input.amount_usd * STUB_MONETO_FEE_PCT);

  const eta = new Date(Date.now() + STUB_ETA_MINUTES * 60 * 1000).toISOString();

  const insertPayload = {
    user_id: userId,
    amount_usd: input.amount_usd,
    fee_usd: moneto_fee_usd,
    exchange_rate: input.exchange_rate,
    local_currency: input.local_currency,
    amount_local: input.amount_local,
    destination_label: input.destination_label,
    estimated_completion_at: eta,
    status: "queued" as CashoutStatus,
    ...(input.destination_account_id
      ? { destination_account_id: input.destination_account_id }
      : {}),
  };

  const { data, error } = await supabase
    .from("cashouts")
    .insert(insertPayload)
    .select("id, status, estimated_completion_at, fee_usd")
    .single();

  if (error) {
    const isFkViolation = error.code === "23503";
    log.warn("cashout insert failed", { code: error.code, isFkViolation });
    throw new HTTPException(isFkViolation ? 409 : 500, {
      message: isFkViolation ? "profile_not_provisioned" : "cashout_insert_failed",
    });
  }

  log.info("cashout queued (stub)", {
    cashoutId: data.id,
    userId,
    localCurrency: input.local_currency,
    // ⚠️ amount NO logueado en plain text — bucket-side analytics only.
  });

  return c.json({
    id: data.id,
    status: data.status,
    estimated_completion_at: data.estimated_completion_at,
    fee_usd: data.fee_usd,
    estimated_completion_minutes: STUB_ETA_MINUTES,
  });
});

/**
 * GET /api/cashout/:id — read state. Sprint 4.06 retorna el snapshot
 * directo. Sprint 6 (con webhook update) será polled by mobile post-send
 * para mostrar progress.
 */
cashout.get("/:id", async (c) => {
  const userId = requireUserId(c);
  const id = c.req.param("id");
  if (!isValidUuid(id)) {
    throw new HTTPException(400, { message: "invalid_cashout_id" });
  }

  const supabase = createSupabaseAdminClient(c.env);
  const { data, error } = await supabase
    .from("cashouts")
    .select(
      "id, status, amount_usd, fee_usd, exchange_rate, local_currency, amount_local, destination_label, estimated_completion_at, completed_at, failure_reason, created_at",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    log.error("cashout fetch failed", { code: error.code });
    throw new HTTPException(500, { message: "cashout_fetch_failed" });
  }
  if (!data) {
    throw new HTTPException(404, { message: "cashout_not_found" });
  }

  return c.json(data);
});

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default cashout;
