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

  /**
   * Histórico de precios para charts (Sprint 3.05). Retorna una lista
   * de candle/closes ordenados por timestamp ascending.
   *
   * Solo retorna data para volátiles (SOL/BTC/ETH) por ahora —
   * stables-yielding history (yield earned over time) viene en
   * Sprint 5+ con Reflect/Huma APIs.
   *
   * Retorna `null` si:
   * - El asset no tiene historical source disponible.
   * - El backend está degradado y no podemos servir.
   *
   * El UI debería render un empty state ("Sin historial disponible")
   * cuando `null`.
   */
  getPriceHistory(id: AssetId, range: PriceHistoryRange): Promise<PriceHistory | null>;
}

/** Time range buckets — match con UI selector chips. */
export type PriceHistoryRange = "1H" | "1D" | "7D" | "30D" | "1Y" | "ALL";

export interface PriceHistoryPoint {
  /** Epoch ms. */
  t: number;
  /** Close price USD. */
  price: number;
}

export interface PriceHistory {
  range: PriceHistoryRange;
  /** Puntos ascending por t. */
  points: PriceHistoryPoint[];
  /** Source de este histórico. */
  source: "pyth-benchmarks" | "stub";
  fetchedAt: number;
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

  // ─── Historical (Sprint 3.05) ─────────────────────────────────────

  /**
   * Pyth Benchmarks (`benchmarks.pyth.network`) ofrece el TradingView
   * shim con histórico de candles. Free tier sin API key.
   *
   * Endpoint: `/v1/shims/tradingview/history?symbol=Crypto.SOL/USD&from=<unix>&to=<unix>&resolution=<m>`
   * Resoluciones soportadas: `1`, `5`, `15`, `30`, `60`, `240`, `D`, `W`.
   *
   * Cache 5min en module scope — historical data no cambia hasta el
   * próximo close del candle. Reduce hits en demos donde varios users
   * ven el mismo asset.
   */
  async getPriceHistory(id: AssetId, range: PriceHistoryRange): Promise<PriceHistory | null> {
    const meta = getAsset(id);
    if (meta.category !== "volatile") {
      // Stables: no historical price (peg). Sprint 5+ wirea yield-earned
      // history para stables yielding (USDG/PYUSD).
      return null;
    }

    const symbol = pythBenchmarkSymbol(id);
    if (!symbol) return null;

    const cacheKey = `${id}:${range}`;
    const cached = historyCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < HISTORY_CACHE_TTL_MS) {
      return cached.history;
    }

    const { from, to, resolution } = computeRangeWindow(range);
    const url = `${PYTH_BENCHMARKS_BASE}/v1/shims/tradingview/history?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&resolution=${resolution}`;

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        log.warn("benchmarks non-2xx", { id, range, status: res.status });
        return cached?.history ?? null;
      }
      const data = (await res.json()) as PythBenchmarksResponse;
      // Pyth Benchmarks retorna `s: "ok" | "no_data"` + arrays paralelos.
      if (data.s !== "ok" || !Array.isArray(data.t) || !Array.isArray(data.c)) {
        log.warn("benchmarks no data", { id, range, status: data.s });
        return cached?.history ?? null;
      }

      const points: PriceHistoryPoint[] = [];
      for (let i = 0; i < data.t.length; i++) {
        const t = data.t[i];
        const c = data.c[i];
        if (typeof t === "number" && typeof c === "number" && Number.isFinite(c)) {
          points.push({ t: t * 1000, price: c });
        }
      }

      const history: PriceHistory = {
        range,
        points,
        source: "pyth-benchmarks",
        fetchedAt: Date.now(),
      };
      historyCache.set(cacheKey, { history, fetchedAt: history.fetchedAt });
      return history;
    } catch (err) {
      log.warn("benchmarks fetch failed", { id, range, err: String(err) });
      return cached?.history ?? null;
    }
  }
}

/**
 * Pyth Benchmarks symbol mapping. Sprint 3.05 cubre los 3 volátiles
 * que tienen Pyth feed; cuando expandamos a más volátiles se mapean acá.
 */
