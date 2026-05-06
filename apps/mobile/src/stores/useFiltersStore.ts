import { create } from "zustand";

import type { TxFilters } from "@/lib/tx-filters";

/**
 * Filters store para `transactions.tsx` — Sprint 4.09.
 *
 * **Session-only**: NO persiste a AsyncStorage. Cuando el user cierra
 * la app y vuelve a abrir, los filters se resetean. Razones:
 * - Privacy: el `search` puede contener PII de un counterparty;
 *   persistirlo en AsyncStorage (no encrypted by default) es leak.
 * - UX: filters reset entre sessions es predictable — el user no se
 *   sorprende con results inesperados al abrir.
 *
 * **Single store** vs split per-screen: hoy solo `transactions.tsx`
 * lo consume. Sprint 7 (tax export) puede reusar el mismo framework
 * con su propio store o compartir éste — TBD.
 */

/**
 * Input del setFilters explícitamente permite `undefined` por campo
 * para semántica "clearear este key". El reducer drops los undefined
 * keys y aplica el resto vía spread.
 */
type FiltersPatch = {
  [K in keyof TxFilters]?: TxFilters[K] | undefined;
};

interface FiltersState {
  filters: TxFilters;
  setFilters: (next: FiltersPatch) => void;
  /** Reemplazo total — útil para presets que clearean otros filters. */
  replaceFilters: (next: TxFilters) => void;
  /** Borra un campo específico (usado por chips de UI cuando el user
   *  destogglea el último item de un multi-select). */
  clearField: (key: keyof TxFilters) => void;
  reset: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  filters: {},
  setFilters: (next) =>
    set((state) => {
      // Drop keys con value undefined — exactOptionalPropertyTypes
      // distingue "absent" vs "undefined". Para nuestro store la
      // semántica es la misma: si pasaron undefined, queremos clearear.
      const merged: TxFilters = { ...state.filters };
      for (const key of Object.keys(next) as (keyof FiltersPatch)[]) {
        const value = next[key];
        if (value === undefined) {
          delete merged[key];
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (merged as any)[key] = value;
        }
      }
      return { filters: merged };
    }),
  replaceFilters: (next) => set({ filters: next }),
  clearField: (key) =>
    set((state) => {
      const next = { ...state.filters };
      delete next[key];
      return { filters: next };
    }),
  reset: () => set({ filters: {} }),
}));

/**
 * Helper para borrar el store fuera de un componente — usado por
 * `performLogoutCleanup` para garantizar que el next user no hereda
 * filters del previous.
 */
export function resetFiltersStore(): void {
  useFiltersStore.getState().reset();
}
