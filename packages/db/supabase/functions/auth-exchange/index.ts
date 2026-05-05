// Edge function — auth-exchange
//
// Recibe un Privy JWT en Authorization header. Lo valida con jose+JWKS,
// y mint un Supabase-signed JWT (HS256 con SB_JWT_SECRET) que tiene
// el mismo `sub` (= Privy DID).
//
// Mobile usa el Supabase JWT resultante para queries directas a Supabase
// vía REST + RLS. Razón: Supabase no soporta Privy nativo en su lista
// de third-party auth providers (solo Clerk/Firebase/Auth0/Cognito), así
// que el token exchange es el pattern canónico.
//
// Ver `https://queen.raae.codes/2025-05-01-supabase-exchange/` para el
// pattern reference.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "https://esm.sh/jose@5.6.3";

const PRIVY_APP_ID = Deno.env.get("PRIVY_APP_ID");
// Legacy JWT signing secret de Supabase (still used for verification).
// Nombre custom porque Supabase reserva el prefijo SUPABASE_* en secrets.
// Setear con: `supabase secrets set SB_JWT_SECRET=<legacy-jwt-secret>`.
const SB_JWT_SECRET = Deno.env.get("SB_JWT_SECRET");
// Duración del Supabase JWT minteado. Corto (15 min) para forzar refresh
// vía exchange — si Privy revoca, perdemos acceso en máximo 15 min.
const TOKEN_TTL_SECONDS = 15 * 60;

if (!PRIVY_APP_ID || !SB_JWT_SECRET) {
  console.error("[auth-exchange] missing env: PRIVY_APP_ID or SB_JWT_SECRET");
}

const JWKS = PRIVY_APP_ID
  ? createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`))
  : null;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST" },
    });
  }
  if (!JWKS || !PRIVY_APP_ID || !SB_JWT_SECRET) {
    return jsonResponse({ error: "fn_misconfigured" }, 500);
  }

  // 1. Extract Privy JWT.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "missing_bearer" }, 401);
  }
  const privyToken = authHeader.slice("Bearer ".length).trim();
  if (!privyToken) return jsonResponse({ error: "empty_token" }, 401);

  // 2. Verify Privy JWT con JWKS.
  let privyDid: string;
  try {
    const { payload } = await jwtVerify(privyToken, JWKS, {
      issuer: "privy.io",
      audience: PRIVY_APP_ID,
    });
    if (typeof payload.sub !== "string" || !payload.sub.startsWith("did:privy:")) {
      return jsonResponse({ error: "invalid_subject" }, 401);
    }
    privyDid = payload.sub;
  } catch (err) {
    console.warn("[auth-exchange] privy jwt verify failed:", String(err));
    return jsonResponse({ error: "invalid_token" }, 401);
  }

  // 3. Mint Supabase JWT.
  // Claims requeridos por Supabase para que el JWT funcione con RLS:
  // - `sub`: identidad — usamos el Privy DID directo (el column profiles.id es text).
  // - `role`: "authenticated" — Supabase lo usa para gating queries.
  // - `aud`: "authenticated" — convención Supabase.
  // - `iss`: identifies issuer — algunos checks lo requieren matching.
  // - `iat`/`exp`: standard.
  const now = Math.floor(Date.now() / 1000);
  const secretBytes = new TextEncoder().encode(SB_JWT_SECRET);

  const supabaseJwt = await new SignJWT({
    sub: privyDid,
    role: "authenticated",
    aud: "authenticated",
    // Custom claim — útil en el futuro si las RLS quieren gating extra
    // basado en el origin del JWT (post-1.04 KYC level, etc).
    privy_did: privyDid,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .setIssuer("auth-exchange")
    .sign(secretBytes);

  return jsonResponse(
    {
      access_token: supabaseJwt,
      token_type: "bearer",
      expires_in: TOKEN_TTL_SECONDS,
      sub: privyDid,
    },
    200,
  );
});
