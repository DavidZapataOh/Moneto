import { zValidator } from "@hono/zod-validator";
import { createLogger } from "@moneto/utils";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { createSupabaseAdminClient, type SupabaseAdminEnv } from "../lib/supabase";
import { requireUserId } from "../middleware/auth";

const log = createLogger("api.early-access");

/**
 * Sub-router para `/api/early-access/*`. Persiste solicitudes de acceso
 * a features no-live todavía — Sprint 3.08 cubre bridges (BTC, ETH).
 *
 * Convención del slug `feature`: `namespace:variant`. Ejemplos:
 * - `bridge:btc`  — quiere bridge BTC → zBTC vía Zeus.
 * - `bridge:eth`  — quiere bridge ETH → wETH vía Wormhole.
 * - `card:premium` (futuro) — quiere card upgrade.
 *
 * Acepta un slug abierto pero zod whitelist a los conocidos hoy. Cuando
 * abramos más features, agregamos el slug a `KNOWN_FEATURE_SLUGS`.
 */

const KNOWN_FEATURE_SLUGS = ["bridge:btc", "bridge:eth"] as const satisfies readonly string[];

const FeatureSlugSchema = z.enum(KNOWN_FEATURE_SLUGS);

const PostRequestSchema = z
  .object({
    feature: FeatureSlugSchema,
    /** Provider planeado (ej. "zeus", "wormhole") — opcional, ayuda a
     *  agrupar reportes en marketing dashboard. */
    provider: z.string().min(2).max(64).optional(),
  })
  .strict();

type Bindings = SupabaseAdminEnv;
type Variables = { userId: string };

const earlyAccess = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── POST / — registrar solicitud ──────────────────────────────────────────

earlyAccess.post("/", zValidator("json", PostRequestSchema), async (c) => {
  const userId = requireUserId(c);
  const { feature, provider } = c.req.valid("json");
  const supabase = createSupabaseAdminClient(c.env);

  // Idempotent: upsert por (user_id, feature). Repeats bumpan
  // `last_requested_at` via trigger (migration 0009).
  const metadata = provider ? { provider } : {};
  const { data, error } = await supabase
    .from("early_access_requests")
    .upsert({ user_id: userId, feature, metadata }, { onConflict: "user_id,feature" })
    .select("feature, first_requested_at, last_requested_at")
    .single();

  if (error) {
    const isFkViolation = error.code === "23503";
    log.warn("early access upsert failed", { code: error.code, isFkViolation });
    throw new HTTPException(isFkViolation ? 409 : 500, {
      message: isFkViolation ? "profile_not_provisioned" : "early_access_persist_failed",
    });
  }

  return c.json(data);
});

// ─── GET / — listar solicitudes del user ──────────────────────────────────

earlyAccess.get("/", async (c) => {
  const userId = requireUserId(c);
  const supabase = createSupabaseAdminClient(c.env);

  const { data, error } = await supabase
    .from("early_access_requests")
    .select("feature, first_requested_at, last_requested_at")
    .eq("user_id", userId);

  if (error) {
    log.error("early access fetch failed", { code: error.code, hint: error.hint });
    throw new HTTPException(500, { message: "early_access_fetch_failed" });
  }

  return c.json({ requests: data ?? [] });
});

export default earlyAccess;
