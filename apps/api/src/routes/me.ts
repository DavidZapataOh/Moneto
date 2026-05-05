import { zValidator } from "@hono/zod-validator";
import { AssetIdSchema, type AssetId, type SolanaNetwork } from "@moneto/types";
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

// ─── /api/me/asset-preferences ──────────────────────────────────────────────
//
// Asset routing config (Sprint 3.07):
// - `asset_priority_order` — orden en que el payment router consume saldo.
// - `hidden_assets`        — assets ocultos del UI (no afecta on-chain).
// - `default_send_asset`   — pre-selección en Send screen.

const DEFAULT_ASSET_ORDER: readonly AssetId[] = [
  "usd",
  "eur",
  "cop",
  "mxn",
  "brl",
  "ars",
  "sol",
  "btc",
  "eth",
] as const;

interface AssetPrefsResponse {
  asset_priority_order: AssetId[];
  hidden_assets: AssetId[];
  default_send_asset: AssetId;
  updated_at: string;
}

const PutAssetPrefsSchema = z
  .object({
    asset_priority_order: z
      .array(AssetIdSchema)
      .min(1, "asset_priority_order must contain at least one asset")
      .max(20, "asset_priority_order too large")
      .optional(),
    hidden_assets: z.array(AssetIdSchema).max(20, "hidden_assets too large").optional(),
    default_send_asset: AssetIdSchema.optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "at least one preference field is required",
  })
  .superRefine((obj, ctx) => {
    // Cross-field invariant: default_send_asset no puede estar oculto en
    // la misma request. Sino el `before update` trigger lo rechaza con un
    // 23514 que el caller no puede mappear well.
    if (
      obj.default_send_asset &&
      obj.hidden_assets &&
      obj.hidden_assets.includes(obj.default_send_asset)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["default_send_asset"],
        message: "default_send_asset cannot be in hidden_assets",
      });
    }
    // No duplicates en priority order — el payment router asume keys únicas.
    if (obj.asset_priority_order) {
      const set = new Set(obj.asset_priority_order);
      if (set.size !== obj.asset_priority_order.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["asset_priority_order"],
          message: "asset_priority_order must not contain duplicates",
        });
      }
    }
  });

me.get("/asset-preferences", async (c) => {
  const userId = requireUserId(c);
  const supabase = createSupabaseAdminClient(c.env);

  const { data, error } = await supabase
    .from("user_preferences")
    .select("asset_priority_order, hidden_assets, default_send_asset, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    log.error("asset prefs fetch failed", { code: error.code, hint: error.hint });
    throw new HTTPException(500, { message: "asset_preferences_fetch_failed" });
  }

  if (!data) {
    // No row yet — return defaults sintéticos. El cliente persiste cuando
    // el user toque algo. `updated_at` epoch 0 → cualquier write local
    // gana en LWW.
    const fallback: AssetPrefsResponse = {
      asset_priority_order: [...DEFAULT_ASSET_ORDER],
      hidden_assets: [],
      default_send_asset: "usd",
      updated_at: new Date(0).toISOString(),
    };
    return c.json(fallback);
  }

  // Normalizamos: la DB acepta cualquier `text[]` pero el contrato del
  // wire es AssetId. Filtramos values que no estén en el enum (asset
  // deprecado entre versions, junk inserted manualmente). Si el filtrado
  // dejaría el array vacío, fallback al default. Esto es defense-in-depth
  // — el zod schema del PUT ya valida en input.
  const normalizedOrder = (data.asset_priority_order as string[]).filter(isAssetIdValue);
  const order: AssetId[] = normalizedOrder.length > 0 ? normalizedOrder : [...DEFAULT_ASSET_ORDER];
  const hidden = (data.hidden_assets as string[]).filter(isAssetIdValue);
  const defaultSend: AssetId = isAssetIdValue(data.default_send_asset)
    ? data.default_send_asset
    : "usd";

  const response: AssetPrefsResponse = {
    asset_priority_order: order,
    hidden_assets: hidden,
    default_send_asset: defaultSend,
    updated_at: data.updated_at,
  };
  return c.json(response);
});

