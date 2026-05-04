/**
 * Moneto elevation tokens.
 *
 * Sombras tibias (cero gris frío) y sutiles. Usadas en Card elevated, sheets,
 * floating buttons. En dark mode reducimos opacidad y bumpemos algo el offset
 * porque la sombra negra sobre fondo casi-negro pierde contraste.
 *
 * RN style: cada token retorna las props nativas (shadowColor/shadowOffset/
 * shadowOpacity/shadowRadius/elevation) listas para spread en `style`.
 */

import type { ViewStyle } from "react-native";

export type ShadowToken = "none" | "sm" | "md" | "lg" | "xl";

type ShadowStyle = Pick<
  ViewStyle,
  "shadowColor" | "shadowOffset" | "shadowOpacity" | "shadowRadius" | "elevation"
>;

const lightShadows: Record<ShadowToken, ShadowStyle> = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: "#14100B",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#14100B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  lg: {
    shadowColor: "#14100B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  xl: {
    shadowColor: "#14100B",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 16,
  },
};

const darkShadows: Record<ShadowToken, ShadowStyle> = {
  none: lightShadows.none,
  sm: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 8,
  },
  xl: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.65,
    shadowRadius: 48,
    elevation: 16,
  },
};

export const shadows = { light: lightShadows, dark: darkShadows } as const;

/**
 * Resuelve un shadow token al style RN apropiado para el modo activo.
 *
 * @example
 *   const { isDark } = useTheme();
 *   <View style={[styles.card, getShadow("md", isDark ? "dark" : "light")]} />
 */
export function getShadow(token: ShadowToken, mode: "light" | "dark"): ShadowStyle {
  return shadows[mode][token];
}
