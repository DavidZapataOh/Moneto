import { createLogger } from "@moneto/utils";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { useApi } from "@/lib/api";
import { addNotificationResponseListener, registerForPushNotifications } from "@/lib/notifications";
import { useAppStore } from "@stores/useAppStore";

const log = createLogger("push.setup");

/**
 * Wireup push notifications post-auth (Sprint 4.01).
 *
 * Comportamiento:
 * 1. **On auth**: cuando `authState.status` transiciona a `authenticated`,
 *    registramos el push token (idempotent server-side).
 * 2. **On tap**: cuando el user toca una notificación, deep-link al
 *    target apropiado (Sprint 5+ wirea `/tx/:signature`).
 *
 * Side-effects son intencionalmente silent — failures no bloquean ni
 * surface UI errors. El user puede ver/cambiar permisos manualmente
 * desde el screen "Notificaciones" (Sprint 4.05).
 *
 * Llamar UNA vez en `_layout.tsx > Shell`, post-auth-sync.
 */
export function usePushSetup(): void {
  const router = useRouter();
  const api = useApi();
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");
  const registeredRef = useRef(false);

  // ── Registration on auth ─────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      registeredRef.current = false;
      return;
    }
    if (registeredRef.current) return;
    registeredRef.current = true;

    void (async () => {
      try {
        const token = await registerForPushNotifications(api);
        if (!token) {
          // Permission denied / simulator / etc. Reset el flag para que
          // si el user habilita permission manualmente desde settings,
          // el próximo re-mount intente registrar de nuevo.
          registeredRef.current = false;
        }
      } catch (err) {
        log.warn("push setup unexpected error", {
          err: err instanceof Error ? err.message : String(err),
        });
        registeredRef.current = false;
      }
    })();
  }, [isAuthenticated, api]);

  // ── Notification tap → deep link ─────────────────────────────────────
  useEffect(() => {
    const cleanup = addNotificationResponseListener((data) => {
      log.debug("notification tap", {
        type: data["type"],
        hasSignature: !!data["signature"],
      });

      // Sprint 5+ wirea screen `/tx/:signature`. Hoy navigamos al tab
      // Saldo para que el user vea el balance refrescado.
      if (data["type"] === "incoming_transfer") {
        router.push("/(tabs)");
      }
    });
    return cleanup;
  }, [router]);
}
