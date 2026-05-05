import { scrubObject } from "@moneto/observability";
import { createLogger } from "@moneto/utils";
import { HTTPException } from "hono/http-exception";

import type { Context, ErrorHandler, MiddlewareHandler } from "hono";

const log = createLogger("api.errors");

/**
 * Hono module augmentation para tipo de `requestId`.
 */
declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

/**
 * Middleware que setea `requestId` en context + response header. Corre
 * UNA vez por request, antes de logger/auth/etc. Idempotent — usa
 * `X-Request-Id` del cliente si lo manda (`ApiClient` lo hace), sino
 * genera uno nuevo.
 *
 * **No** tiene try/catch — Hono v4 short-circuita `HTTPException` directo
 * a `app.onError`, así que el catch en middleware no atrapa esa subclass.
 * El error formatting va en `formatError` (registrar via `app.onError`).
 */
export function requestIdMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const requestId = c.req.header("X-Request-Id") ?? crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    await next();
  };
}

/**
 * Convierte cualquier error en una Response JSON con shape estable:
 *
 *   { "error": { "code": string, "message": string, "requestId": string } }
 *
 * - `HTTPException` (intencional): `code = err.message`, status = `err.status`.
 *   No se loggea como error (es flujo conocido — auth fail, rate limit, etc).
 * - Cualquier otra excepción: 500 + log con scrub + (futuro) Sentry capture.
 *
 * Wire en `index.ts` con `app.onError(formatError)`.
 */
export const formatError: ErrorHandler = (err, c: Context) => {
  const requestId = (c.get("requestId") as string | undefined) ?? "unknown";

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: {
          code: err.message,
          message: humanizeCode(err.message),
          requestId,
        },
      },
      err.status,
    );
  }

  // Unexpected — log + (futuro) Sentry capture.
  const scrubbed = scrubObject({
    path: c.req.path,
    method: c.req.method,
    requestId,
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  log.error("unhandled error", scrubbed);

  return c.json(
    {
      error: {
        code: "internal_error",
        message: "Algo salió mal de nuestro lado. Reintentá en unos segundos.",
        requestId,
      },
    },
    500,
  );
};

/**
 * Mensajes user-facing en español para los códigos de error comunes
 * que viajan en `HTTPException.message`. Cliente puede override con su
 * propio mapping si quiere copy custom por screen.
 */
function humanizeCode(code: string): string {
  switch (code) {
    case "missing_bearer":
      return "Falta el token de autenticación.";
    case "empty_token":
      return "El token de autenticación está vacío.";
    case "invalid_token":
      return "Tu sesión expiró o el token es inválido. Volvé a iniciar sesión.";
    case "invalid_subject":
      return "El token no es válido para esta aplicación.";
    case "server_misconfigured":
      return "El servidor está mal configurado. Estamos en eso.";
    case "rate_limit_exceeded":
      return "Demasiadas solicitudes. Esperá un momento e intentá de nuevo.";
    case "not_found":
      return "No encontramos lo que buscabas.";
    default:
      return code;
  }
}
