import { getAsset, type AssetId } from "@moneto/types";
import { createLogger } from "@moneto/utils";

const log = createLogger("price.service");

/**
 * PriceService — abstracción sobre la fuente de precio spot. Sprint 3.03
 * implementación real (Pyth Hermes V2 HTTP API). Sprint 3.02 quedó en
 * stub; el `BalanceService` no necesita cambiar — la interface es la misma.
 *
 * Por qué interface explícita: el `BalanceService` y el `/api/prices`
 * router consumen solo el shape, no Pyth en sí. Si en el futuro
 * cambiamos a Switchboard / Triton / agregador propio, swap es DI sin
 * tocar callers.
 */
export interface PriceService {
  /**
   * Spot price del asset en USD. Para stables retorna 1 (peg) — para
   * stables locales aplica FX rate hardcoded. Para volátiles fetcha
   * de Pyth Hermes con cache 5s + fallback a stale cache.
   *
   * Nunca throw — devuelve `null` si no hay price disponible (ej.
   * Pyth down sin cache stale). El caller decide fallback (mostrar
   * "—" o usar default).
   */
  getSpotUsd(id: AssetId): Promise<number | null>;

  /**
   * Cambio 24h del precio del asset. Decimal (`0.032` = +3.2%).
   * Retorna `null` si no hay data o si es stable.
   */
  get24hChange(id: AssetId): Promise<number | null>;

  /**
   * Read completo con metadata: precio + freshness + confidence.
   * Usado por `/api/prices/:id` para que el mobile pueda mostrar
   * badge "Precio actualizando…" cuando `isStale: true`.
   */
  getPriceWithMeta(id: AssetId): Promise<PriceMeta | null>;
}

export interface PriceMeta {
  /** Spot USD price. */
  price: number;
  /** Pyth confidence interval (USD). 0 si stable / no aplica. */
  confidence: number;
  /** Epoch ms. 0 si stable / no aplica. */
  publishTime: number;
  /** True si el último update fue hace >30s — UI debería badge "actualizando…". */
  isStale: boolean;
  /** Source de este precio: `pyth-fresh` | `pyth-stale-cache` | `peg` | `fx-hardcoded`. */
  source: PriceSource;
}

export type PriceSource = "pyth-fresh" | "pyth-stale-cache" | "peg" | "fx-hardcoded";

// ─────────────────────────────────────────────────────────────────────
// FX rates para stables locales — TODO real source post-MVP
// ─────────────────────────────────────────────────────────────────────

/**
 * Hardcoded FX rates: 1 unit local = X USD. Updated manualmente cada
 * quarter (currency pegs son slow-moving). Sprint 6+ wirea Open
 * Exchange Rates API o Pyth FX feeds para refresh automático.
 *
 * Las stables locales (COPm, MXNB, BRZ, ARST) están peggeadas a su
 * fiat correspondiente; este es el ratio FX para mostrar el equivalent
 * USD en la UI.
 *
 * Rates aproximados a marzo 2026.
 */
const FX_RATES_TO_USD: Partial<Record<AssetId, number>> = {
  cop: 1 / 4250, // ~$0.000235
  mxn: 1 / 17.5, // ~$0.057
  brl: 1 / 5.0, // ~$0.20
  ars: 1 / 950, // ~$0.001
};

const EUR_TO_USD = 1.08;

// ─────────────────────────────────────────────────────────────────────
// Pyth Hermes V2 client (HTTP)
// ─────────────────────────────────────────────────────────────────────

const PYTH_HERMES_BASE = "https://hermes.pyth.network";
const CACHE_TTL_MS = 5_000;
const STALE_THRESHOLD_MS = 30_000;
const FETCH_TIMEOUT_MS = 5_000;

/**
 * Subset del response de `GET /v2/updates/price/latest?ids[]=...`.
 * Tipado conservador — solo lo que consumimos.
 */
interface HermesParsedPriceFeed {
  id: string;
  price: {
    price: string; // raw integer as string
    conf: string;
    expo: number;
    publish_time: number; // epoch seconds
  };
  ema_price?: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
}

interface HermesLatestResponse {
  parsed?: HermesParsedPriceFeed[];
}

