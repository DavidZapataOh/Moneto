import { AssetIdSchema } from "@moneto/types";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";

import { useApi, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@stores/useAppStore";

import type { DecryptedTx } from "./useTxHistory";

const TX_TYPE_VALUES = [
  "payroll",
  "p2p_in",
  "p2p_out",
  "card",
  "cashout",
  "yield",
  "credit",
  "qr_pay",
  "swap",
  "unknown",
] as const;

const TxSchema = z.object({
  id: z.string(),
  type: z.enum(TX_TYPE_VALUES),
  amount: z.number(),
  currency: z.string(),
  description: z.string(),
  counterpartyName: z.string().nullable(),
  counterpartyHandle: z.string().nullable(),
  timestamp: z.number(),
  status: z.enum(["completed", "pending", "failed"]),
  assetUsed: AssetIdSchema.nullable(),
  isPrivate: z.boolean(),
});

/**
 * Single tx detail. Sprint 4.08.
 *
 * **Cache-first**: si la tx ya está en el cache de `useTxHistory` (queryKey
 * `["txs"]` infinite query), usamos esa primero como `placeholderData`
 * para first-paint instantáneo, y refetch en background para fresh data
 * (e.g., status pending → completed).
 *
 * **Network-fallback**: si no está en cache (deep link push notif, share
 * link), fetcheamos del endpoint `/api/me/transactions/:signature`.
 */
export function useTx(signature: string | null | undefined): UseQueryResult<DecryptedTx, Error> {
  const api = useApi();
  const queryClient = useQueryClient();
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");

  // Cache hit lookup — read-only, no subscribe (los re-renders del cache
  // de history no van a re-render esta query).
  const placeholder = (() => {
    if (!signature) return undefined;
    const historyData = queryClient.getQueryData<{
      pages: Array<{ items: DecryptedTx[] }>;
    }>(queryKeys.txs());
    const found = historyData?.pages.flatMap((p) => p.items).find((tx) => tx.id === signature);
    return found;
  })();

  return useQuery<DecryptedTx, Error>({
    queryKey: queryKeys.tx(signature ?? ""),
    queryFn: ({ signal }) =>
      api.get(`/api/me/transactions/${encodeURIComponent(signature ?? "")}`, {
        schema: TxSchema,
        signal,
      }),
    enabled: isAuthenticated && !!signature && signature.length >= 40,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    ...(placeholder ? { placeholderData: placeholder } : {}),
    retry: (failureCount, error) => {
      // 404 = tx not found (terminal). Otros → 1 retry.
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 1;
    },
  });
}
