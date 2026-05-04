import * as Haptics from "expo-haptics";

/**
 * Centralized haptic feedback.
 *
 * Filosofía: haptics = trust signal. Cada interacción meaningful dispara
 * feedback breve. Patrones agrupados por intención semántica, no por
 * intensidad física.
 *
 * Sprint 2.07 amplía esto con policy engine + reduced-motion support
 * (respetar `Settings → Accessibility → Reduce motion`).
 */
export const haptics = {
  /** Default tap (Pressable, IconButton). */
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Acción importante (Button primary, sheet open). */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  /** Acción crítica (confirm send, destructive). */
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  /** Resultado positivo (transacción exitosa). */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  /** Atención requerida (validación blanda). */
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  /** Falla / error. */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  /** Toggle / picker step (selection change). */
  select: () => Haptics.selectionAsync(),
} as const;

export type HapticPattern = keyof typeof haptics;

export function useHaptics() {
  return haptics;
}