interface CachedPyth {
  price: number;
  confidence: number;
  publishTimeMs: number;
  cachedAt: number;
}

/**
 * Real PriceService — Pyth Hermes V2 HTTP API.
 *
 * **Por qué fetch directo y NO `@pythnetwork/price-service-client`**:
 * - El SDK pulls `@solana/web3.js` polyfills + crypto stuff que no
 *   necesitamos en Workers.
 * - Bundle weight de Workers importa.
 * - Hermes V2 HTTP API es estable + simple: `GET /v2/updates/price/latest`.
 *
 * **Caching**: 5s TTL por asset. Stale cache (>5s) se sirve si Pyth
 * falla. >30s la respuesta se marca `isStale: true` para que el UI
 * muestre badge "actualizando…".
 *
 * **NO** confiar en stale cache para money-moving operations
 * (Sprint 3.06 swap UI bloquea swaps con stale > N seconds).
 */
export class PythPriceService implements PriceService {
  private cache: Map<AssetId, CachedPyth> = new Map();

  async getSpotUsd(id: AssetId): Promise<number | null> {
    const meta = await this.getPriceWithMeta(id);
    return meta?.price ?? null;
  }

  async get24hChange(id: AssetId): Promise<number | null> {
    const meta = getAsset(id);
    if (meta.category !== "volatile") return null;
    // Sprint 3.03 stub: Pyth Hermes V2 no expone 24h change directo.
    // Sprint 5+ wireamos Coingecko Pro o Birdeye API. Mientras tanto,
    // mocks realistas para que la UI no muestre 0% always.
    const stub: Record<string, number> = {
      sol: 0.018,
      btc: 0.032,
      eth: -0.008,
    };
    return stub[id] ?? null;
  }

  async getPriceWithMeta(id: AssetId): Promise<PriceMeta | null> {
    const meta = getAsset(id);

    // Stables: peg + FX, no Pyth fetch.
    if (meta.category === "stable_usd") {
      return { price: 1, confidence: 0, publishTime: 0, isStale: false, source: "peg" };
    }
    if (meta.category === "stable_eur") {
      return {
        price: EUR_TO_USD,
        confidence: 0,
        publishTime: 0,
        isStale: false,
        source: "fx-hardcoded",
      };
    }
    if (meta.category === "stable_local") {
      const rate = FX_RATES_TO_USD[meta.id];
      if (rate === undefined) return null;
      return {
        price: rate,
        confidence: 0,
        publishTime: 0,
        isStale: false,
        source: "fx-hardcoded",
      };
    }

    // Volatile: Pyth fetch.
    if (!meta.pythPriceFeedId) {
      log.error("missing pyth feed", { assetId: id });
      return null;
    }

    // Cache hit.
    const cached = this.cache.get(id);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return this.makeMeta(cached, "pyth-fresh");
    }

