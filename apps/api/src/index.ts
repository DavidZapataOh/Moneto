import { EnvironmentSchema, type Environment } from "@moneto/config";
import {
  axiomSink,
  flushAxiom,
  sentryWorkersConfig,
  type AxiomLikeClient,
} from "@moneto/observability";
import { createLogger, setLogSink, setMinLogLevel } from "@moneto/utils";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import { authMiddleware } from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";
import { formatError, requestIdMiddleware } from "./middleware/error-handler";
import { rateLimit, RATE_LIMIT_PRESETS } from "./middleware/rate-limit";
import earlyAccessRoutes from "./routes/early-access";
import meRoutes from "./routes/me";
import pricesRoutes from "./routes/prices";
import publicPayRoutes from "./routes/public-pay";
import heliusWebhook from "./routes/webhooks/helius";

interface KVNamespaceBinding {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

type Bindings = {
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  SENTRY_DSN?: string;
  AXIOM_TOKEN?: string;
  AXIOM_DATASET?: string;
  /** Privy app ID (público — usado para validar `aud` claim de los JWTs). */
  PRIVY_APP_ID?: string;
  /** Supabase admin (service-role) — bypasses RLS, server-only. */
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** KV namespace para rate limit counters — opcional, fallback in-memory. */
  RATE_LIMITS?: KVNamespaceBinding;
  /** Helius API key (server-side only — Sprint 3.02). */
  HELIUS_API_KEY?: string;
  /** "mainnet-beta" | "devnet" — default mainnet-beta (Sprint 3.02). */
  SOLANA_NETWORK?: string;
  /** Si "false", PriceService usa Stub (devnet/tests). Default Pyth. */
  USE_PYTH?: string;
  /** Helius webhook shared secret — match al `authHeader` del dashboard. */
  HELIUS_WEBHOOK_SECRET?: string;
};

const SERVICE_NAME = "moneto-api";
// Versión actual del API — surface-able vía /version. Bump en cada release.
const API_VERSION = "0.1.0";

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

// 1. Boot observability + resolver env (corre primero, antes de error
//    handler, así los logs/tracing están listos al primer error).
app.use("*", async (c, next) => {
  await bootObservability(c.env);
  c.set("env", resolveEnv(c.env.ENVIRONMENT));
  await next();
});

// 2. Request ID — early, para que todos los logs/responses lo lleven.
//    El error formatting (incluso de HTTPException) se hace en `app.onError`
//    abajo — Hono v4 short-circuita HTTPException directo a onError, así
//    que no podemos atraparlas con un try/catch en middleware.
app.use("*", requestIdMiddleware());

// 3. Logging + security headers.
app.use("*", honoLogger());
app.use("*", secureHeaders());

// 4. CORS — allowlist por environment, resuelto dinámicamente al request.
app.use("*", async (c, next) => {
  const middleware = corsMiddleware(c.get("env"));
  return middleware(c, next);
});

// ─── Public routes ─────────────────────────────────────────────────────────
// Sin auth required. Rate limit tolerante para uptime monitors / clients.

app.get("/health", rateLimit(RATE_LIMIT_PRESETS.health), (c) =>
  c.json({
    status: "ok",
    service: SERVICE_NAME,
    env: c.get("env"),
    ts: new Date().toISOString(),
  }),
);

app.get("/version", rateLimit(RATE_LIMIT_PRESETS.read), (c) =>
  c.json({
    service: SERVICE_NAME,
    version: API_VERSION,
    env: c.get("env"),
  }),
);

// Stub de login — Sprint 1 ya delega a Privy, este endpoint queda como
// 501 hasta que tengamos un caso server-side de auth (e.g., webhook).
app.post("/auth/login", rateLimit(RATE_LIMIT_PRESETS.auth), (c) =>
  c.json(
    {
      error: {
        code: "not_implemented",
        message: "Auth via Privy embedded wallets — no server endpoint.",
      },
    },
    501,
  ),
);

// `/public/pay/*` — endpoint anónimo para resolver handle → walletAddress
// (Sprint 4.01 payroll links). Read-only, no PII más allá de campos
// públicos de profile. Rate-limited por IP (preset `read`).
app.use("/public/*", rateLimit(RATE_LIMIT_PRESETS.read));
app.route("/public/pay", publicPayRoutes);

// `/webhooks/*` — incoming webhooks de proveedores externos (Helius,
// Persona, etc.). Cada handler verifica su propio HMAC/auth header
// antes de tocar la DB. Sin Privy authMiddleware (los provider no
// emiten Privy JWTs).
app.route("/webhooks/helius", heliusWebhook);

// ─── Protected routes (`/api/*`) ───────────────────────────────────────────
// Auth + per-user rate limit. `userId` disponible en `c.get("userId")`.

// Auth middleware primero — si falla, el rate limit no corre (un atacker
// sin token no consume tu KV quota).
app.use("/api/*", authMiddleware());

// Per-user rate limit. `keyFn` extrae userId del context (ya seteado por
// authMiddleware). Preset `read` (60/min) — apropriado default; routes
// money-moving usarán presets más estrictos.
app.use(
  "/api/*",
  rateLimit({
    ...RATE_LIMIT_PRESETS.read,
    keyFn: (c) => {
      const userId = (c.var as { userId?: string }).userId;
      // Fallback a IP si por alguna razón no hay userId (no debería pasar
      // post-authMiddleware, pero defensa en profundidad).
      return userId ? `user:${userId}` : `ip:${c.req.header("CF-Connecting-IP") ?? "unknown"}`;
    },
    prefix: "rl:api:",
  }),
);

// `/api/me/*` — smoke + preferences (Sprint 1.05). El sub-router hereda
// el authMiddleware + per-user rate limit que se aplican arriba a `/api/*`.
app.route("/api/me", meRoutes);

// `/api/prices/*` — Pyth Hermes prices (Sprint 3.03). Cache 5s + stale
// fallback. Hereda authMiddleware + rate limit per-user.
app.route("/api/prices", pricesRoutes);

// `/api/early-access/*` — waitlist para features no live todavía
// (bridges Sprint 3.08). Idempotent upsert, marketing follow-up.
app.route("/api/early-access", earlyAccessRoutes);

// ─── Fallback handlers ─────────────────────────────────────────────────────

app.notFound((c) =>
  c.json(
    {
      error: {
        code: "not_found",
        message: "Endpoint no encontrado.",
        path: c.req.path,
      },
    },
    404,
  ),
);

// Global error handler — formatea TODO (HTTPException + unexpected) a JSON
// estructurado con `requestId`. HTTPException es flujo conocido (no log);
// unexpected dispara log.error + (futuro) Sentry capture.
app.onError(formatError);

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
