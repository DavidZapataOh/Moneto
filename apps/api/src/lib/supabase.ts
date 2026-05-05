import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HTTPException } from "hono/http-exception";

import type { Database } from "@moneto/db";

/**
 * Bindings que el factory necesita del Worker env. Estos llegan vía
 * `wrangler secret` (cloud) o `.dev.vars` (local). Si faltan, el factory
 * tira 500 — significa que el Worker está mal configurado.
 */
export interface SupabaseAdminEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

/**
 * Crea un cliente Supabase con `service_role` — bypasses RLS, usar SOLO
 * server-side. **Nunca** exponer este cliente al mobile (filtraría llaves
 * que dan acceso completo a la DB).
 *
 * El cliente se crea por request (Workers reusan isolates pero no podemos
 * compartir clients entre requests porque `fetch` lifecycle puede cerrar).
 * El overhead es despreciable — supabase-js es lazy en sus connections.
 *
 * @example
 *   const supabase = createSupabaseAdminClient(c.env);
 *   const { data, error } = await supabase
 *     .from("user_preferences")
 *     .select("theme")
 *     .eq("user_id", userId)
 *     .maybeSingle();
 */
export function createSupabaseAdminClient(env: SupabaseAdminEnv): SupabaseClient<Database> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HTTPException(500, { message: "supabase_misconfigured" });
  }

  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      // Worker es stateless — no persistas la session, no auto-refresh.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        // Tag los requests para auditing en Supabase logs.
        "x-moneto-server": "api",
      },
    },
  });
}
