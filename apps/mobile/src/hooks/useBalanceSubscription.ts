import { createLogger } from "@moneto/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { queryKeys } from "@/lib/query-keys";

const log = createLogger("balance.subscription");

/**
 * Invalidación realtime del balance cache.
 *
 * **Sprint 3.02**: skeleton — el hook expone `invalidate()` callable
 * pero NO subscribe a notifications todavía. Los call-sites que tengan
 * señal de "incoming transfer" pueden disparar `invalidate()` manual
 * mientras el wiring real llega.
 *
 * **Sprint 7** (notifications): el hook se subscribe a:
 * - `expo-notifications` foreground listener — push notif `incoming_transfer`
 *   → invalidate balance.
 * - `expo-notifications` background handler — idem cuando el app vuelve
 *   a foreground después de recibir.
 *
 * **Sprint 5** (Supabase realtime): subscription opcional al channel
 * `tx-events` con `INSERT` events filtrados por user — invalida balance
 * + txs query.
 *
 * @example
 *   const { invalidate } = useBalanceSubscription();
 *   // Después de un send local optimistic, forzar refetch:
 *   await invalidate();
 */
export function useBalanceSubscription() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(async () => {
    log.debug("invalidating balance + assets queries");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.balance() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.assets() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.txs() }),
    ]);
  }, [queryClient]);

  // Sprint 7 wiring placeholder. Hoy no-op — dejamos el `useEffect`
  // presente para que el shape del hook se vea estable en consumer
  // diff cuando llegue el subscription.
  useEffect(() => {
    return () => {
      // cleanup placeholder
    };
  }, []);

  return { invalidate };
}
