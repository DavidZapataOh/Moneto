import { getAsset } from "@moneto/types";

import type { AssetId } from "@moneto/types";

/**
 * PriceService — abstracción sobre la fuente de precio spot. Sprint 3.02
 * lleva esta interface; Sprint 3.03 reemplaza el `StubPriceService` con
 * `PythPriceService` (Hermes API + on-chain verify).
 *
 * Por qué interface explícita: el `BalanceService` depende solo del
 * shape, no de Pyth. Cuando llegue Sprint 3.03, el swap es DI sin tocar
 * `BalanceService`.
 */
export interface PriceService {
  /**
   * Spot price del asset en USD. Para stables retorna 1 (o ~1 con
   * peg deviation cuando wireemos Pyth real). Para volátiles retorna
   * el último precio observado.
   *
   * Nunca throw — devuelve `null` si no hay price disponible. El caller
   * decide fallback (mostrar "—" o usar default).
   */
  getSpotUsd(id: AssetId): Promise<number | null>;

  /**
   * Cambio 24h del precio del asset. Retorna como decimal (`0.032` =
   * +3.2%), `null` si no hay data o si stable.
   */
  get24hChange(id: AssetId): Promise<number | null>;
}

/**
 * Stub price service — Sprint 3.02 implementation. Stables = 1 USD,
 * volátiles usan precios mock. Sprint 3.03 cuando wireemos Pyth Hermes
 * API, este module se reemplaza por `PythPriceService`.
 *
 * Defaults realistas (a marzo 2026):
 * - SOL: $185
 * - BTC: $84_000
 * - ETH: $4_500
 *
 * Estos números **NO** se usan para decisiones de money-moving — son
 * solo para alimentar el balance USD aggregation hasta que Pyth llegue.
 */
const STUB_VOLATILE_PRICES: Record<string, { spot: number; change24h: number }> = {
  sol: { spot: 185, change24h: 0.018 },
  btc: { spot: 84_000, change24h: 0.032 },
  eth: { spot: 4_500, change24h: -0.008 },
};

export class StubPriceService implements PriceService {
  async getSpotUsd(id: AssetId): Promise<number | null> {
    const meta = getAsset(id);
    if (meta.category === "stable_usd") return 1;
    // Stables locales: para Sprint 3.02 asumimos 1 USD = 1 unit (mocking
    // un peg perfecto). Sprint 3.03 + Sprint 6 wirean FX rates reales
    // (COP, MXN, BRL, ARS) — la UI mostrará el monto en moneda local.
    if (meta.category === "stable_local") return 1;
    if (meta.category === "stable_eur") return 1.08; // EUR ~ 1.08 USD
    const fallback = STUB_VOLATILE_PRICES[id];
    return fallback?.spot ?? null;
  }

  async get24hChange(id: AssetId): Promise<number | null> {
    const meta = getAsset(id);
    if (meta.category !== "volatile") return null;
    const fallback = STUB_VOLATILE_PRICES[id];
    return fallback?.change24h ?? null;
  }
}

/**
 * Factory: construye el price service apropiado según env. Hoy siempre
 * stub; Sprint 3.03 cambia a feature-flag + Pyth implementation.
 */
export function createPriceService(): PriceService {
  return new StubPriceService();
}
