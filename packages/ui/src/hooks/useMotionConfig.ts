import { useReducedMotion } from "react-native-reanimated";

/**
 * Returns un config de motion que respeta la preferencia del sistema
 * (`Settings → Accessibility → Reduce Motion` en iOS, equivalente en
 * Android). Cuando reducida, animations se acortan a 0ms o se omiten.
 *
 * @example
 *   const motion = useMotionConfig();
 *   <Animated.View entering={motion.enabled ? entrances.hero : undefined}>
 *     ...
 *   </Animated.View>
 *
 * @example
 *   // Inline timing
 *   const motion = useMotionConfig();
 *   scale.value = withTiming(1, { duration: motion.duration(350) });
 */
export interface MotionConfig {
  /** True si las animations deben renderearse (reduced motion = false). */
  enabled: boolean;
  /** Resuelve la duration: si reduced, retorna 0; sino, el ms pedido. */
  duration: (ms: number) => number;
  /**
   * Resuelve un valor animable: si reduced, retorna `fallback` (ej. el
   * valor target sin transición); sino, retorna `value` (animado).
   *
   * Útil para `useSharedValue(motion.transform(0, 1))` — empezar en el
   * estado final si reduced, sino arrancar desde el inicio del flow.
   */
  transform: <T>(value: T, fallback: T) => T;
}

export function useMotionConfig(): MotionConfig {
  const reduced = useReducedMotion();
  const enabled = !reduced;

  return {
    enabled,
    duration: (ms: number) => (enabled ? ms : 0),
    transform: <T>(value: T, fallback: T) => (enabled ? value : fallback),
  };
}
