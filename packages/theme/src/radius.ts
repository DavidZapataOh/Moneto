/**
 * Moneto border-radius scale.
 *
 * Geometría suave (mobile-design.txt): radius generosos en cards/sheets,
 * sutiles en chips/inputs, full para avatars. Nunca radius custom inline.
 */

export const radius = {
  none: 0,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  "2xl": 36,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
