import { createLogger } from "@moneto/utils";
import { HTTPException } from "hono/http-exception";

const log = createLogger("privy.admin");

/**
 * Helpers para el Privy Admin API. Los Privy JWTs que el mobile usa
 * traen `sub = did:privy:xxx` pero NO la pubkey del Solana wallet —
 * tenemos que resolverla server-side via admin API.
 *
 * **Compartmentalization invariant**: la pubkey del wallet **nunca**
 * se persiste en Supabase (ver `moneto-auth-architecture.md` §3).
 * Cada request a `/api/me/balance` resuelve la pubkey on-demand y la
 * usa solo para esa request.
 *
 * Privy admin API: https://docs.privy.io/api-reference/users/get-user
 * Auth: HTTP Basic con `<APP_ID>:<APP_SECRET>` base64-encoded.
 */

export interface PrivyAdminEnv {
  PRIVY_APP_ID?: string;
  PRIVY_APP_SECRET?: string;
}

/**
 * Linked accounts shape — Privy retorna un array de cuentas vinculadas
 * (email, phone, wallets, OAuth). Filtramos por `type === "wallet"` y
 * `chain_type === "solana"` para encontrar la embedded Solana wallet.
 *
 * Doc-only typing — usamos un subset porque Privy retorna mucho más.
 */
interface PrivyLinkedAccount {
  type: string;
  chain_type?: string;
  address?: string;
}

interface PrivyUserResponse {
  id: string;
  linked_accounts?: PrivyLinkedAccount[];
}

/**
 * Cache por request — el mismo userId puede ser resuelto múltiples veces
 * en una sola request (ej. balance + history flow). Cache module-scope
 * de **un** request es OK en Workers porque el isolate vive sub-second
 * y no compartimos entre requests.
 *
 * NOTA: Cloudflare Workers reusa isolates entre requests, así que el
 * cache puede vivir más de lo deseado. Mantenerlo conservador (max 30s
 * por entry) y limpiar agresivamente.
 */
const cache = new Map<string, { pubkey: string; cachedAtMs: number }>();
const CACHE_TTL_MS = 30_000;

/**
 * Resuelve la pubkey del Solana wallet embedded de un Privy user.
 *
 * @throws HTTPException 500 si Privy admin no está configurado o falla.
 * @throws HTTPException 404 si el user no tiene Solana wallet (caso raro
 *   — el flow de auth garantiza creación del wallet post-OAuth).
 */
export async function getPrivyUserSolanaPubkey(
  userId: string,
  env: PrivyAdminEnv,
): Promise<string> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.cachedAtMs < CACHE_TTL_MS) {
    return cached.pubkey;
  }

  if (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET) {
    log.error("privy admin missing env", {
      hasAppId: Boolean(env.PRIVY_APP_ID),
      hasAppSecret: Boolean(env.PRIVY_APP_SECRET),
    });
    throw new HTTPException(500, { message: "privy_admin_misconfigured" });
  }

  const auth = btoa(`${env.PRIVY_APP_ID}:${env.PRIVY_APP_SECRET}`);
  const url = `https://auth.privy.io/api/v1/users/${encodeURIComponent(userId)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        "privy-app-id": env.PRIVY_APP_ID,
        Accept: "application/json",
      },
    });
  } catch (err) {
    log.error("privy admin network error", { err: String(err) });
    throw new HTTPException(502, { message: "privy_admin_network" });
  }

  if (!res.ok) {
    log.warn("privy admin non-2xx", { status: res.status });
    if (res.status === 404) {
      throw new HTTPException(404, { message: "user_not_found" });
    }
    throw new HTTPException(502, { message: "privy_admin_failed" });
  }

  const data = (await res.json()) as PrivyUserResponse;
  const wallets = (data.linked_accounts ?? []).filter(
    (a) => a.type === "wallet" && a.chain_type === "solana" && typeof a.address === "string",
  );

  if (wallets.length === 0) {
    log.warn("user has no solana wallet", { userId });
    throw new HTTPException(404, { message: "no_solana_wallet" });
  }

  // El primero — Privy crea uno por user vía `createOnLogin: 'users-without-wallets'`.
  // Si en el futuro soportamos multi-wallet, este selector cambia.
  const pubkey = wallets[0]!.address!;
  cache.set(userId, { pubkey, cachedAtMs: Date.now() });

  return pubkey;
}

/**
 * Limpia el cache. Test helper + safety si el isolate de Workers vive
 * mucho y queremos garantizar fresh fetch (e.g., post-logout en mismo
 * isolate, raro pero defensivo).
 */
export function clearPrivyCache(): void {
  cache.clear();
}
