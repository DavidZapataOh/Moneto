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
