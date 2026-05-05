import { createLogger } from "@moneto/utils";
import { useEffect, useRef } from "react";

import { useAppStore } from "@stores/useAppStore";

import { useLogout } from "./useLogout";

const log = createLogger("auth.autoLogout");

/**
 * Watcher que dispara `useLogout()` automáticamente cuando el `authState`
 * transiciona a `"expired"` — caso típico: el refresh del Privy token
 * falló (network down + token vencido, o el server revocó la sesión).
 *
 * Por qué silent: el user ya no tiene una sesión válida, pedirle confirm
 * es absurdo (no hay nada que pueda hacer). Lo navegamos al onboarding y
 * que re-loguee.
 *
 * El check usa una ref para garantizar que solo disparamos UNA vez por
 * "expiración detectada", aunque el effect se re-mounte. Si el cleanup
 * falla y el state queda `expired`, no entramos en loop.
 *
 * Mount: una sola vez en `_layout.tsx > Shell`, junto a `usePrivyAuthSync`.
 */
export function useAutoLogoutOnExpired(): void {
  const status = useAppStore((s) => s.authState.status);
  const { logout } = useLogout();
  const triggered = useRef(false);

  useEffect(() => {
    if (status !== "expired") {
      // Reset el latch — si el user re-loguea y vuelve a expirar, queremos
      // disparar de nuevo. Solo bloqueamos durante un mismo episodio expired.
      triggered.current = false;
      return;
    }

    if (triggered.current) return;
    triggered.current = true;

    log.warn("auth state expired — triggering silent logout");
    void logout().catch((err) => {
      log.error("silent logout failed", { err: String(err) });
    });
  }, [status, logout]);
}
