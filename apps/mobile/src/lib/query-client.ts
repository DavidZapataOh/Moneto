import { QueryClient } from "@tanstack/react-query";

import { GC_TIMES } from "./query-stale-times";

/**
 * Singleton React Query client. Defaults conservadores para fintech:
 *
 * - `staleTime: 0` por default → cada query refetcha al re-mount. Los
 *   hooks específicos (useBalance, useAssetsData) override con valores
 *   per-data-type (`STALE_TIMES`).
 * - `gcTime: 5 minutos` (`GC_TIMES.default`) — keep cache 5min después
 *   de unmount. Re-mount inmediato (tab change) reusa data stale
 *   mientras refetcha en background. Money queries override a 1min via
 *   `GC_TIMES.money`.
 * - `retry: 2` con backoff exponential — tres intentos total para
 *   network blips. No queremos 5+ retries colapsando un Helius rate
 *   limit en un loop.
 * - `refetchOnReconnect: true` — al recover de offline, fresh data.
 * - `refetchOnWindowFocus: true` (default) — RN no tiene window pero
 *   el equivalent es app foreground; React Query lo maneja vía
 *   `focusManager` de @tanstack/react-query.
 * - `refetchOnMount: "always"` — el primer mount post-login siempre
 *   trae data fresh, aún si hay cache de un session anterior (shouldn't
 *   happen tras logout cleanup, defensivo).
 *
 * Mutations (futuro Sprint 4 send): mantenemos defaults; los handlers
 * configuran `onError` per-call.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: GC_TIMES.default,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnReconnect: true,
      refetchOnMount: "always",
    },
    mutations: {
      retry: 0,
    },
  },
});
