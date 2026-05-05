import { type Database } from "@moneto/db";
import { createLogger } from "@moneto/utils";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const log = createLogger("supabase");

const SUPABASE_URL = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
const SUPABASE_ANON_KEY = process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] ?? "";

/**
 * Supabase client tipado con nuestro `Database` schema. Sin sesión propia
 * (Privy maneja todo) — el bridge **exchange-ea** el Privy JWT por un
 * Supabase JWT (firmado con el legacy JWT secret de Supabase, env
 * `SB_JWT_SECRET` en el edge fn) llamando al edge fn `auth-exchange`.
 * El Supabase JWT resultante se usa para queries directas (RLS lo
 * entiende nativo).
 *
 * Razón del exchange: Supabase no soporta Privy en su lista nativa de
 * third-party auth (solo Clerk/Firebase/Auth0/Cognito). Token exchange
 * es el pattern canónico documentado.
 *
 * Singleton + token cache:
 * - El client mantiene query cache + WebSocket connection (futuro realtime).
 * - El Supabase JWT se cachea hasta T-30s antes de expirar (refresh proactivo).
 * - Refresh corre lazy en cada request; falla silently si no hay Privy token.
 */

type GetPrivyTokenFn = () => Promise<string | null>;

interface CachedSupabaseToken {
  jwt: string;
  expiresAtMs: number;
}

let cachedClient: SupabaseClient<Database> | null = null;
let cachedGetPrivyToken: GetPrivyTokenFn | null = null;
let cachedSupabaseToken: CachedSupabaseToken | null = null;
let inflightExchange: Promise<string | null> | null = null;

/**
 * Refresh threshold — re-exchange si el token vence en <30 segundos. Evita
 * race condition donde el JWT expira mid-request.
 */
const REFRESH_THRESHOLD_MS = 30 * 1000;

/**
 * Llama al edge fn `auth-exchange`. Recibe Privy JWT, devuelve Supabase JWT.
 */
async function exchangeToken(
  privyToken: string,
): Promise<{ jwt: string; expiresInSec: number } | null> {
  if (!SUPABASE_URL) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-exchange`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${privyToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      log.warn("auth-exchange returned error", { status: res.status });
      return null;
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    return { jwt: data.access_token, expiresInSec: data.expires_in };
  } catch (err) {
    log.warn("auth-exchange network error", { err: String(err) });
    return null;
  }
}

/**
 * Retorna un Supabase JWT válido — cacheado o recién minteado. Idempotent
 * en caso de race condition (inflight promise compartido).
 */
async function getSupabaseToken(getPrivyToken: GetPrivyTokenFn): Promise<string | null> {
  // Cache hit con margen.
  if (cachedSupabaseToken && cachedSupabaseToken.expiresAtMs - Date.now() > REFRESH_THRESHOLD_MS) {
    return cachedSupabaseToken.jwt;
  }

  // Si ya hay exchange in-flight, espera ese — evita stampede de N requests
  // simultáneos disparando N exchanges paralelos.
  if (inflightExchange) {
    return inflightExchange;
  }

  inflightExchange = (async () => {
    const privyToken = await getPrivyToken().catch(() => null);
    if (!privyToken) {
      cachedSupabaseToken = null;
      return null;
    }

    const exchanged = await exchangeToken(privyToken);
    if (!exchanged) {
      cachedSupabaseToken = null;
      return null;
    }

    cachedSupabaseToken = {
      jwt: exchanged.jwt,
      expiresAtMs: Date.now() + exchanged.expiresInSec * 1000,
    };
    return exchanged.jwt;
  })();

  try {
    return await inflightExchange;
  } finally {
    inflightExchange = null;
  }
}

/**
 * Crea (o retorna cached) el client de Supabase. `getPrivyToken` debe
 * retornar el access token actual de Privy (`getAccessToken` del SDK).
 *
 * Implementación:
 * - `auth.persistSession: false` + `autoRefreshToken: false` — el bridge
 *   maneja todo, Supabase no debe escribir storage propio.
 * - `global.fetch` override — usa el Supabase JWT exchanged (no el Privy
 *   directo). Supabase native lo acepta (firmado con su secret) → RLS
 *   funciona normal.
 */
export function createSupabaseClient(getPrivyToken: GetPrivyTokenFn): SupabaseClient<Database> {
  if (cachedClient && cachedGetPrivyToken === getPrivyToken) {
    return cachedClient;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    log.warn("supabase env missing — client will fail at request time", {
      hasUrl: Boolean(SUPABASE_URL),
      hasKey: Boolean(SUPABASE_ANON_KEY),
    });
  }

  cachedGetPrivyToken = getPrivyToken;
  cachedClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init = {}) => {
        const supabaseJwt = await getSupabaseToken(getPrivyToken);
        const headers = new Headers(init.headers ?? {});
        if (supabaseJwt) {
          headers.set("Authorization", `Bearer ${supabaseJwt}`);
        }
        return fetch(input as RequestInfo, { ...init, headers });
      },
    },
  });

  return cachedClient;
}

/** Reset del singleton — usar SOLO en logout. Limpia client + token cache. */
export function resetSupabaseClient(): void {
  cachedClient = null;
  cachedGetPrivyToken = null;
  cachedSupabaseToken = null;
  inflightExchange = null;
}
