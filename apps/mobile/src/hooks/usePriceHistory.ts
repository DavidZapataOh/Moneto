import { AssetIdSchema, type AssetId } from "@moneto/types";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { useApi } from "@/lib/api";
import { useAppStore } from "@stores/useAppStore";

export type PriceHistoryRange = "1H" | "1D" | "7D" | "30D" | "1Y" | "ALL";

const PriceHistoryPointSchema = z.object({
  t: z.number(),
  price: z.number(),
});

const PriceHistoryResponseSchema = z.object({
  assetId: AssetIdSchema,
  range: z.enum(["1H", "1D", "7D", "30D", "1Y", "ALL"]),
  points: z.array(PriceHistoryPointSchema),
  source: z.enum(["pyth-benchmarks", "stub"]).nullable(),
  fetchedAt: z.number(),
});

export type PriceHistoryResponse = z.infer<typeof PriceHistoryResponseSchema>;

/**
 * Stale times por range — mientras más wide el range, más rato podemos
 * cachear (los candles más viejos no cambian).
 *
 * - `1H` (1m candles) → 60s stale.
 * - `1D` / `7D` (5m / 1h candles) → 5min stale.
 * - `30D` / `1Y` / `ALL` → 30min stale.
 */
const STALE_TIME_MS_BY_RANGE: Record<PriceHistoryRange, number> = {
  "1H": 60_000,
  "1D": 5 * 60_000,
  "7D": 5 * 60_000,
  "30D": 30 * 60_000,
  "1Y": 30 * 60_000,
  ALL: 30 * 60_000,
};

/**
 * Fetch del histórico de precios para charts. Endpoint:
 * `GET /api/prices/:assetId/history?range=<range>`.
 *
 * Backend resuelve via Pyth Benchmarks (TradingView shim). Retorna
 * structure con `points: []` vacío si el asset no tiene history
 * (stables) o si el provider falló sin cache.
 *
 * @example
 *   const { data, isPending } = usePriceHistory("sol", "7D");
 *   if (data) renderChart(data.points);
 */
export function usePriceHistory(assetId: AssetId, range: PriceHistoryRange) {
  const api = useApi();
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");

  return useQuery<PriceHistoryResponse>({
    queryKey: ["price-history", assetId, range],
    queryFn: ({ signal }) =>
      api.request(`/api/prices/${assetId}/history?range=${range}`, {
        schema: PriceHistoryResponseSchema,
        signal,
      }),
    enabled: isAuthenticated,
    staleTime: STALE_TIME_MS_BY_RANGE[range],
    // No refetchInterval — el user cambia range manualmente.
  });
}
