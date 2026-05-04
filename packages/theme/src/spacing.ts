/**
 * Moneto spacing scale.
 *
 * Base 4pt grid (con `0.5`/`1.5`/`2.5` para nudges sub-grid). Usar siempre
 * keys de esta escala — nunca números arbitrarios — para mantener ritmo
 * visual coherente entre screens.
 */

export const space = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export type SpaceToken = keyof typeof space;

/**
 * Hit slop scale para Pressables pequeños.
 *
 * Regla a11y (WCAG / iOS HIG): touch target real ≥44pt. Si el visual es
 * menor, expandimos con hitSlop para cumplir sin alterar el layout.
 */
export const hitSlop = {
  small: { top: 8, bottom: 8, left: 8, right: 8 },
  medium: { top: 12, bottom: 12, left: 12, right: 12 },
  large: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;

export type HitSlopToken = keyof typeof hitSlop;
