/**
 * Moneto motion tokens.
 *
 * Filosofía: motion es trust signal. Curvas suaves (decelerate dominante),
 * duraciones cortas (90% del catálogo cae en 150–400ms). Spring solo para
 * gestos físicos (drag-to-dismiss, pull-to-refresh, scale-on-press).
 *
 * Referencia: Material Motion + iOS interpolating springs.
 */

export const durations = {
  /** UI feedback inmediato (color change, opacity nudge). */
  instant: 90,
  /** Press-state, hover, micro feedback. */
  fast: 150,
  /** Transición estándar (sheet, modal, tab change). */
  normal: 250,
  /** Hero entry, multi-step orchestration. */
  slow: 400,
  /** Splash → app, onboarding hero. */
  slower: 600,
} as const;

export type DurationToken = keyof typeof durations;

/**
 * Cubic bezier presets. Tuplas `[x1, y1, x2, y2]` listas para `Easing.bezier`
 * de Reanimated o `cubic-bezier()` en CSS.
 */
export const easings = {
  /** Default bidireccional — entrada + salida balanceadas. */
  standard: [0.2, 0, 0, 1] as const,
  /** Salida más enfática — para elements que se asientan en su lugar. */
  emphasized: [0.05, 0.7, 0.1, 1] as const,
  /** Solo decelera — entradas (sheets que aparecen). */
  decelerate: [0, 0, 0.2, 1] as const,
  /** Solo acelera — salidas (sheets que se van). */
  accelerate: [0.4, 0, 1, 1] as const,
  /** Linear — usar SOLO para tickers numéricos / yield counter. */
  linear: [0, 0, 1, 1] as const,
} as const;

export type EasingToken = keyof typeof easings;

/**
 * Spring presets para Reanimated `withSpring`.
 *
 * - `tap`: micro-bump al pulsar (Button, IconButton).
 * - `gentle`: sheets, drawers, hero entries.
 * - `snappy`: feedback assertive (toast in, badge bounce).
 * - `wobbly`: éxito / celebración (success screen).
 */
export const springs = {
  tap: { damping: 18, stiffness: 320, mass: 0.6 },
  gentle: { damping: 20, stiffness: 180, mass: 0.9 },
  snappy: { damping: 14, stiffness: 260, mass: 0.7 },
  wobbly: { damping: 8, stiffness: 140, mass: 0.9 },
} as const;

export type SpringToken = keyof typeof springs;
