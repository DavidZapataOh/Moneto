import { zValidator } from "@hono/zod-validator";
import { createLogger } from "@moneto/utils";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { getPrivyUserSolanaPubkey, type PrivyAdminEnv } from "../lib/privy-admin";
import { createSupabaseAdminClient, type SupabaseAdminEnv } from "../lib/supabase";
import { requireUserId } from "../middleware/auth";

const log = createLogger("api.users");

/**
 * Sub-router para `/api/users/*` — directorio interno de usuarios para
 * el flow P2P send (Sprint 4.05).
 *
 * Endpoints:
 * - `GET /search?q=<query>` — busca por handle (ilike). Excluye self.
 *   Resuelve wallet via Privy admin per match. Returns subset público.
 * - `GET /recent-contacts` — lista de users con quien hubo intercambio
 *   reciente. Sprint 4.05 stub (returns []), Sprint 4.07 wirea real
 *   data desde `incoming_transfers` + sends history.
 *
 * **Compartmentalization**: las wallets vienen de Privy admin (no
 * persistidas en Supabase profiles). El endpoint `search` retorna
 * `wallet_address` para que el mobile pueda construir el SPL transfer
 * sin un round-trip extra. El sender ya está authenticated y necesita
 * la pubkey para signing — no es leak nuevo (la pubkey on-chain ya
 * es pública por diseño).
 */

type Bindings = SupabaseAdminEnv & PrivyAdminEnv;
type Variables = { userId: string };

const users = new Hono<{ Bindings: Bindings; Variables: Variables }>();

interface UserSearchResult {
  id: string;
  handle: string;
  name: string | null;
  avatar_url: string | null;
  country_code: string;
  /** Solana pubkey base58 — input para SplTransferService.executeTransfer. */
  wallet_address: string;
}

const SEARCH_LIMIT = 10;

const SearchQuerySchema = z.object({
  q: z
    .string()
    .min(2, "minimum 2 chars")
    .max(50, "max 50 chars")
    .regex(/^[@a-z0-9 _-]+$/i, "invalid characters"),
});

users.get("/search", zValidator("query", SearchQuerySchema), async (c) => {
  const userId = requireUserId(c);
  const { q } = c.req.valid("query");

  // Sanitize: strip @ prefix, lowercase, trim.
  const needle = q.replace(/^@/, "").toLowerCase().trim();
  if (needle.length < 2) {
    return c.json([] satisfies UserSearchResult[]);
  }

  const supabase = createSupabaseAdminClient(c.env);

  // Search por handle ILIKE %q% — name search se agrega Sprint 4.07
  // cuando profiles.name esté reliably populated.
  //
  // Excluimos self (`neq id`) — UI también guarda contra self-send
  // al confirm, pero filter server-side reduce el response noise.
  //
  // SEC: el `needle` ya pasó el regex `[@a-z0-9 _-]+`. El parámetro
  // pasa via parameterized query (PostgREST), no SQL string concat.
  const escaped = escapeIlikePattern(needle);
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, name, avatar_url, country_code")
    .ilike("handle", `%${escaped}%`)
    .neq("id", userId)
    .limit(SEARCH_LIMIT);

  if (error) {
    log.error("user search failed", { code: error.code });
    throw new HTTPException(500, { message: "user_search_failed" });
  }
  if (!data || data.length === 0) {
    return c.json([] satisfies UserSearchResult[]);
  }

  // Resolver wallets en parallel. Si Privy falla para un user específico
  // (race con createOnLogin u otro), excluímos del resultado — el sender
  // no quiere intentar mandar a un wallet que no existe.
  const results = await Promise.all(
    data.map(async (profile): Promise<UserSearchResult | null> => {
      try {
        const walletAddress = await getPrivyUserSolanaPubkey(profile.id, c.env);
        return {
          id: profile.id,
          handle: profile.handle,
          name: profile.name,
          avatar_url: profile.avatar_url,
          country_code: profile.country_code,
          wallet_address: walletAddress,
        };
      } catch (err) {
        log.debug("wallet resolution skipped for search match", {
          handle: profile.handle,
          err: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    }),
  );

  const filtered = results.filter((r): r is UserSearchResult => r !== null);
  return c.json(filtered);
});

users.get("/recent-contacts", async (c) => {
  // Sprint 4.05 stub. Retorna [] siempre — el cliente cae al search.
  // Sprint 4.07 wirea: top N users con quien tuvimos `incoming_transfers`
  // o sends recientes (table outgoing_transfers que se crea en 4.07).
  // requireUserId hace el auth gate (throw 401 si no userId en context).
  requireUserId(c);
  return c.json([] satisfies UserSearchResult[]);
});

/**
 * ILIKE pattern escape — los caracteres `%` `_` `\` son metacaracteres
 * en PostgreSQL pattern matching. El regex de input ya prohíbe estos
 * chars pero defensa en profundidad.
 */
function escapeIlikePattern(s: string): string {
  return s.replace(/([%_\\])/g, "\\$1");
}

export default users;
