import { createLogger } from "@moneto/utils";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { getPrivyUserSolanaPubkey, type PrivyAdminEnv } from "../lib/privy-admin";
import { createSupabaseAdminClient, type SupabaseAdminEnv } from "../lib/supabase";

const log = createLogger("api.public-pay");

/**
 * Sub-router para `/public/pay/*` — endpoint **anónimo** (no auth) que
 * resuelve un Moneto handle a la info necesaria para que un payer
 * externo arme una transferencia Solana Pay-compatible.
 *
 * Mounted FUERA de `/api/*` en `index.ts` para que el `authMiddleware`
 * no exija un Privy token. Hereda el rate limit `read` por IP.
 *
 * **Compartmentalization** preservada:
 * - Profile (handle, name, country_code, avatar_url) → Supabase. El handle
 *   es público por diseño (es lo que el user comparte).
 * - Wallet address → Privy admin (NO en Supabase). Se resuelve por request.
 * - El `did:privy:xxx` (id) NUNCA se retorna al payer — solo necesita la
 *   pubkey para el SPL transfer.
 *
 * Privacy: el payer ve `name` + `country_code`. NO email, NO phone, NO
 * KYC level, NO transactions, NO balances.
 */

type Bindings = SupabaseAdminEnv & PrivyAdminEnv;

const publicPay = new Hono<{ Bindings: Bindings }>();

interface PublicPayResponse {
  handle: string;
  name: string | null;
  country_code: string;
  avatar_url: string | null;
  /** Solana pubkey base58 — input para `@solana/pay encodeURL`. */
  wallet_address: string;
}

publicPay.get("/:handle", async (c) => {
  const rawHandle = c.req.param("handle");
  // Sanitize — handles son `@xxx` en UI pero no esperamos `@` en URL.
  // También strip whitespace + lowercase para que `Maria` y `maria` matcheen.
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();
  if (!isValidHandle(handle)) {
    throw new HTTPException(400, { message: "invalid_handle" });
  }

  const supabase = createSupabaseAdminClient(c.env);

  // Lookup profile por handle. Solo retornamos campos públicos.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, handle, name, country_code, avatar_url")
    .eq("handle", handle)
    .maybeSingle();

  if (error) {
    log.error("profile lookup failed", { code: error.code });
    throw new HTTPException(500, { message: "profile_lookup_failed" });
  }
  if (!profile) {
    throw new HTTPException(404, { message: "handle_not_found" });
  }

  // Resolver wallet via Privy admin. Si falla, el handle queda "no
  // payable" — devolvemos 404 para no leakear que el handle existe pero
  // wallet no.
  let walletAddress: string;
  try {
    walletAddress = await getPrivyUserSolanaPubkey(profile.id, c.env);
  } catch (err) {
    log.warn("wallet resolution failed for public handle", {
      handle,
      err: err instanceof Error ? err.message : String(err),
    });
    throw new HTTPException(404, { message: "wallet_not_resolvable" });
  }

  const response: PublicPayResponse = {
    handle: profile.handle,
    name: profile.name,
    country_code: profile.country_code,
    avatar_url: profile.avatar_url,
    wallet_address: walletAddress,
  };
  return c.json(response);
});

/**
 * Handle validation — alphanumeric + underscore + dash, 3-32 chars.
 * Deja explícito el shape esperado, evita injection del path param a
 * la query (defense-in-depth aún con maybeSingle).
 */
function isValidHandle(handle: string): boolean {
  if (handle.length < 3 || handle.length > 32) return false;
  return /^[a-z0-9_-]+$/.test(handle);
}

export default publicPay;
