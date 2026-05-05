import { createLogger } from "@moneto/utils";
import { HTTPException } from "hono/http-exception";
import { createRemoteJWKSet, jwtVerify, type JWTPayload, errors as joseErrors } from "jose";

import type { MiddlewareHandler } from "hono";

const log = createLogger("auth.middleware");

/**
 * Claims que esperamos en cada Privy JWT verificado.
 *
 * `sub` = Privy DID (`did:privy:xxx`).
 * `iss` = `"privy.io"`.
 * `aud` = el PRIVY_APP_ID del environment.
 */
export interface AuthClaims extends JWTPayload {
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

/**
 * Hono module augmentation para inyectar tipos en `c.get()` / `c.set()`.
 */
declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    claims: AuthClaims;
  }
}

/**
 * JWKS singleton por app ID (rare que cambie en runtime, pero el cache
 * por ID hace el código safe si en el futuro tenemos multi-tenant).
 *
 * jose maneja el cache HTTP internamente — `cooldownDuration` evita
 * stampede si la JWKS rotó, `cacheMaxAge` lo refresha proactivo.
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(privyAppId: string) {
  let jwks = jwksCache.get(privyAppId);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://auth.privy.io/api/v1/apps/${privyAppId}/jwks.json`),
      {
        cooldownDuration: 60_000, // re-fetch JWKS no más frecuente que 60s
        cacheMaxAge: 600_000, // mantener cache 10 min
      },
    );
    jwksCache.set(privyAppId, jwks);
  }
  return jwks;
}

/**
 * Hono middleware que valida JWTs de Privy en `Authorization: Bearer <token>`.
 *
 * Comportamiento:
 * - Sin header / sin "Bearer " prefix → 401 `missing_bearer`.
 * - JWT inválido (firma, expiry, issuer, audience) → 401 `invalid_token`.
 * - Falla server-side (PRIVY_APP_ID ausente) → 500.
 * - OK → set `userId` + `claims` en context, llama `next()`.
 *
 * **Nunca** loggea el token raw o claims completos (PII potencial). Solo
 * el path + error type. Ver `docs/observability/conventions.md`.
 *
 * @example
 *   app.use("/api/*", authMiddleware());
 *   app.get("/api/me", (c) => c.json({ userId: c.get("userId") }));
 */
export function authMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      log.warn("auth missing_bearer", { path: c.req.path });
      throw new HTTPException(401, { message: "missing_bearer" });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      throw new HTTPException(401, { message: "empty_token" });
    }

    // PRIVY_APP_ID puede vivir en `c.env` (binding), `.dev.vars` local,
    // o wrangler secret en cloud. Si falta, el worker está mal configurado.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- c.env shape varía por app, validamos en runtime
    const privyAppId = (c.env as any)?.PRIVY_APP_ID as string | undefined;
    if (!privyAppId) {
      log.error("PRIVY_APP_ID missing in env — worker misconfigured");
      throw new HTTPException(500, { message: "server_misconfigured" });
    }

    try {
      const { payload } = await jwtVerify(token, getJWKS(privyAppId), {
        issuer: "privy.io",
        audience: privyAppId,
      });

      // Validación extra: sub debe ser Privy DID (defensa contra tokens
      // de otra app que casualmente compartan issuer/audience).
      if (typeof payload.sub !== "string" || !payload.sub.startsWith("did:privy:")) {
        throw new HTTPException(401, { message: "invalid_subject" });
      }

      const claims = payload as AuthClaims;
      c.set("userId", claims.sub);
      c.set("claims", claims);

      await next();
      return;
    } catch (err) {
      // No leakear el token o claims al log — solo el error type.
      const errorType = classifyJoseError(err);
      log.warn("auth failure", { path: c.req.path, errorType });

      if (err instanceof HTTPException) throw err;
      throw new HTTPException(401, { message: "invalid_token" });
    }
  };
}

/**
 * Categoriza errores de jose en buckets para Axiom queries / Sentry tags.
 * No incluye el message raw del error (puede tener token fragments).
 */
function classifyJoseError(err: unknown): string {
  if (err instanceof joseErrors.JWTExpired) return "expired";
  if (err instanceof joseErrors.JWTClaimValidationFailed) return "claim_invalid";
  if (err instanceof joseErrors.JWSSignatureVerificationFailed) return "signature_invalid";
  if (err instanceof joseErrors.JWSInvalid) return "malformed";
  if (err instanceof joseErrors.JWKSNoMatchingKey) return "kid_mismatch";
  if (err instanceof joseErrors.JOSEError) return "jose_other";
  return "unknown";
}

/**
 * Helper para extraer `userId` de routes protegidos. Usar en handlers
 * `/api/*` después de que `authMiddleware` corrió.
 */
export function requireUserId(c: { get: (k: "userId") => string | undefined }): string {
  const userId = c.get("userId");
  if (!userId) {
    throw new HTTPException(500, {
      message: "userId missing in context — authMiddleware not applied?",
    });
  }
  return userId;
}
