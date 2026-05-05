import { AssetIdSchema, getAsset, type AssetId } from "@moneto/types";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { useApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIMES } from "@/lib/query-stale-times";
import { useAppStore } from "@stores/useAppStore";

/**
 * Wire shape for `GET /api/prices/:assetId` y los items de batch.
 * `source` documenta de dónde vino el price (audit + UI badge).
 */
const PriceResponseSchema = z.object({
  assetId: AssetIdSchema,
  price: z.number().nonnegative(),
  confidence: z.number().nonnegative(),
  publishTime: z.number().nonnegative(),
  isStale: z.boolean(),
  source: z.enum(["pyth-fresh", "pyth-stale-cache", "peg", "fx-hardcoded"]),
});

export type PriceResponse = z.infer<typeof PriceResponseSchema>;

/**
 * Subscribes a single-asset price con auto-refetch.
 *
 * Refetch interval:
 * - **5s** para volátiles (SOL/BTC/ETH) — Pyth publish ~sub-second,
 *   pero 5s es polite con Hermes free tier.
 * - **60s** para stables — peg/FX no cambia tanto, refresh barato.
 *
 * Auth gate: el endpoint requiere auth, así que el query se enabled
 * solo cuando el user está autenticado.
 *
 * @example
 *   const { data, isPending } = useAssetPrice("sol");
 *   if (data?.isStale) return <StaleBadge />;
 *   return <Text>${data?.price.toFixed(2)}</Text>;
 */
export function useAssetPrice(assetId: AssetId) {
  const api = useApi();
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");
  const meta = getAsset(assetId);
  const isVolatile = meta.category === "volatile";

  return useQuery<PriceResponse>({
    queryKey: queryKeys.asset(assetId),
    queryFn: ({ signal }) =>
      api.request(`/api/prices/${assetId}`, {
        schema: PriceResponseSchema,
        signal,
      }),
    enabled: isAuthenticated,
    staleTime: STALE_TIMES.prices,
    refetchInterval: isVolatile ? 5_000 : 60_000,
  });
}

/**
 * Batch fetch para varios assets (asset detail + lists). 1 POST
 * request → record keyed by assetId.
 *
 * Si algún asset falla server-side (Pyth down + sin cache stale),
 * el endpoint omite su entry → consumer debe handle missing.
 */
const BatchResponseSchema = z.record(AssetIdSchema as z.ZodType<AssetId>, PriceResponseSchema);

export function useAssetPrices(assetIds: AssetId[]) {
  const api = useApi();
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");
  // Si la lista incluye al menos un volátil, refetch agresivo. Si todos
  // stables, refresh tranquilo.
  const hasVolatile = assetIds.some((id) => getAsset(id).category === "volatile");

  return useQuery({
    queryKey: ["prices", "batch", ...assetIds.slice().sort()] as const,
    queryFn: ({ signal }) =>
      api.request("/api/prices", {
        method: "POST",
        body: { assets: assetIds },
        schema: BatchResponseSchema,
        signal,
      }),
    enabled: isAuthenticated && assetIds.length > 0,
    staleTime: STALE_TIMES.prices,
    refetchInterval: hasVolatile ? 5_000 : 60_000,
  });
}
