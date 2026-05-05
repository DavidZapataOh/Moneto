import { createLogger } from "@moneto/utils";
import { useCallback, useMemo, useState } from "react";

import { mockAssets, type Asset } from "@data/mock";
import { useAppStore } from "@stores/useAppStore";

const log = createLogger("assets.data");

/**
 * Vault donde Moneto deposita parte del balance rindiendo. Sprint 6 wirea
 * los datos reales (Reflect, Huma, Kamino) — hoy es mock declarativo.
 */
export interface VaultAllocation {
  name: string;
  /** APY publicado del vault (decimal: 0.062 = 6.2%). */
  apy: number;
  /** % del totalEarningUsd asignado a este vault. Suma a 100 across vaults. */
  allocationPct: number;
}

const VAULT_ALLOCATIONS: VaultAllocation[] = [
  { name: "Reflect USDC+", apy: 0.0624, allocationPct: 62 },
  { name: "Huma PayFi", apy: 0.071, allocationPct: 28 },
  { name: "Kamino Lend", apy: 0.049, allocationPct: 10 },
];

export type AssetsStatus = "loading" | "ready" | "error";

export interface AssetsData {
  status: AssetsStatus;
  assets: Asset[];
  /** Suma USD de todos los assets. */
  totalPatrimonioUsd: number;
  /** Suma USD de assets con `isEarning: true`. */
  totalEarningUsd: number;
  /** APY ponderado por balanceUsd entre los assets earning. Decimal. */
  weightedApy: number;
  /** Cambio 24h ponderado SOLO sobre volátiles (stables no fluctúan). */
  change24hUsd: number;
  /** % del cambio 24h sobre el patrimonio total. Decimal. */
  change24hPct: number;
  vaultAllocations: VaultAllocation[];
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

/**
 * Façade contra el data layer de la pantalla "Activos". Los selectors
 * (totalPatrimonioUsd, weightedApy, etc.) se memoizan acá para que el
 * render no los recalcule en cada commit.
 *
 * Sprint 3 swap-ea el internals para React Query sobre `apps/api/balance`
 * + Pyth oracles. Las screens que consumen este hook no cambian.
 */
export function useAssetsData(): AssetsData {
  const balance = useAppStore((s) => s.balance);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Memoizamos el cómputo del cambio 24h **ponderado solo por volátiles**
  // (ver ADR del plan: stables no aportan al cambio, solo crearían ruido
  // visual con valores tipo 0.01%).
  const derived = useMemo(() => {
    const totalPatrimonioUsd = mockAssets.reduce((sum, a) => sum + a.balanceUsd, 0);
    const earningAssets = mockAssets.filter((a) => a.isEarning && a.apy);
    const totalEarningUsd = earningAssets.reduce((sum, a) => sum + a.balanceUsd, 0);
    const weightedApy =
      totalEarningUsd > 0
        ? earningAssets.reduce((sum, a) => sum + (a.apy ?? 0) * a.balanceUsd, 0) / totalEarningUsd
        : 0;

    // Cambio 24h: usamos el valor pre-computado del store si existe (deriva
    // de la mock balance), sino lo calculamos de los volátiles.
    const change24hUsd =
      balance.change24hUsd ??
      mockAssets
        .filter((a) => a.category === "volatile" && a.change24h)
        .reduce((sum, a) => sum + a.balanceUsd * (a.change24h ?? 0), 0);
    const change24hPct =
      balance.change24hPct ?? (totalPatrimonioUsd > 0 ? change24hUsd / totalPatrimonioUsd : 0);

    return {
      totalPatrimonioUsd,
      totalEarningUsd,
      weightedApy,
      change24hUsd,
      change24hPct,
    };
  }, [balance.change24hUsd, balance.change24hPct]);

  const refresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    log.debug("assets refresh requested");
    // Mock: 800ms para visibilidad del RefreshControl. Sprint 3 invalida
    // queries reales (balance + assets + oracles).
    await new Promise((r) => setTimeout(r, 800));
    setIsRefreshing(false);
  }, [isRefreshing]);

  return {
    status: "ready",
    assets: mockAssets,
    ...derived,
    vaultAllocations: VAULT_ALLOCATIONS,
    refresh,
    isRefreshing,
  };
}
