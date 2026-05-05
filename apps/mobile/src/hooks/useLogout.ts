import { createLogger } from "@moneto/utils";
import { usePrivy } from "@privy-io/expo";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { performLogoutCleanup, type LogoutResult } from "@/lib/auth";

const log = createLogger("auth.useLogout");

interface UseLogoutReturn {
  /** Dispara el cleanup + navega a `/(onboarding)`. Idempotent — ignora calls concurrentes. */
  logout: () => Promise<LogoutResult>;
  /** True mientras corre el cleanup (UI puede mostrar spinner / disable button). */
  isLoggingOut: boolean;
}

/**
 * Hook que cierra la sesión completamente.
 *
 * Wrappea `performLogoutCleanup` con (1) la `logout` real de Privy obtenida
 * vía `usePrivy()` y (2) la navegación post-cleanup a `/(onboarding)`.
 * Estos dos pedazos requieren contexto React, por eso viven acá y no en
 * la pure function.
 *
 * Concurrency: si el user dispara el botón 2 veces seguidas, la segunda
 * call es no-op (refleja la promesa de la primera). Evita double cleanup
 * + double navigation.
 *
 * @example
 *   const { logout, isLoggingOut } = useLogout();
 *   <Pressable onPress={logout} disabled={isLoggingOut}>
 *     <Text>{isLoggingOut ? "Cerrando…" : "Cerrar sesión"}</Text>
 *   </Pressable>
 */
export function useLogout(): UseLogoutReturn {
  const { logout: privyLogout } = usePrivy();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const inflight = useRef<Promise<LogoutResult> | null>(null);

  const logout = useCallback(async (): Promise<LogoutResult> => {
    if (inflight.current) {
      log.debug("logout call coalesced — returning inflight promise");
      return inflight.current;
    }

    setIsLoggingOut(true);
    inflight.current = (async () => {
      try {
        const result = await performLogoutCleanup({
          privyLogout: async () => {
            await privyLogout();
          },
        });
        // Navigate aún si hubo partial failure — escape route de la sesión
        // es prioritario sobre el estado interno. El user re-loguea y todo
        // se reinicializa.
        router.replace("/(onboarding)");
        return result;
      } finally {
        setIsLoggingOut(false);
        inflight.current = null;
      }
    })();

    return inflight.current;
  }, [privyLogout]);

  return { logout, isLoggingOut };
}
