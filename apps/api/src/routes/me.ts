import { zValidator } from "@hono/zod-validator";
import { createLogger } from "@moneto/utils";
import { PublicKey } from "@solana/web3.js";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { getPrivyUserSolanaPubkey, type PrivyAdminEnv } from "../lib/privy-admin";
import { createSupabaseAdminClient, type SupabaseAdminEnv } from "../lib/supabase";
import { requireUserId } from "../middleware/auth";
import { createBalanceService, type BalanceServiceEnv } from "../services/balance-service";
import { createPriceService } from "../services/price-service";

import type { Database, ThemePreference, LanguagePreference, UserPreferences } from "@moneto/db";
import type { SolanaNetwork } from "@moneto/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const log = createLogger("api.me");

/**
 * Sub-router para `/api/me/*`. Se monta desde `apps/api/src/index.ts`:
 *
 *   app.route("/api/me", meRoutes);
 *
 * Todos los handlers asumen que `authMiddleware` corrió antes (en `/api/*`),
 * por lo que `c.get("userId")` está garantizado.
 *
 * Endpoints:
 * - GET    /api/me              → smoke (userId + claims).
 * - GET    /api/me/preferences  → row de `user_preferences` o defaults.
 * - PUT    /api/me/preferences  → upsert parcial; bumpea `updated_at`.
 */

type Bindings = SupabaseAdminEnv &
  PrivyAdminEnv &
  BalanceServiceEnv & {
    /** "mainnet-beta" | "devnet" — viene del worker env. Default mainnet-beta. */
    SOLANA_NETWORK?: string;
  };
type Variables = { userId: string };

const me = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function resolveNetwork(env: { SOLANA_NETWORK?: string }): SolanaNetwork {
  return env.SOLANA_NETWORK === "devnet" ? "devnet" : "mainnet-beta";
}

// ─── /api/me ────────────────────────────────────────────────────────────────

me.get("/", (c) => {
  const userId = requireUserId(c);
  const claims = c.get("claims");
  return c.json({
    userId,
    issuer: claims.iss,
    audience: claims.aud,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  });
});

// ─── /api/me/preferences ────────────────────────────────────────────────────

const THEME_VALUES = ["system", "light", "dark"] as const satisfies readonly ThemePreference[];
const LANGUAGE_VALUES = ["es", "en", "pt"] as const satisfies readonly LanguagePreference[];

me.get("/preferences", async (c) => {
  const userId = requireUserId(c);
  const supabase = createSupabaseAdminClient(c.env);

  const { data, error } = await fetchPreferences(supabase, userId);
  if (error) {
    log.error("preferences fetch failed", { code: error.code, hint: error.hint });
    throw new HTTPException(500, { message: "preferences_fetch_failed" });
  }

  // Si el user todavía no tiene row (signup recién hecho, primer login),
  // devolvemos defaults sintéticos con `updated_at: epoch 0` — así cualquier
  // preferencia local más reciente gana en el last-write-wins del mobile.
  if (!data) {
    return c.json({
      theme: "system" satisfies ThemePreference,
      language: "es" satisfies LanguagePreference,
      notifications_push: true,
      notifications_email: false,
      balance_hidden: false,
      default_asset: "USD",
      updated_at: new Date(0).toISOString(),
    });
  }

  return c.json(data);
});

const PutPreferencesSchema = z
  .object({
    theme: z.enum(THEME_VALUES).optional(),
    language: z.enum(LANGUAGE_VALUES).optional(),
    notifications_push: z.boolean().optional(),
    notifications_email: z.boolean().optional(),
    balance_hidden: z.boolean().optional(),
    default_asset: z.string().min(2).max(8).optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "at least one preference field is required",
  });

