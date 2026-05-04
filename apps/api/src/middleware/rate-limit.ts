import type { MiddlewareHandler } from "hono";

/**
 * Token-bucket rate limiter para Cloudflare Workers.
 *
 * Cuando hay un KV binding (`RATE_LIMITS`), persiste el contador en KV —
 * funciona consistente entre isolates. Sin KV (dev local sin binding),
 * cae a un Map in-memory por isolate (suficiente para sanity check, NO
 * para producción real con varios isolates).
 *
 * Identifier por default: IP del cliente desde `CF-Connecting-IP`. Para
 * routes auth-aware, override con `keyFn` (e.g., `userId` post-JWT).
 *
 * @example
 *   app.post("/auth/login", rateLimit({ limit: 5, windowSeconds: 60 }), handler);
 *   app.post("/send", rateLimit({ limit: 10, windowSeconds: 60, keyFn: c => c.get("userId") }), handler);
 */

export interface RateLimitOptions {
  /** Max requests permitidos en la ventana. */
  limit: number;
  /** Tamaño de la ventana en segundos. */
  windowSeconds: number;
  /**
   * Función para construir el key del bucket. Default: IP del cliente.
   * Override para usar `userId` (post-auth) o cualquier otro discriminator.
   */
  keyFn?: (c: {
    req: { header: (n: string) => string | undefined };
    var: Record<string, unknown>;
  }) => string;
  /** Prefix para namespace los keys en KV. Default `"rl:"`. */
  prefix?: string;
}

interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface BucketState {
  count: number;
  resetAt: number;
}

// Fallback in-memory store por isolate. Solo para dev local — workers de
// producción comparten KV. Cap el size para que no crezca sin límite.
const MEMORY_STORE = new Map<string, BucketState>();
const MEMORY_MAX_KEYS = 10_000;

function memoryStoreEvict() {
  if (MEMORY_STORE.size <= MEMORY_MAX_KEYS) return;
  // Evict 10% más antiguos (cheap LRU approximation).
  const entries = Array.from(MEMORY_STORE.entries());
  entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
  for (let i = 0; i < MEMORY_MAX_KEYS / 10; i++) {
    const entry = entries[i];
    if (entry) MEMORY_STORE.delete(entry[0]);
  }
}

function defaultKey(c: { req: { header: (n: string) => string | undefined } }): string {
  // CF setea CF-Connecting-IP automáticamente. X-Forwarded-For es fallback
  // en dev (wrangler local lo provee).
  const ip =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown";
  return ip;
}

/**
 * Lee + incrementa el bucket. Atomic-ish: en KV no es real CAS pero la
 * window resetea cada `windowSeconds` así que las race conditions son
 * absorbed (peor caso: 2 requests suben el counter de 4 a 6 en lugar de a 5).
 *
 * Para garantías hard usar Durable Objects (Sprint 2.x cuando levantemos DO).
 */
async function checkBucket(
  store: KVNamespaceLike | null,
  fullKey: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Math.floor(Date.now() / 1000);

  if (store) {
    const raw = await store.get(fullKey);
    let state: BucketState = raw
      ? (JSON.parse(raw) as BucketState)
      : { count: 0, resetAt: now + windowSeconds };

    if (state.resetAt <= now) {
      state = { count: 0, resetAt: now + windowSeconds };
    }

    state.count += 1;
    const allowed = state.count <= limit;
    const ttl = state.resetAt - now;

    await store.put(fullKey, JSON.stringify(state), { expirationTtl: Math.max(ttl, 1) });

    return { allowed, remaining: Math.max(0, limit - state.count), resetAt: state.resetAt };
  }

  // In-memory fallback.
  let state = MEMORY_STORE.get(fullKey);
  if (!state || state.resetAt <= now) {
    state = { count: 0, resetAt: now + windowSeconds };
  }
  state.count += 1;
  MEMORY_STORE.set(fullKey, state);
  memoryStoreEvict();

  return {
    allowed: state.count <= limit,
    remaining: Math.max(0, limit - state.count),
    resetAt: state.resetAt,
  };
}

/**
 * Construye un middleware Hono que aplica rate limit al endpoint donde
 * se monta. Setea headers `RateLimit-*` (RFC draft) en cada response.
 * Cuando el bucket sobrepasa el limit, retorna `429 Too Many Requests`
 * con `Retry-After` header.
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { limit, windowSeconds, keyFn = defaultKey, prefix = "rl:" } = options;

  return async (c, next) => {
    // KV binding optional — cuando no existe, fallback in-memory.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- env shape varies por app, validamos shape al usar.
    const env = c.env as any;
    const store: KVNamespaceLike | null =
      env?.RATE_LIMITS && typeof env.RATE_LIMITS.get === "function" ? env.RATE_LIMITS : null;

    const key = keyFn(c);
    const fullKey = `${prefix}${key}`;

    const { allowed, remaining, resetAt } = await checkBucket(store, fullKey, limit, windowSeconds);

    c.header("RateLimit-Limit", String(limit));
    c.header("RateLimit-Remaining", String(remaining));
    c.header("RateLimit-Reset", String(resetAt));

    if (!allowed) {
      const retryAfter = Math.max(1, resetAt - Math.floor(Date.now() / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: "rate_limit_exceeded",
          retry_after_seconds: retryAfter,
        },
        429,
      );
    }

    await next();
    return undefined;
  };
}

/**
 * Presets sensatos para los routes más comunes. Usar como starting point;
 * ajustar por feature en el call-site.
 */
export const RATE_LIMIT_PRESETS = {
  /** Auth endpoints — agresivo para prevenir brute force. */
  auth: { limit: 5, windowSeconds: 60 },
  /** Money movement — moderate (usuario humano legítimo no manda 20/min). */
  money: { limit: 10, windowSeconds: 60 },
  /** Read-only endpoints — tolerante. */
  read: { limit: 60, windowSeconds: 60 },
  /** Webhooks externos (Helius, Privy) — alto pero no infinito. */
  webhook: { limit: 100, windowSeconds: 60 },
  /** Health checks de uptime monitors — ilimitado de facto. */
  health: { limit: 600, windowSeconds: 60 },
} as const;
