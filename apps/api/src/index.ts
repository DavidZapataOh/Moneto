import { EnvironmentSchema, type Environment } from "@moneto/config";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import { corsMiddleware } from "./middleware/cors";

type Bindings = {
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
};

const SERVICE_NAME = "moneto-api";

/**
 * Resuelve el environment de los bindings del worker. Defaults to
 * "development" cuando falta (e.g., `wrangler dev` sin `.dev.vars`).
 */
function resolveEnv(envBinding: string | undefined): Environment {
  const result = EnvironmentSchema.safeParse(envBinding);
  return result.success ? result.data : "development";
}

const app = new Hono<{ Bindings: Bindings; Variables: { env: Environment } }>();

// Resolve env once per request, expose en context para middlewares y handlers.
app.use("*", async (c, next) => {
  c.set("env", resolveEnv(c.env.ENVIRONMENT));
  await next();
});

app.use("*", logger());
app.use("*", secureHeaders());

// CORS — allowlist por environment, resuelto dinámicamente al request.
app.use("*", async (c, next) => {
  const middleware = corsMiddleware(c.get("env"));
  return middleware(c, next);
});

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: SERVICE_NAME,
    env: c.get("env"),
    ts: new Date().toISOString(),
  }),
);

app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));

app.onError((err, c) => {
  console.error("[api] unhandled", err);
  return c.json({ error: "internal_error" }, 500);
});

export default app;