me.put("/asset-preferences", zValidator("json", PutAssetPrefsSchema), async (c) => {
  const userId = requireUserId(c);
  const updates = stripUndefined(c.req.valid("json"));
  const supabase = createSupabaseAdminClient(c.env);

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" })
    .select("asset_priority_order, hidden_assets, default_send_asset, updated_at")
    .single();

  if (error) {
    // 23503 → FK (profile no existe todavía). 23514 → check constraint del
    // trigger `enforce_asset_prefs_invariants` (e.g., default_send_asset
    // ya hidden por write previo). Ambos los mapeamos a 409 para que el
    // mobile re-evalúe y reintente.
    const isFkViolation = error.code === "23503";
    const isCheckViolation = error.code === "23514";
    log.warn("asset prefs upsert failed", {
      code: error.code,
      isFkViolation,
      isCheckViolation,
    });
    if (isFkViolation) {
      throw new HTTPException(409, { message: "profile_not_provisioned" });
    }
    if (isCheckViolation) {
      throw new HTTPException(409, { message: "asset_prefs_invariant_violation" });
    }
    throw new HTTPException(500, { message: "asset_preferences_update_failed" });
  }

  return c.json(data);
});

function isAssetIdValue(value: unknown): value is AssetId {
  return AssetIdSchema.safeParse(value).success;
}

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

// ─── /api/me/push-tokens ────────────────────────────────────────────────────
//
// Sprint 4.01 — registro de Expo push tokens. Side effect: bindea el
// wallet del user en `wallet_index` para que el Helius webhook pueda
// rutear transferencias entrantes.

const PushPlatformSchema = z.enum(["ios", "android", "web"]);

const PostPushTokenSchema = z
  .object({
    /** Expo push token con prefix "ExponentPushToken[...]" o "ExpoPushToken[...]". */
    token: z.string().min(20).max(160),
    platform: PushPlatformSchema,
  })
  .strict();

me.post("/push-tokens", zValidator("json", PostPushTokenSchema), async (c) => {
  const userId = requireUserId(c);
  const { token, platform } = c.req.valid("json");
  const supabase = createSupabaseAdminClient(c.env);

  // 1. Resolve wallet pubkey via Privy admin. Si el user todavía no tiene
  // wallet (race con createOnLogin), retornamos 409 — mobile reintenta.
  let walletAddress: string;
  try {
    walletAddress = await getPrivyUserSolanaPubkey(userId, c.env);
  } catch (err) {
    log.warn("push-tokens wallet resolution failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    throw new HTTPException(409, { message: "wallet_not_ready" });
  }

  // 2. Bind wallet → user (idempotent upsert). Si otra row para esta
  // wallet existe pero con otro user_id, sobreescribimos — Privy puede
  // re-asignar wallets en escenarios de recovery.
  const { error: bindErr } = await supabase
    .from("wallet_index")
    .upsert({ wallet_address: walletAddress, user_id: userId }, { onConflict: "wallet_address" });
  if (bindErr) {
    log.error("wallet_index upsert failed", { code: bindErr.code });
    throw new HTTPException(500, { message: "wallet_bind_failed" });
  }

  // 3. Upsert push token — `token` es PK, así que repeats actualizan el
  // user_id (token se transferred a otro user) y last_used_at.
  const { error: tokenErr } = await supabase.from("push_tokens").upsert(
    {
      token,
      user_id: userId,
      platform,
      last_used_at: new Date().toISOString(),
      invalidated_at: null,
    },
    { onConflict: "token" },
  );
  if (tokenErr) {
    log.error("push_tokens upsert failed", { code: tokenErr.code });
    throw new HTTPException(500, { message: "push_token_persist_failed" });
  }

  return c.json({ ok: true });
});

me.delete("/push-tokens/:token", async (c) => {
  const userId = requireUserId(c);
  const token = c.req.param("token");
  const supabase = createSupabaseAdminClient(c.env);

  // Soft-delete via `invalidated_at` — preserva audit trail.
  const { error } = await supabase
    .from("push_tokens")
    .update({ invalidated_at: new Date().toISOString() })
    .eq("token", token)
    .eq("user_id", userId);
  if (error) {
    log.warn("push token invalidation failed", { code: error.code });
    throw new HTTPException(500, { message: "push_token_invalidate_failed" });
  }
  return c.json({ ok: true });
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
