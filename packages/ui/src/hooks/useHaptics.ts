import * as Haptics from "expo-haptics";

/**
 * Centralized haptic feedback.
 * Principio: haptics = trust signal. Cada interacción meaningful dispara feedback.
 *
 * Sprint 2.07 amplía esto con un policy engine + reduced-motion support.
 */
export const haptics = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  select: () => Haptics.selectionAsync(),
};

export function useHaptics() {
  return haptics;
}
