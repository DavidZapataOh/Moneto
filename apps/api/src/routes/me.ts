import { zValidator } from "@hono/zod-validator";
import { createLogger } from "@moneto/utils";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createSupabaseAdminClient, type SupabaseAdminEnv } from "../lib/supabase";
import { requireUserId } from "../middleware/auth";

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

type Bindings = SupabaseAdminEnv;
type Variables = { userId: string };

const me = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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
