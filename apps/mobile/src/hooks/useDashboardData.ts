import { createLogger } from "@moneto/utils";
import { useCallback, useState } from "react";

import { mockAssets, type Asset, type Transaction } from "@data/mock";
import { useAppStore } from "@stores/useAppStore";

const log = createLogger("dashboard.data");

/**
 * Estado del fetch de la dashboard. Coincide con la convención de
 * React Query: `loading` (primera carga), `ready` (data válida — pueden
 * ser stale), `error` (último fetch falló y no hay snapshot).
 */
export type DashboardStatus = "loading" | "ready" | "error";

export interface DashboardData {
  status: DashboardStatus;
  /** Saldo total + APY agregado, ya en USD. Mock hoy. */
  balance: ReturnType<typeof useAppStore.getState>["balance"];
  /** Últimas N transactions, ordenadas por timestamp desc. Mock hoy. */
  transactions: Transaction[];
  /** Assets del user (USD pinned + crypto/local stables). Mock hoy. */
  assets: Asset[];
  /**
   * Refetch on-demand (pull-to-refresh, etc.). Resuelve cuando todos los
   * sub-fetchs terminan. Hoy es un no-op simulado de 800ms — Sprint 3
   * lo reemplaza con `Promise.all([qBalance, qTxs, qAssets].map(invalidate))`.
   */
  refresh: () => Promise<void>;
  /** Estado boolean para el RefreshControl mientras corre `refresh()`. */
  isRefreshing: boolean;
}

/**
 * Façade contra el data layer del dashboard de Saldo. Hoy lee del Zustand
 * store (mocks de Sprint 0); Sprint 3 swap-ea el internals para React Query
 * sobre `apps/api` sin tocar las screens que consumen este hook.
 *
 * Por qué NO leer `useAppStore` directo desde la screen:
 * 1. Single seam — cuando llegue React Query, una sola edición acá apaga
 *    el mock layer entero.
 * 2. Permite estados `loading`/`error` que el store directo no representa.
 * 3. Concentra el `refresh()` que la pantalla necesita para pull-to-refresh.
 */
export function useDashboardData(): DashboardData {
  const balance = useAppStore((s) => s.balance);
  const transactions = useAppStore((s) => s.transactions);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Hoy: status='ready' siempre. Cuando wireemos React Query, este
  // status se deriva del fetcher principal (queries.balance).
  const status: DashboardStatus = "ready";

  const refresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    log.debug("dashboard refresh requested");
    // Mock: 800ms para que el RefreshControl tenga visibilidad. Sprint 3
    // reemplaza con `await Promise.all([invalidate(balance), invalidate(txs), invalidate(assets)])`.
    await new Promise((r) => setTimeout(r, 800));
    setIsRefreshing(false);
  }, [isRefreshing]);

  return {
    status,
    balance,
    transactions,
    assets: mockAssets,
    refresh,
    isRefreshing,
  };
}
