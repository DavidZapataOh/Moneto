import { forwardRef } from "react";
import { View, type ViewStyle, StyleSheet } from "react-native";

import { useTheme } from "../hooks/useTheme";

export interface DividerProps {
  /** Usa `border.subtle` (default) vs `border.default` (más visible). */
  subtle?: boolean;
  /** Vertical (1pt wide). Default horizontal (1pt tall). */
  vertical?: boolean;
  /** Style extras. */
  style?: ViewStyle | ViewStyle[];
}

/**
 * Hairline separator. 1pt en cualquier orientación, color desde el theme.
 *
 * `subtle` (default) usa `border.subtle` — apropiado para separar items
 * dentro de una Card. `subtle={false}` usa `border.default` — para separar
 * grandes secciones cuando las Cards no están en juego.
 *
 * @example
 *   <Divider />
 *   <Divider subtle={false} style={{ marginVertical: 24 }} />
 *   <Divider vertical style={{ marginHorizontal: 12 }} />
 */
export const Divider = forwardRef<View, DividerProps>(function Divider(
  { subtle = true, vertical = false, style },
  ref,
) {
  const { colors } = useTheme();
  const color = subtle ? colors.border.subtle : colors.border.default;
  const base: ViewStyle = vertical
    ? { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: color }
    : { height: StyleSheet.hairlineWidth, backgroundColor: color };

  return <View ref={ref} accessibilityRole="none" style={[base, style]} />;
});

Divider.displayName = "Divider";
