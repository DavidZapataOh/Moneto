import * as Haptics from "expo-haptics";

/**
 * Centralized haptic feedback.
 *
 * Filosofía: haptics = trust signal. Cada interacción meaningful dispara
 * feedback breve. Patrones agrupados por intención semántica, no por
 * intensidad física.
 *
 * Defensiva: cada call está wrapped en try/catch silencioso. Razón —
 * Android < 8 + algunos OEMs sin Taptic engine pueden tirar exceptions
 * en el bridge. Un fallo de haptic NO debe crashear un button tap.
 *
 * Reduced-motion: iOS al activar "Reduce Motion" suprime haptics
 * automáticamente a nivel UIKit; Android no tiene equivalente directo.
 * Si el user lo necesita, puede silenciar el sistema completo.
 */

function safe(fn: () => Promise<void> | void): void {
  try {
    void fn();
  } catch {
    // Swallow — haptic failure no debe propagar al UI.
  }
}

export const haptics = {
  /** Default tap (Pressable, IconButton). */
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Acción importante (Button primary, sheet open). */
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Acción crítica (confirm send, destructive). */
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Resultado positivo (transacción exitosa). */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Atención requerida (validación blanda). */
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Falla / error. */
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** Toggle / picker step (selection change). */
  select: () => safe(() => Haptics.selectionAsync()),
} as const;

export type HapticPattern = keyof typeof haptics;

export function useHaptics() {
  return haptics;
}
