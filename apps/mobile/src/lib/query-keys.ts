/**
 * Centralized React Query keys factory.
 *
 * **Por qué importa**: keys inconsistentes → cache miss + duplicación
 * de requests. Ejemplo de bug:
 *
 *   useQuery({ queryKey: ["balance"] })           // call 1
 *   useQuery({ queryKey: ["balance", "current"] }) // call 2 — DUPLICATE
 *
 * Con factory las keys son single-source-of-truth, deduplicación
 * automática vía React Query.
 *
 * **Estado Sprint 2**: React Query NO instalado todavía. Este file existe
 * como skeleton — Sprint 3 lo wirea con `useQuery({ queryKey: queryKeys.X(),
 * queryFn: () => api.get(...) })`.
 *
 * @example (Sprint 3+)
 *   const { data } = useQuery({
 *     queryKey: queryKeys.balance(),
 *     queryFn: () => api.get("/api/balance"),
 *     staleTime: STALE_TIMES.balance,
 *   });
 *
 *   // Invalidación cross-screen:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.balance() });
 */

import type { Asset } from "@data/mock";

export const queryKeys = {
  // ── Account ──────────────────────────────────────────────────────────
  /** Profile slice (KYC, country, handle). */
  profile: () => ["profile"] as const,
  /** User preferences (theme, language, balance_hidden). */
  preferences: () => ["preferences"] as const,
  /** Asset routing prefs (priority order, hidden assets, default send). */
  assetPreferences: () => ["asset-preferences"] as const,
  /** Early access waitlist requests (Sprint 3.08 bridges). */
  earlyAccess: () => ["early-access"] as const,

  // ── Money ────────────────────────────────────────────────────────────
  /** Balance agregado USD + APY. */
  balance: () => ["balance"] as const,
  /** Lista de assets del user. */
  assets: () => ["assets"] as const,
  /** Detail de un asset por id. */
  asset: (id: Asset["id"]) => ["assets", id] as const,
  /** Spot prices (Pyth oracles). */
  prices: () => ["prices"] as const,

  // ── Activity ─────────────────────────────────────────────────────────
  /** Lista de transacciones (filter opcional). */
  txs: (filter?: { type?: string; assetId?: string }) =>
    filter ? (["txs", filter] as const) : (["txs"] as const),
  /** Detail de una transacción por id. */
  tx: (id: string) => ["txs", id] as const,

  // ── Card ─────────────────────────────────────────────────────────────
  /** Datos de la card (last4, status, limits, settings). */
  card: () => ["card"] as const,
  /** Spending del día/mes para el progress bar. */
  cardSpending: () => ["card", "spending"] as const,

  // ── Vaults / yield ───────────────────────────────────────────────────
  /** Allocations en vaults rindiendo. */
  vaults: () => ["vaults"] as const,

  // ── Notifications ────────────────────────────────────────────────────
  /** Count de notificaciones unread. */
  notificationCount: () => ["notifications", "count"] as const,
  /** Lista de notificaciones (paginada). */
  notifications: (cursor?: string) =>
    cursor ? (["notifications", { cursor }] as const) : (["notifications"] as const),
} as const;

export type QueryKey = ReturnType<(typeof queryKeys)[keyof typeof queryKeys]>;
