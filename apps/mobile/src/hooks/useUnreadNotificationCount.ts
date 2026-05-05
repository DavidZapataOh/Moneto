import { useAppStore } from "@stores/useAppStore";

/**
 * Cantidad de notificaciones sin leer del user. Hoy retorna **0 fijo**
 * porque el sistema de notificaciones (push + in-app) se construye en
 * Sprint 5+ junto con `guardian_notifications` realtime via Supabase.
 *
 * **Por qué existe ya el hook si no hace nada útil**: el `(tabs)/_layout`
 * consume este shape para renderear el badge en la tab "Yo". Cuando
 * Sprint 5 wire el query real (Supabase realtime sobre
 * `guardian_notifications WHERE recipient_user_id = $userId AND status = 'pending'`),
 * el badge "just works" sin tocar el layout.
 *
 * Diseño futuro (no implementado):
 * - Subscription a Supabase realtime channel por `recipient_user_id`.
 * - Count = filas con `status = 'pending'` y `expires_at > now()`.
 * - `staleTime: 0` post `notification_acknowledged` → re-fetch inmediato.
 * - Persisted-snapshot en AsyncStorage (`moneto.notifications-count`)
 *   para evitar flash de "0" al cold start mientras carga el subscribe.
 *
 * Notar que el user_id viene del `useAppStore.authState` — pre-auth no
 * hay query (returns 0).
 */
export function useUnreadNotificationCount(): number {
  // Lee el flag para que el hook re-render cuando cambia auth — preparado
  // para cuando wireemos la query real, no para que cambie su return hoy.
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");
  if (!isAuthenticated) return 0;
  return 0;
}
