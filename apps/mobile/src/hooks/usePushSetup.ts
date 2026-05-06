import { createLogger } from "@moneto/utils";
import { useRouter, type Href } from "expo-router";
import { useEffect, useRef } from "react";

import { useApi } from "@/lib/api";
import { addNotificationResponseListener, registerForPushNotifications } from "@/lib/notifications";
import { useAppStore } from "@stores/useAppStore";

const log = createLogger("push.setup");

/**
 * Wireup push notifications post-auth (Sprint 4.01 + 4.04).
 *
 * Comportamiento:
 * 1. **On auth**: cuando `authState.status` transiciona a `authenticated`,
 *    registramos el push token (idempotent server-side, cache-aware
 *    client-side via `notifications.ts isTokenCacheFresh`).
 * 2. **On tap**: cuando el user toca una notificación, deep-link al
 *    target apropiado según `data.type`.
 *
 * Side-effects son intencionalmente silent — failures no bloquean ni
 * surface UI errors. El user puede ver/cambiar permisos manualmente
 * desde el screen "Yo" (Sprint 4.10) o vía `PushPermissionBanner`.
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

  // ── Notification tap → deep link router ──────────────────────────────
  useEffect(() => {
    const cleanup = addNotificationResponseListener((data) => {
      const type = data["type"];
      log.debug("notification tap", { type });

      // Sprint 4.08: incoming_transfer ahora puede deep-link al tx detail
      // si tenemos signature. Sin signature (push del Sprint 4.04 stub),
      // fallback al tab Saldo.
      if (
        (type === "incoming_transfer" || type === "incoming_shielded") &&
        data["signature"] &&
        data["signature"].length >= 40
      ) {
        router.push({
          pathname: "/tx/[signature]",
          params: { signature: data["signature"] },
        });
        return;
      }

      const target = resolveDeepLink(data);
      router.push(target);
    });
    return cleanup;
  }, [router]);
}

/**
 * Tabla de dispatch deep-link → ruta según `data.type` que el server
 * envió. Sprint 4.04 cubre los 6 types principales del plan.
 *
 * **Fallback**: cualquier type desconocido (futuro o malformed) navega
 * al tab Saldo — el user al menos ve su balance fresh.
 *
 * **Notas por type**:
 * - `incoming_transfer` / `incoming_shielded`: idealmente
 *   `/tx/${signature}` cuando Sprint 4.08 lo tenga, hoy fallback a tabs.
 * - `recovery_request`: Sprint 7 wirea `/recovery/approve/[id]`.
 * - `guardian_invite`: Sprint 7 wirea `/guardians`.
 * - `kyc_approved`: navega al tab Yo donde el user ve su nivel KYC.
 * - `compliance_alert`: Sprint 7 wirea `/security`; hoy fallback.
 */
function resolveDeepLink(data: Record<string, string>): Href {
  const type = data["type"];
  switch (type) {
    case "incoming_transfer":
    case "incoming_shielded": {
      const signature = data["signature"];
      // `/tx/[signature]` no está implementado aún (Sprint 4.08). Hasta
      // entonces, cualquier incoming-tap aterriza en Saldo donde el
      // useBalance refresca + el user ve la línea nueva.
      if (signature && signature.length >= 8) {
        // Cuando exista: `return { pathname: "/tx/[signature]", params: { signature } } as Href;`
      }
      return "/(tabs)" as Href;
    }
    case "recovery_request": {
      const proposalId = data["proposalId"];
      if (proposalId) {
        // Sprint 7: `/recovery/approve/[id]` cuando exista.
        return "/(tabs)/profile" as Href;
      }
      return "/(tabs)/profile" as Href;
    }
    case "guardian_invite":
      // Sprint 7 wirea `/guardians`.
      return "/(tabs)/profile" as Href;
    case "kyc_approved":
      return "/(tabs)/profile" as Href;
    case "compliance_alert":
      // Sprint 7 wirea `/security`.
      return "/(tabs)/profile" as Href;
    default:
      return "/(tabs)" as Href;
  }
}
