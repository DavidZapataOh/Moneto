import { EnvironmentSchema, type Environment } from "@moneto/config";
import {
  axiomSink,
  flushAxiom,
  scrubObject,
  sentryWorkersConfig,
  type AxiomLikeClient,
} from "@moneto/observability";
import { createLogger, setLogSink, setMinLogLevel } from "@moneto/utils";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import { corsMiddleware } from "./middleware/cors";

type Bindings = {
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  SENTRY_DSN?: string;
  AXIOM_TOKEN?: string;
  AXIOM_DATASET?: string;
};

const SERVICE_NAME = "moneto-api";

const log = createLogger("api");

/**
 * Resuelve el environment de los bindings del worker. Defaults a
 * "development" cuando falta (e.g., `wrangler dev` sin `.dev.vars`).
 */
function resolveEnv(envBinding: string | undefined): Environment {
  const result = EnvironmentSchema.safeParse(envBinding);
  return result.success ? result.data : "development";
}

/**
 * Boot-once por Worker isolate. CF reusa isolates entre requests, así que
 * setear el sink/min-level una sola vez es suficiente. Idempotent — si el
 * isolate cierra y arranca de nuevo, este flag se resetea junto al global state.
 */
let observabilityBooted = false;
let axiomClientForFlush: AxiomLikeClient | null = null;

async function bootObservability(env: Bindings): Promise<void> {
  if (observabilityBooted) return;
  observabilityBooted = true;

  const resolved = resolveEnv(env.ENVIRONMENT);

  // Log level por env: prod = warn (silenciar info noise),
  // staging = info, dev = debug.
  const minLevel =
    env.LOG_LEVEL === "debug" || env.LOG_LEVEL === "info" || env.LOG_LEVEL === "warn"
      ? env.LOG_LEVEL
      : resolved === "production"
        ? "warn"
        : resolved === "staging"
          ? "info"
          : "debug";
  setMinLogLevel(minLevel);

  // Axiom sink — solo si el token está set. Importamos el SDK lazily
  // para no pagar el bundle si la app no lo configura.
  if (env.AXIOM_TOKEN) {
    try {
      const { Axiom } = await import("@axiomhq/js");
      const client = new Axiom({ token: env.AXIOM_TOKEN });
      axiomClientForFlush = client;
      setLogSink(
        axiomSink(client, {
          dataset: env.AXIOM_DATASET ?? SERVICE_NAME,
          env: resolved,
          alsoConsole: resolved !== "production",
        }),
      );
      log.info("axiom sink ready", { dataset: env.AXIOM_DATASET ?? SERVICE_NAME });
    } catch (err) {
      console.warn("[boot] axiom init failed:", err);
    }
  }

  // Sentry — config builder ya no-op si DSN ausente. La SDK Cloudflare se
  // wrap-ea con `Sentry.withSentry()` en el export default abajo.
  const sentryConfig = sentryWorkersConfig({ dsn: env.SENTRY_DSN, env: resolved });
  if (sentryConfig.enabled) {
    log.info("sentry will instrument worker", { env: resolved });
  }
}

const app = new Hono<{ Bindings: Bindings; Variables: { env: Environment } }>();

app.use("*", async (c, next) => {
  await bootObservability(c.env);
  c.set("env", resolveEnv(c.env.ENVIRONMENT));
  await next();
});

app.use("*", honoLogger());
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
  // Scrub error message + stack antes de loggear (defensa en profundidad —
  // el sink de Axiom ya scrubs, pero el console.error de fallback no).
  const scrubbed = scrubObject({
    name: err.name,
    message: err.message,
    stack: err.stack,
    route: c.req.path,
    method: c.req.method,
  });
  log.error("unhandled error", scrubbed);
  return c.json({ error: "internal_error" }, 500);
});

/**
 * Worker entrypoint. Wrappea el app de Hono con `Sentry.withSentry()`
 * cuando hay DSN — el wrapper captura excepciones uncaught + tracing.
 *
 * El `withSentry` también garantiza que `ctx.waitUntil(...)` se dispara para
 * flushar cualquier event in-flight antes de que el isolate termine.
 */
export default {
  async fetch(
    request: Request,
    env: Bindings,
    ctx: { waitUntil: (promise: Promise<unknown>) => void },
  ): Promise<Response> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (app.fetch as any)(request, env, ctx);
    } finally {
      // Flush Axiom antes de que el isolate termine — Workers caps execution
      // tiempo y los logs in-buffer se perderían sin esto.
      if (axiomClientForFlush) {
        ctx.waitUntil(flushAxiom(axiomClientForFlush));
      }
    }
  },
};
