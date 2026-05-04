import { cors } from "hono/cors";

import type { Environment } from "@moneto/config";

/**
 * Origin allowlist por environment.
 *
 * Reglas:
 * - **dev**: localhost + Expo dev tunnel (`exp://`).
 * - **staging**: dominios staging del web + Expo dev tunnel para QA.
 * - **production**: SOLO el dominio público. Sin tunnel, sin localhost.
 *
 * `exp://` cubre Expo Go runtime + EAS preview builds (que arrancan con
 * scheme `exp://`). En production no se permite porque la app del store
 * usa scheme `moneto://` (universal links), no `exp://`.
 *
 * Si una ruta del API necesita ser accesible desde un origin no incluido,
 * agregar acá explícitamente — NUNCA usar wildcard `*` cuando hay
 * `credentials: true`.
 */
const ORIGIN_ALLOWLIST: Record<Environment, readonly string[]> = {
  development: [
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:19006",
    "exp://",
  ],
  staging: ["https://staging.moneto.xyz", "https://www.staging.moneto.xyz", "exp://"],
  production: ["https://moneto.xyz", "https://www.moneto.xyz"],
};

/**
 * Construye el middleware CORS para el environment dado.
 *
 * @example
 *   app.use("*", corsMiddleware("staging"));
 *
 * En production, un request con un origin no listado recibe 403 con CORS
 * headers vacíos (el browser bloquea la response al preflight).
 */
export function corsMiddleware(env: Environment) {
  const allowed = ORIGIN_ALLOWLIST[env];

  return cors({
    origin: (origin) => {
      if (!origin) return null;
      // `exp://` matching: cualquier origin que empiece con `exp://` (Expo
      // tunnels son `exp://192.168.x.x:8081`, `exp://exp.host/@user/app`, etc.)
      if (allowed.some((a) => a === "exp://" && origin.startsWith("exp://"))) {
        return origin;
      }
      return allowed.includes(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86400,
  });
}

/**
 * Re-export para tests.
 */
export const ORIGIN_ALLOWLIST_BY_ENV = ORIGIN_ALLOWLIST;
