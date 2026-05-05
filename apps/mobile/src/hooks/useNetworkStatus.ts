import * as Network from "expo-network";
import { useEffect, useState } from "react";

/**
 * Estado de red abreviado. `isOnline` es la única señal que la mayoría
 * de pantallas necesita. `type` está exposto para casos donde el caller
 * quiera diferenciar (e.g., warnar de que está en cellular en una
 * operación cara de bandwidth).
 */
export interface NetworkStatus {
  isOnline: boolean;
  /** True si el OS reportó internet reachable (DNS + ping). */
  isInternetReachable: boolean | null;
  /** "WIFI" | "CELLULAR" | "NONE" | etc. */
  type: Network.NetworkStateType | null;
}

const INITIAL: NetworkStatus = {
  isOnline: true, // optimistic — evita flash de "offline" en cold start
  isInternetReachable: null,
  type: null,
};

/**
 * Hook que expone el estado de la red. Internamente lee
 * `Network.getNetworkStateAsync()` al mount + se subscribe al event
 * `Network.addNetworkStateListener` para updates en realtime.
 *
 * **Optimismo de cold start**: arranca asumiendo `isOnline: true` para
 * evitar un flash de banner "Sin conexión" en el primer 100ms antes de
 * que el OS responda. Si efectivamente está offline, el listener lo
 * corrige al instante.
 *
 * @example
 *   const { isOnline } = useNetworkStatus();
 *   if (!isOnline) return <OfflineBanner />;
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    // Snapshot inicial.
    void Network.getNetworkStateAsync()
      .then((state) => {
        if (cancelled) return;
        setStatus({
          isOnline: state.isConnected ?? true,
          isInternetReachable: state.isInternetReachable ?? null,
          type: state.type ?? null,
        });
      })
      .catch(() => {
        // Sin red de info — quedate en optimistic. No spammear console.
      });

    // Subscription a cambios.
    const subscription = Network.addNetworkStateListener((state) => {
      setStatus({
        isOnline: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? null,
        type: state.type ?? null,
      });
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return status;
}
