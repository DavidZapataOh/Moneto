import type { DecryptedTx } from "@hooks/useTxHistory";

/**
 * Filter framework para `useTxHistory` items — Sprint 4.09.
 *
 * **All client-side**: filtering ocurre sobre el array que ya está
 * en memoria (cache hidratado de SecureStore + páginas in-flight de
 * la infinite query). Cero round-trips al server, instant feedback,
 * works offline.
 *
 * **Privacy invariant**: el `search` query NUNCA se loguea ni se
 * envía a Sentry/Axiom — puede contener PII (nombre del counterparty
 * que el user está buscando). Solo el `activeCount` derivado se trackea
 * para analytics genéricos.
 */

export type TxTypeFilter =
  | "payroll"
  | "p2p_in"
  | "p2p_out"
  | "card"
  | "cashout"
  | "yield"
  | "credit"
  | "qr_pay"
  | "swap";

export type SortBy = "date" | "amount";
export type SortOrder = "asc" | "desc";

export interface TxFilters {
  /** Substring match contra counterpartyName / counterpartyHandle / description / currency. Case-insensitive. */
  search?: string;
  /** Multi-select de types. Empty/undefined = sin filter. */
  types?: TxTypeFilter[];
  /** Multi-select de currencies (USD, COP, BTC, etc.). */
  assets?: string[];
  /** Inclusive epoch ms range. */
  dateRange?: { from: number; to: number };
  /** Inclusive amount absolute range (USD-equivalent o native units, depende del display). */
  amountRange?: { min: number; max: number };
  sortBy?: SortBy;
  sortOrder?: SortOrder;
}

/**
 * Devuelve true si el filtro tiene al menos una restricción activa
 * (excluye sort que es siempre derivable).
 */
export function hasActiveFilters(f: TxFilters): boolean {
  if (f.search && f.search.trim().length > 0) return true;
  if (f.types && f.types.length > 0) return true;
  if (f.assets && f.assets.length > 0) return true;
  if (f.dateRange) return true;
  if (f.amountRange) return true;
  return false;
}

/**
 * Cuenta los grupos de filter activos. Usado para el badge del
 * IconButton "filter" (NO cuenta sort — es derivable, no restrictivo).
 */
export function activeFilterCount(f: TxFilters): number {
  let n = 0;
  if (f.search && f.search.trim().length > 0) n += 1;
  if (f.types && f.types.length > 0) n += 1;
  if (f.assets && f.assets.length > 0) n += 1;
  if (f.dateRange) n += 1;
  if (f.amountRange) n += 1;
  return n;
}

/**
 * Aplica filters + sort. Pure function — el caller pasa el array
 * actual del cache + filters del store. Performance ~1k items <50ms
 * en un device modesto (medido con time.now en perf:bench).
 */
export function applyFilters(txs: DecryptedTx[], filters: TxFilters): DecryptedTx[] {
  let result: DecryptedTx[] = txs;

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    if (q.length > 0) {
      result = result.filter((tx) => {
        const fields = [tx.counterpartyName, tx.counterpartyHandle, tx.description, tx.currency];
        return fields.some((f) => typeof f === "string" && f.toLowerCase().includes(q));
      });
    }
  }

  if (filters.types && filters.types.length > 0) {
    const set = new Set<string>(filters.types);
    result = result.filter((tx) => set.has(tx.type));
  }

  if (filters.assets && filters.assets.length > 0) {
    const set = new Set<string>(filters.assets.map((a) => a.toUpperCase()));
    result = result.filter((tx) => set.has(tx.currency.toUpperCase()));
  }

  if (filters.dateRange) {
    const { from, to } = filters.dateRange;
    // Auto-swap si invertido — defensivo contra UI bugs.
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    result = result.filter((tx) => tx.timestamp >= lo && tx.timestamp <= hi);
  }

  if (filters.amountRange) {
    const { min, max } = filters.amountRange;
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    result = result.filter((tx) => {
      const abs = Math.abs(tx.amount);
      return abs >= lo && abs <= hi;
    });
  }

  // Sort. Default = date desc (matches `useTxHistory` natural order de
  // Helius). Si el caller pide algo distinto, hacemos copy + sort
  // para no mutar el array del react-query cache.
  const sortBy: SortBy = filters.sortBy ?? "date";
  const sortOrder: SortOrder = filters.sortOrder ?? "desc";
  if (sortBy !== "date" || sortOrder !== "desc") {
    const factor = sortOrder === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      if (sortBy === "amount") {
        return factor * (Math.abs(a.amount) - Math.abs(b.amount));
      }
      return factor * (a.timestamp - b.timestamp);
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Date presets — útiles para el sheet UI
// ─────────────────────────────────────────────────────────────────────

export interface DatePreset {
  id: string;
  label: string;
  range: () => { from: number; to: number };
}

export const DATE_PRESETS: DatePreset[] = [
  {
    id: "this-week",
    label: "Esta semana",
    range: () => {
      const now = new Date();
      const day = now.getDay() || 7; // Sun = 0 → 7
      const monday = new Date(now);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(now.getDate() - (day - 1));
      return { from: monday.getTime(), to: now.getTime() };
    },
  },
  {
    id: "this-month",
    label: "Este mes",
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.getTime(), to: now.getTime() };
    },
  },
  {
    id: "last-3-months",
    label: "Últimos 3 meses",
    range: () => {
      const now = new Date();
      const start = new Date(now);
      start.setMonth(now.getMonth() - 3);
      return { from: start.getTime(), to: now.getTime() };
    },
  },
  {
    id: "this-year",
    label: "Este año",
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: start.getTime(), to: now.getTime() };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────
// Type / asset selectable lists for UI
// ─────────────────────────────────────────────────────────────────────

export interface TxTypeOption {
  value: TxTypeFilter;
  label: string;
}

export const TX_TYPE_OPTIONS: TxTypeOption[] = [
  { value: "p2p_in", label: "Recibido" },
  { value: "p2p_out", label: "Enviado" },
  { value: "swap", label: "Conversión" },
  { value: "cashout", label: "Retiro" },
  { value: "card", label: "Tarjeta" },
  { value: "yield", label: "Rendimiento" },
  { value: "payroll", label: "Pago recibido" },
  { value: "qr_pay", label: "Pago QR" },
  { value: "credit", label: "Crédito" },
];

/**
 * Currency strings comunes que el user puede filtrar. Hardcoded para
 * Sprint 4.09 — Sprint 8 puede derivar dinámicamente desde el cache
 * (qué currencies aparecen realmente en su history).
 */
export const ASSET_FILTER_OPTIONS: string[] = [
  "USD",
  "COP",
  "MXN",
  "BRL",
  "ARS",
  "EUR",
  "SOL",
  "BTC",
  "ETH",
];

/**
 * Presets compuestos del sheet. Cada uno aplica un setFilters parcial.
 */
export interface FilterPreset {
  id: string;
  label: string;
  apply: () => Partial<TxFilters>;
}

export const COMPOSITE_PRESETS: FilterPreset[] = [
  {
    id: "incoming-only",
    label: "Solo entradas",
    apply: () => ({ types: ["payroll", "p2p_in", "yield"] }),
  },
  {
    id: "outgoing-only",
    label: "Solo salidas",
    apply: () => ({ types: ["p2p_out", "cashout", "card"] }),
  },
  {
    id: "cashouts",
    label: "Solo retiros",
    apply: () => ({ types: ["cashout"] }),
  },
  {
    id: "swaps",
    label: "Solo conversiones",
    apply: () => ({ types: ["swap"] }),
  },
];
