/**
 * Stale times por tipo de data — central para evitar drift de defaults
 * across hooks.
 *
 * **Filosofía**:
 * - Volatile data (prices) → 5s para que el user vea movement.
 * - User-controlled data (balance, txs, card) → 30s–60s.
 * - Mostly-static data (profile, preferences, vaults) → 5–10min.
 *
 * `staleTime: Infinity` solo para data que NUNCA cambia (e.g., asset
 * metadata: name, decimals, icon).
 *
 * **Estado Sprint 2**: skeleton ready para Sprint 3.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;

export const STALE_TIMES = {
  // Money — frequently refreshed, but not real-time
  balance: 30 * SECOND,
  prices: 5 * SECOND,
  txs: 1 * MINUTE,
  card: 1 * MINUTE,
  cardSpending: 30 * SECOND,
  assets: 30 * SECOND,
  vaults: 5 * MINUTE,

  // User-controlled
  profile: 5 * MINUTE,
  preferences: 10 * MINUTE,

  // Notifications — pollish UI cuando llega push
  notificationCount: 30 * SECOND,
  notifications: 1 * MINUTE,
} as const;

export type StaleTimeKey = keyof typeof STALE_TIMES;

/**
 * GC times (cuánto queda en cache después de unmount). Más largo que
 * staleTime — incluso si el data está stale, queremos retornarlo
 * instantáneamente al re-mount mientras refetcheamos en background.
 *
 * Default React Query es 5min. Lo dejamos así para todos excepto
 * balance/txs (más frescos, no vale tanto cache).
 */
export const GC_TIMES = {
  default: 5 * MINUTE,
  /** Money: 1min — stale + cache short porque queremos data fresca al re-enter. */
  money: 1 * MINUTE,
} as const;
