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

  // Resolver wallet via Privy admin con retry — Privy crea el embedded
  // wallet ~1-3s post-OAuth. Si un user comparte su payroll link
  // inmediatamente después de signup, Privy puede aún no tener el wallet
  // listo. 3 attempts × 200ms backoff cubre el race sin ser caro.
  //
  // Si después de los retries sigue 404, devolvemos 503 con un retry
  // hint para el cliente — distinto de "handle inválido" (404) para que
  // el web landing pueda mostrar copy "Cuenta inicializándose, refrescá
  // en unos segundos".
  let walletAddress: string;
  try {
    walletAddress = await resolveWalletWithRetry(profile.id, c.env);
  } catch (err) {
    log.warn("wallet resolution failed for public handle", {
      handle,
      err: err instanceof Error ? err.message : String(err),
    });
    // Distinguimos: handle válido pero wallet aún provisionándose vs
    // handle inválido. El cliente trata 503 como "retry-able".
    throw new HTTPException(503, { message: "wallet_not_yet_provisioned" });
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

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 200;

/**
 * Wrapper de `getPrivyUserSolanaPubkey` con retry para race en wallet
 * creation. Privy `createOnLogin: "users-without-wallets"` toma 1-3s
 * en producir el wallet — un user que comparte su link inmediatamente
 * post-signup puede llegar acá antes que el wallet exista.
 *
 * Solo retry-amos en error 404 ("no_solana_wallet"). Errores de network
 * o config se propagan inmediato.
 */
async function resolveWalletWithRetry(userId: string, env: Bindings): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      return await getPrivyUserSolanaPubkey(userId, env);
    } catch (err) {
      lastError = err;
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "";
      // Solo retry en "no_solana_wallet" — los otros (privy_admin_misconfigured,
      // privy_admin_network) no se mejoran con retry.
      if (!message.includes("no_solana_wallet") && !message.includes("user_not_found")) {
        throw err;
      }
      if (attempt < RETRY_ATTEMPTS - 1) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("wallet_resolution_exhausted");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default publicPay;
