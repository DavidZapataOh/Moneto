import {
  AssetCategorySchema,
  AssetIdSchema,
  type Asset,
  type AssetId,
  type AssetCategory,
} from "@moneto/types";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { useApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIMES, GC_TIMES } from "@/lib/query-stale-times";
import { useAppStore } from "@stores/useAppStore";

/**
 * Wire shape of `GET /api/me/balance`. `balance` viaja como string
 * porque JSON no soporta bigint nativamente; lo parseamos a bigint en
 * el `select` del query.
 */
const BalanceWireSchema = z.object({
  assets: z.array(
    z.object({
      id: AssetIdSchema,
      symbol: z.string(),
      name: z.string(),
      category: AssetCategorySchema,
      balance: z.string(), // raw bigint as string
      balanceUsd: z.number().nonnegative(),
      spotPriceUsd: z.number().nonnegative(),
      apy: z.number().optional(),
      isEarning: z.boolean(),
      change24h: z.number().optional(),
      isPinned: z.boolean().optional(),
    }),
  ),
  totalUsd: z.number().nonnegative(),
  change24hUsd: z.number(),
  change24hPct: z.number(),
  weightedApy: z.number(),
  fetchedAt: z.number(),
});

type BalanceWire = z.infer<typeof BalanceWireSchema>;

export interface BalanceData {
  assets: Asset[];
  totalUsd: number;
  change24hUsd: number;
  change24hPct: number;
  weightedApy: number;
  fetchedAt: number;
}

/**
 * Fetch del balance del user via `GET /api/me/balance`.
 *
 * **Authentication gate**: el query se enabled solo cuando el user
 * está autenticado. Sin esto, React Query intentaría fetchear pre-auth
 * y obtendría 401 — useless retry loop.
 *
 * **Stale time**: 30s — para datos balance, fresh enough sin spammear
 * Helius. La invalidación granular vía push notif (Sprint 7) refresca
 * cuando hay incoming transfer.
 *
 * **gcTime**: 1min — el cache se mantiene 1min después de unmount.
 * Money queries usan un GC time corto (vs 5min default) para evitar
 * mostrar balance stale al re-mount post-foreground.
 *
 * **select**: convierte `balance: string` (wire) → `balance: bigint`
 * (runtime). El consumer ve `Asset` clean.
 *
 * @example
 *   const { data, isPending, isError, refetch } = useBalance();
 *   if (data) {
 *     // data.assets[0].balance es bigint
 *     // data.totalUsd es number
 *   }
 */
export function useBalance() {
  const api = useApi();
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");

  return useQuery<BalanceWire, Error, BalanceData>({
    queryKey: queryKeys.balance(),
    queryFn: async ({ signal }) =>
      api.request("/api/me/balance", {
        schema: BalanceWireSchema,
        signal,
      }),
    enabled: isAuthenticated,
    staleTime: STALE_TIMES.balance,
    gcTime: GC_TIMES.money,
    select: (raw): BalanceData => ({
      ...raw,
      assets: raw.assets.map(parseWireAsset),
    }),
  });
}

/** Convierte una wire-asset (balance: string) a runtime Asset (balance: bigint). */
function parseWireAsset(wire: BalanceWire["assets"][number]): Asset {
  const id: AssetId = wire.id;
  const category: AssetCategory = wire.category;
  let balance: bigint;
  try {
    balance = BigInt(wire.balance);
  } catch {
    // Defensive: si Helius retornó algo no-numeric, asumimos 0 +
    // dejamos que el caller decida si renderear.
    balance = 0n;
  }
  return {
    id,
    symbol: wire.symbol,
    name: wire.name,
    category,
    balance,
    balanceUsd: wire.balanceUsd,
    spotPriceUsd: wire.spotPriceUsd,
    isEarning: wire.isEarning,
    ...(wire.apy !== undefined ? { apy: wire.apy } : {}),
    ...(wire.change24h !== undefined ? { change24h: wire.change24h } : {}),
    ...(wire.isPinned !== undefined ? { isPinned: wire.isPinned } : {}),
  };
}