function pythBenchmarkSymbol(id: AssetId): string | null {
  switch (id) {
    case "sol":
      return "Crypto.SOL/USD";
    case "btc":
      return "Crypto.BTC/USD";
    case "eth":
      return "Crypto.ETH/USD";
    default:
      return null;
  }
}

const PYTH_BENCHMARKS_BASE = "https://benchmarks.pyth.network";
const HISTORY_CACHE_TTL_MS = 5 * 60_000; // 5min — candles don't update intra-bar
const historyCache = new Map<string, { history: PriceHistory; fetchedAt: number }>();

interface PythBenchmarksResponse {
  s: "ok" | "no_data" | "error";
  t?: number[]; // timestamps unix seconds
  c?: number[]; // close prices
  o?: number[];
  h?: number[];
  l?: number[];
  v?: number[];
}

/**
 * Compute (from, to, resolution) tuple del range. Resolution se elige
 * para mantener ~50–365 puntos en el chart — suficiente para curva
 * suave sin sobre-densificar.
 *
 * Pyth Benchmarks resolutions:
 *  `1` (1m), `5`, `15`, `30`, `60` (1h), `240` (4h), `D` (1d), `W` (1w).
 */
function computeRangeWindow(range: PriceHistoryRange): {
  from: number;
  to: number;
  resolution: string;
} {
  const nowSec = Math.floor(Date.now() / 1000);
  switch (range) {
    case "1H":
      return { from: nowSec - 60 * 60, to: nowSec, resolution: "1" };
    case "1D":
      return { from: nowSec - 24 * 60 * 60, to: nowSec, resolution: "5" };
    case "7D":
      return { from: nowSec - 7 * 24 * 60 * 60, to: nowSec, resolution: "60" };
    case "30D":
      return { from: nowSec - 30 * 24 * 60 * 60, to: nowSec, resolution: "240" };
    case "1Y":
      return { from: nowSec - 365 * 24 * 60 * 60, to: nowSec, resolution: "D" };
    case "ALL":
      // Pyth has ~3y history para SOL/BTC/ETH — cap a 3y para evitar
      // empty heads when feed is younger.
      return { from: nowSec - 3 * 365 * 24 * 60 * 60, to: nowSec, resolution: "D" };
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

  /**
   * Sintetiza un histórico predecible para volátiles — usado en tests
   * + devnet. Genera ~50 puntos con random walk centered en el spot
   * stub. NO se usa para money-moving decisions (es signal solo de UI).
   */
  async getPriceHistory(id: AssetId, range: PriceHistoryRange): Promise<PriceHistory | null> {
    const meta = getAsset(id);
    if (meta.category !== "volatile") return null;

    const stub = STUB_VOLATILE_PRICES[id];
    if (!stub) return null;

    const N = 50;
    const nowMs = Date.now();
    const windowMs = rangeToWindowMs(range);
    const stepMs = windowMs / (N - 1);

    // Seeded random walk — determinístico per (id, range) para tests.
    const seed = id.charCodeAt(0) + range.charCodeAt(0);
    let prng = seed;
    const rand = () => {
      prng = (prng * 9301 + 49297) % 233280;
      return prng / 233280;
    };

    const points: PriceHistoryPoint[] = [];
    let price = stub.spot;
    for (let i = 0; i < N; i++) {
      // ±0.5% por step.
      const delta = (rand() - 0.5) * 0.01 * stub.spot;
      price = Math.max(0.01, price + delta);
      points.push({ t: nowMs - (N - 1 - i) * stepMs, price });
    }

    return {
      range,
      points,
      source: "stub",
      fetchedAt: nowMs,
    };
  }
}

function rangeToWindowMs(range: PriceHistoryRange): number {
  const HOUR = 60 * 60 * 1000;
  switch (range) {
    case "1H":
      return HOUR;
    case "1D":
      return 24 * HOUR;
    case "7D":
      return 7 * 24 * HOUR;
    case "30D":
      return 30 * 24 * HOUR;
    case "1Y":
      return 365 * 24 * HOUR;
    case "ALL":
      return 3 * 365 * 24 * HOUR;
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