me.put("/preferences", zValidator("json", PutPreferencesSchema), async (c) => {
  const userId = requireUserId(c);
  const updates = stripUndefined(c.req.valid("json"));
  const supabase = createSupabaseAdminClient(c.env);

  // `updated_at` lo maneja la DB: default `now()` en INSERT, trigger
  // `prefs_touch_updated_at` en UPDATE (ver migration 0002). No lo
  // mandamos desde acá para evitar drift cliente↔servidor en clocks.
  const { data, error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" })
    .select(
      "theme, language, notifications_push, notifications_email, balance_hidden, default_asset, updated_at",
    )
    .single();

  if (error) {
    // FK violation (profile aún no existe — race vs sync-profile) → 409.
    // El mobile re-intentará en el próximo cambio o login. Otros → 500.
    const isFkViolation = error.code === "23503";
    log.warn("preferences upsert failed", { code: error.code, isFkViolation });
    throw new HTTPException(isFkViolation ? 409 : 500, {
      message: isFkViolation ? "profile_not_provisioned" : "preferences_update_failed",
    });
  }

  return c.json(data);
});

// ─── /api/me/balance ────────────────────────────────────────────────────────

/**
 * GET /api/me/balance
 *
 * Resuelve la pubkey del Solana wallet del user (via Privy admin) y
 * devuelve un summary agregado: assets con balance > 0 + total USD +
 * APY ponderado + cambio 24h. Sprint 3.02 implementación; Sprint 3.03
 * reemplaza el `priceService` stub por Pyth real.
 *
 * **Compartmentalization**: la pubkey resuelta NO se persiste — se usa
 * solo para esta request. La response NO incluye la pubkey en plaintext.
 *
 * Bigint serialization: `balance` se convierte a string en la response
 * porque JSON no soporta bigint nativo. El mobile lo parsea de vuelta
 * via `BigInt(balance)`.
 */
me.get("/balance", async (c) => {
  const userId = requireUserId(c);
  const network = resolveNetwork(c.env);

  // Resolver pubkey vía Privy admin. Errors ya se mapean a HTTPException
  // dentro de `getPrivyUserSolanaPubkey`.
  const ownerAddress = await getPrivyUserSolanaPubkey(userId, c.env);

  // Validate pubkey shape — defensa contra Privy retornando junk.
  try {
    new PublicKey(ownerAddress);
  } catch {
    log.error("invalid pubkey from privy", { ownerLen: ownerAddress.length });
    throw new HTTPException(502, { message: "invalid_pubkey_from_privy" });
  }

  const priceService = createPriceService();
  const balanceService = createBalanceService(c.env, priceService);

  let summary;
  try {
    summary = await balanceService.getBalancesForUser(ownerAddress, network);
  } catch (err) {
    const code = err instanceof Error ? err.message : "balance_fetch_failed";
    log.error("balance fetch failed", { code, network });
    // Si Helius está rate-limited o down, retornamos 503 → mobile debería
    // mostrar last-known-good cache. Cualquier otro error cae a 500.
    const isHeliusError = code.startsWith("helius_");
    throw new HTTPException(isHeliusError ? 503 : 500, { message: code });
  }

  // Bigint → string en la response (JSON no serializa bigint nativamente).
  return c.json({
    assets: summary.assets.map((a) => ({
      ...a,
      balance: a.balance.toString(),
    })),
    totalUsd: summary.totalUsd,
    change24hUsd: summary.change24hUsd,
    change24hPct: summary.change24hPct,
    weightedApy: summary.weightedApy,
    fetchedAt: summary.fetchedAt,
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

type PreferencesProjection = Pick<
  UserPreferences,
  | "theme"
  | "language"
  | "notifications_push"
  | "notifications_email"
  | "balance_hidden"
  | "default_asset"
  | "updated_at"
>;

interface PreferencesError {
  code?: string;
  hint?: string | null;
  message: string;
}

/**
 * Zod genera campos optional como `T | undefined`, mientras que
 * `UserPreferencesInsert.theme` es `T?` puro. Con `exactOptionalPropertyTypes`
 * no son asignables. Filtramos las keys con valor undefined y reescribimos
 * el tipo de retorno para excluir undefined del valor de cada key.
 */
type DefinedValues<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

function stripUndefined<T extends Record<string, unknown>>(obj: T): DefinedValues<T> {
  const out = {} as DefinedValues<T>;
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const value = obj[key];
    if (value !== undefined) {
      out[key] = value as Exclude<T[typeof key], undefined>;
    }
  }
  return out;
}

async function fetchPreferences(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ data: PreferencesProjection | null; error: PreferencesError | null }> {
  const result = await supabase
    .from("user_preferences")
    .select(
      "theme, language, notifications_push, notifications_email, balance_hidden, default_asset, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return { data: result.data, error: result.error };
}

export default me;
