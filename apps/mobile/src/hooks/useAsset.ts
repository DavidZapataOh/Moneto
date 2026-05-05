import { type Asset, type AssetId } from "@moneto/types";
import { useMemo } from "react";

import { useBalance } from "./useBalance";

/**
 * Selector single-asset desde el `useBalance` aggregate. Memoiza para
 * que `Asset` referenciado sea estable entre re-renders cuando los
 * fields del asset no cambian.
 *
 * Auth gate hereda de `useBalance` (que retorna `data: undefined` si
 * pre-auth) — el asset será `undefined` también.
 *
 * @example
 *   const { asset, isPending, isError, refetch } = useAsset("sol");
 *   if (asset) console.log(asset.balanceUsd);
 */
export function useAsset(id: AssetId): {
  asset: Asset | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const balance = useBalance();
  const asset = useMemo(() => balance.data?.assets.find((a) => a.id === id), [balance.data, id]);
  return {
    asset,
    isPending: balance.isPending,
    isError: balance.isError,
    refetch: balance.refetch,
  };
}