    // Cache miss: fetch.
    try {
      const fresh = await this.fetchPyth(id, meta.pythPriceFeedId);
      this.cache.set(id, fresh);
      return this.makeMeta(fresh, "pyth-fresh");
    } catch (err) {
      log.warn("pyth fetch failed", { assetId: id, err: String(err) });
      // Fallback a stale cache si existe.
      if (cached) {
        return this.makeMeta(cached, "pyth-stale-cache");
      }
      return null;
    }
  }

  private makeMeta(c: CachedPyth, source: PriceSource): PriceMeta {
    const isStale = Date.now() - c.publishTimeMs > STALE_THRESHOLD_MS;
    return {
      price: c.price,
      confidence: c.confidence,
      publishTime: c.publishTimeMs,
      isStale,
      source,
    };
  }

  /**
   * Llamada a Hermes V2 — `GET /v2/updates/price/latest?ids[]=<feed>`.
   * Retorna el precio decoded (price * 10^expo) + confidence en USD.
   *
   * Timeout de 5s — Pyth Hermes p95 es <300ms; cualquier cosa >5s es
   * un degradation real, queremos fallback a stale cache.
   *
   * Sanity check: si `publish_time > now + 60s` (clock skew exotic),
   * rechazamos como suspicious.
   */
  private async fetchPyth(id: AssetId, feedId: string): Promise<CachedPyth> {
    const url = `${PYTH_HERMES_BASE}/v2/updates/price/latest?ids[]=${encodeURIComponent(feedId)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(`hermes_status_${res.status}`);
    }

    const data = (await res.json()) as HermesLatestResponse;
    const feed = data.parsed?.[0];
    if (!feed) {
      throw new Error("hermes_no_feed");
    }

    const expo = feed.price.expo;
    const rawPrice = Number(feed.price.price);
    const rawConf = Number(feed.price.conf);
    const factor = Math.pow(10, expo);
    const price = rawPrice * factor;
    const confidence = rawConf * factor;

    // publish_time es epoch seconds en Hermes; convertir a ms.
    const publishTimeMs = feed.price.publish_time * 1000;
    const nowMs = Date.now();
    if (publishTimeMs > nowMs + 60_000) {
      log.error("pyth time travel", { assetId: id, publishTimeMs, nowMs });
      throw new Error("pyth_time_travel");
    }

    log.debug("pyth fetched", {
      assetId: id,
      // NO loggeamos el price exact — privacy + audit cleanliness.
      hasPrice: price > 0,
      ageMs: nowMs - publishTimeMs,
    });

    return {
      price,
      confidence,
      publishTimeMs,
      cachedAt: nowMs,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Stub fallback (legacy / tests / devnet)
// ─────────────────────────────────────────────────────────────────────

/**
 * Stub price service — usado en tests + dev environments sin internet.
 * Hardcoded prices realistas a marzo 2026.
 */
const STUB_VOLATILE_PRICES: Record<string, { spot: number; change24h: number }> = {
  sol: { spot: 185, change24h: 0.018 },
  btc: { spot: 84_000, change24h: 0.032 },
  eth: { spot: 4_500, change24h: -0.008 },
};

export class StubPriceService implements PriceService {
  async getSpotUsd(id: AssetId): Promise<number | null> {
    const meta = (await this.getPriceWithMeta(id))?.price;
    return meta ?? null;
  }

  async get24hChange(id: AssetId): Promise<number | null> {
    const meta = getAsset(id);
    if (meta.category !== "volatile") return null;
    return STUB_VOLATILE_PRICES[id]?.change24h ?? null;
  }

  async getPriceWithMeta(id: AssetId): Promise<PriceMeta | null> {
    const meta = getAsset(id);
    if (meta.category === "stable_usd") {
      return { price: 1, confidence: 0, publishTime: 0, isStale: false, source: "peg" };
    }
    if (meta.category === "stable_eur") {
      return {
        price: EUR_TO_USD,
        confidence: 0,
        publishTime: 0,
        isStale: false,
        source: "fx-hardcoded",
      };
    }
    if (meta.category === "stable_local") {
      const rate = FX_RATES_TO_USD[meta.id];
      if (rate === undefined) return null;
      return {
        price: rate,
        confidence: 0,
        publishTime: 0,
        isStale: false,
        source: "fx-hardcoded",
      };
    }
    const stub = STUB_VOLATILE_PRICES[id];
    if (!stub) return null;
    return {
      price: stub.spot,
      confidence: 0,
      publishTime: Date.now(),
      isStale: false,
      source: "pyth-fresh",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────

export interface PriceServiceEnv {
  /**
   * Si `"true"` (default), usa `PythPriceService`. Cualquier otro
   * valor (e.g., `"false"` para tests / devnet sin red) usa
   * `StubPriceService`.
   */
  USE_PYTH?: string;
}

/**
 * Module-scope singleton para reuse del cache entre requests del mismo
 * worker isolate. Cloudflare Workers reusan isolates ~minutos entre
 * requests; el cache 5s es siempre fresh dentro de eso.
 */
let pythSingleton: PythPriceService | null = null;
let stubSingleton: StubPriceService | null = null;

export function createPriceService(env: PriceServiceEnv = {}): PriceService {
  // Default a Pyth — explicit opt-out con `USE_PYTH=false` en .dev.vars
  // para correr tests sin internet.
  if (env.USE_PYTH === "false") {
    if (!stubSingleton) stubSingleton = new StubPriceService();
    return stubSingleton;
  }
  if (!pythSingleton) pythSingleton = new PythPriceService();
  return pythSingleton;
}
