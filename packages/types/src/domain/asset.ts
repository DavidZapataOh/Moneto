import { z } from "zod";

/**
 * Supported asset IDs in Moneto.
 *
 * - "usd" is a virtual aggregator over USDC + USDG + PYUSD + USDT.
 * - "cop", "mxn", "brl", "ars" are local stablecoins (wrapped on Solana).
 * - "eur" is EURC.
 * - "sol", "btc", "eth" are volatile underlying tokens (BTC via zBTC, ETH via wETH).
 *
 * Updates here require updating ASSETS_REGISTRY in `packages/types/src/assets.ts`.
 */
export const AssetIdSchema = z.enum([
  "usd",
  "eur",
  "cop",
  "mxn",
  "brl",
  "ars",
  "sol",
  "btc",
  "eth",
]);
export type AssetId = z.infer<typeof AssetIdSchema>;

export const AssetCategorySchema = z.enum(["stable_usd", "stable_local", "stable_eur", "volatile"]);
export type AssetCategory = z.infer<typeof AssetCategorySchema>;

/** Solana network — `mainnet-beta` o `devnet`. Algunos assets están
 * disponibles solo en uno (ej. zBTC mainnet-only mientras Zeus deploy
 * en devnet). */
export type SolanaNetwork = "mainnet-beta" | "devnet";

/** Tipo de icon en la UI. `flag` rellena el círculo (cover);
 * `logo` se renderea sobre un bubble brand-tinted (ETH style). */
export type AssetIconType = "flag" | "logo";

/**
 * Un mint underlying que representa un AssetId. La unificación USD
 * (USDC + USDG + PYUSD + USDT bajo "usd") es el caso típico — varios
 * underlying mints, uno marcado `isPrimary` para swaps default.
 */
export interface UnderlyingMint {
  /** SPL mint pubkey (base58). Para SOL nativo, `So111…11112`. */
  mint: string;
  /**
   * Peso relativo dentro del asset unificado (0..1). Hoy todos los
   * stables son 1:1 redeemable, pero el campo deja espacio para
   * unidades como "USD pool" con pesos derivados de TVL.
   */
  weight: number;
  /**
   * El underlying mint que se usa como **default** para swaps + cashout
   * cuando el caller pide solo el AssetId (sin override). Solo uno
   * marcado como primary por asset.
   */
  isPrimary?: boolean;
  /**
   * Marca si el mint genera yield natively (USDG, PYUSD). El payment
   * router prefiere mover saldo a yield-bearing por default.
   */
  yieldBearing?: boolean;
  /** Documentación opcional de la cadena de origen del wrapping. */
  bridgeFrom?: string;
}

/** Source de yield para el `apy` mostrado en UI. */
export type ApySource = "moneto-pool" | "reflect-usdg" | "huma" | "kamino";

/**
 * Asset metadata — fuente de verdad estática (registry). Cambia solo
 * via deploy. NO contiene runtime state (balance, price); para eso ver
 * `AssetSchema` abajo.
 *
 * Mainnet mints triple-verificados: cross-reference Solscan + project
 * docs + Jupiter API antes de mergear. Wrong mint = funds lost.
 */
export interface AssetMeta {
  id: AssetId;
  /** Display short (USD, COP, BTC). */
  symbol: string;
  /** Display medium ("Dólar"). */
  name: string;
  /** Display long para a11y label / detail screen ("Dólar estadounidense"). */
  nameLong: string;
  category: AssetCategory;
  /** Decimals on-chain. **Crítico** — wrapping/unwrapping bugs son caros. */
  decimals: number;
  underlyingMints: UnderlyingMint[];
  iconType: AssetIconType;
  /**
   * Path simbólico al icon (ej. `"flags/co.png"`). Se mapea a un
   * `require(...)` en el icon component de cada app — el registry
   * queda agnostic de la plataforma.
   */
  iconAsset: string;
  /** Pyth price feed ID (mainnet) — solo para volátiles. */
  pythPriceFeedId?: string;
  apySource?: ApySource;
  /** Default APY para mock/UI cuando el yield real aún no está cargado. Decimal. */
  defaultApy?: number;
  /** Networks donde el asset está habilitado para operar. */
  enabledOn: SolanaNetwork[];
  /** Si true, se ancla primero en la asset strip (USD por default). */
  pinnedInUI?: boolean;
}

/**
 * Runtime state of a single asset for a single user.
 * Returned by `/api/me/balance` and consumed by mobile UI.
 *
 * `balance` is in raw on-chain units (bigint serialized as string over the wire).
 */
export const AssetSchema = z.object({
  id: AssetIdSchema,
  symbol: z.string(),
  name: z.string(),
  category: AssetCategorySchema,
  balance: z.union([z.bigint(), z.string().transform((s) => BigInt(s))]),
  balanceUsd: z.number().nonnegative(),
  spotPriceUsd: z.number().positive(),
  apy: z.number().optional(),
  isEarning: z.boolean(),
  change24h: z.number().optional(),
  isPinned: z.boolean().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;
