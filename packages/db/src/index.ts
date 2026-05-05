/**
 * @moneto/db — Supabase schema, migrations, typed Database interface.
 *
 * - **Migrations**: `supabase/migrations/*.sql` (apply via `pnpm db:push`).
 * - **Edge functions**: `supabase/functions/*` (Deno runtime).
 * - **Types**: hand-written en `./types.ts`. Sprint 2+ auto-genera con
 *   `pnpm db:gen-types` cuando el founder tenga el project linked.
 *
 * Apps consumen el `Database` type para parametrizar `createClient`:
 *
 * ```ts
 * import { createClient } from "@supabase/supabase-js";
 * import type { Database } from "@moneto/db";
 *
 * const sb = createClient<Database>(url, anonKey, { ... });
 * sb.from("profiles").select("kyc_level").eq("id", userId);
 * //              ^ autocomplete + return type narrowed.
 * ```
 *
 * El SDK de Supabase NO se importa desde acá — es peer-dep optional.
 * Cada app instala su propia versión (mobile, edge fn, futuro server).
 */

export * from "./types";
