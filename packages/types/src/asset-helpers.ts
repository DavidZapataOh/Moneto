/**
 * Asset registry helpers — single source of resolución de mint, decimals,
 * formatting. Toda app (mobile, api, on-chain orchestrator) lee de acá
 * en lugar de hardcodes.
 */

import { ASSETS_REGISTRY } from "./assets";

import type { AssetId, AssetMeta, SolanaNetwork } from "./domain/asset";

/**
 * Resolve un AssetId al meta. Throw si el id no está en el registry —
 * preferimos fail-fast vs return undefined que se propaga silenciosamente.
 */
export function getAsset(id: AssetId): AssetMeta {
  const asset = ASSETS_REGISTRY[id];
  if (!asset) throw new Error(`Unknown asset: ${String(id)}`);
  return asset;
}

interface GetMintOptions {
  /** Si true, prefiere un underlying con `yieldBearing: true`. */
  yieldBearing?: boolean;
}

/**
 * Resolve el SPL mint pubkey para un AssetId.
 *
 * Por default retorna el mint marcado como `isPrimary` (el que se usa
 * para swaps + cashout). Con `yieldBearing: true`, prioriza un mint
 * yield-bearing si existe — útil para depositar saldo en USDG vs USDC.
 *
 * Si no hay primary explícito (legacy data), retorna el primer mint —
 * defensivo, NO debe pasar en data válida del registry.
 *
 * @example
 *   getMint("usd")                       // → USDC (primary)
 *   getMint("usd", { yieldBearing: true }) // → USDG (yield-bearing)
 *   getMint("sol")                       // → SO111…11112 (native wrapped)
 */
export function getMint(id: AssetId, options: GetMintOptions = {}): string {
  const asset = getAsset(id);
  const mints = asset.underlyingMints;
  if (mints.length === 0) {
    throw new Error(`Asset ${id} has no underlying mints — registry corrupt`);
  }

  if (options.yieldBearing) {
    const yb = mints.find((m) => m.yieldBearing);
    if (yb) return yb.mint;
  }

  const primary = mints.find((m) => m.isPrimary);
  // Si no hay primary marcado, fallback al primero del array. Defensivo.
  return primary?.mint ?? mints[0]!.mint;
}

/** Lista todos los underlying mints de un AssetId. Útil para indexers. */
export function getAllMints(id: AssetId): string[] {
  return getAsset(id).underlyingMints.map((m) => m.mint);
}

/** Decimals on-chain del asset. **Crítico** — wrapping bugs son caros. */
export function getDecimals(id: AssetId): number {
  return getAsset(id).decimals;
}

/**
 * Convert raw on-chain amount (bigint, native units) a display number.
 *
 * Ejemplo: USDC tiene 6 decimals. `1_000_000n` raw = `1.0` USDC display.
 *
 * Para `Number(amount)` con valores muy grandes (>2^53), perderíamos
 * precision. Acá usamos una simple division — los amounts retail no
 * exceden el safe integer range. Si en el futuro soportamos balances
 * institucionales >$10M, pasar a string-based decimal lib (e.g.
 * `bignumber.js`).
 */
export function rawToDisplay(amount: bigint, id: AssetId): number {
  const decimals = getDecimals(id);
  return Number(amount) / Math.pow(10, decimals);
}

/**
 * Convert display number a raw on-chain bigint.
 *
 * Floating-point precision: usamos `Math.round` para evitar errors tipo
 * `1.1 → 1099999n` por IEEE 754. Para 6 decimals, hasta ~$9 trillones es
 * safe. Para volátiles con 8-9 decimals, hasta ~$1B safe.
 */
export function displayToRaw(amount: number, id: AssetId): bigint {
  const decimals = getDecimals(id);
  return BigInt(Math.round(amount * Math.pow(10, decimals)));
}

/**
 * Format display amount con locale + decimals heuristic apropiada al
 * asset. Producción visual sin ambigüedad.
 *
 * Reglas:
 * - BTC: 8 decimals fijos (industria standard).
 * - SOL/ETH: 4 decimals si <1, 2 sino.
 * - COP/ARS: sin decimals (pesos enteros), separador es-CO.
 * - Default (USDC/EUR/etc): 2 decimals, separador en-US.
 */
export function formatBalance(amount: number, id: AssetId): string {
  if (id === "btc") return amount.toFixed(8);
  if (id === "sol" || id === "eth") {
    return amount < 1 ? amount.toFixed(4) : amount.toFixed(2);
  }
  if (id === "cop" || id === "ars") {
    return amount.toLocaleString("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Lista los assets enabled en el network actual. Mobile UI llama esto
 * para filtrar antes de render — un user en devnet no debe ver assets
 * que no existen en devnet (BTC, MXN, etc.).
 */
export function getEnabledAssets(network: SolanaNetwork): AssetMeta[] {
  return Object.values(ASSETS_REGISTRY).filter((a) => a.enabledOn.includes(network));
}

/**
 * Detecta si un mint pubkey corresponde a algún asset del registry.
 * Útil para parsear transactions on-chain — dado un mint, sabemos qué
 * AssetId maneja la UI.
 *
 * Retorna `null` si el mint no corresponde a ningún asset registrado
 * (ej. SPL random) — el caller decide si ignorar la tx o mostrarla
 * como "unknown".
 */
export function getAssetIdByMint(mint: string): AssetId | null {
  for (const asset of Object.values(ASSETS_REGISTRY)) {
    if (asset.underlyingMints.some((m) => m.mint === mint)) {
      return asset.id;
    }
  }
  return null;
}

/**
 * Type guard — verifica si un string es un `AssetId` valido del registry.
 * Útil para parsing de query params, deep links, push notif payloads.
 */
export function isAssetId(value: unknown): value is AssetId {
  return typeof value === "string" && value in ASSETS_REGISTRY;
}
