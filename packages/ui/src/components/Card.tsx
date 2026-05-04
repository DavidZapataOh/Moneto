import { radius as radiusTokens, type RadiusToken } from "@moneto/theme";
import { forwardRef } from "react";
import { Platform, View, type ViewProps } from "react-native";

import { useTheme } from "../hooks/useTheme";

export type CardVariant = "elevated" | "outlined" | "sunken" | "brand";

export interface CardProps extends ViewProps {
  /** Visual variant. Default `elevated`. */
  variant?: CardVariant;
  /** Aplica padding interno. Default `true`. */
  padded?: boolean;
  /** Padding interno cuando `padded`. Default `16`. */
  padding?: number;
  /** Radius token. Default `lg`. */
  radius?: RadiusToken;
}

/**
 * Surface base. Squircle continuo en iOS (`borderCurve: "continuous"`) para
 * corners Apple-grade.
 *
 * Reglas de uso (mobile-design.txt):
 * - Una misma screen usa SIEMPRE el mismo `radius` y `padding`.
 * - Default radius `lg` (20pt) para superficies grandes; `md` (14pt) para chips.
 * - `elevated` y `sunken` para crear profundidad sin recurrir a sombras
 *   pesadas; usar `<Card>` con `getShadow("md")` solo cuando la elevación
 *   es semánticamente importante (modales, sheets).
 *
 * @example
 *   <Card variant="elevated" padded>
 *     <Text variant="h3">Saldo</Text>
 *   </Card>
 *
 *   <Card variant="outlined" radius="md" padded={false}>
 *     <ListItem ... />
 *   </Card>
 */
export const Card = forwardRef<View, CardProps>(function Card(
  {
    variant = "elevated",
    padded = true,
    padding = 16,
    radius: r = "lg",
    style,
    children,
    testID,
    ...rest
  },
  ref,
) {
  const { colors } = useTheme();

  const variantStyle = (() => {
    switch (variant) {
      case "elevated":
        return { bg: colors.bg.elevated, border: "transparent", borderWidth: 0 };
      case "outlined":
        return { bg: "transparent", border: colors.border.subtle, borderWidth: 1 };
      case "sunken":
        return { bg: colors.bg.sunken, border: "transparent", borderWidth: 0 };
      case "brand":
        return { bg: colors.brand.primary, border: "transparent", borderWidth: 0 };
    }
  })();

  return (
    <View
      ref={ref}
      testID={testID}
      style={[
        {
          backgroundColor: variantStyle.bg,
          borderColor: variantStyle.border,
          borderWidth: variantStyle.borderWidth,
          borderRadius: radiusTokens[r],
          padding: padded ? padding : 0,
          ...(Platform.OS === "ios" && { borderCurve: "continuous" as const }),
          overflow: "hidden",
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
});

Card.displayName = "Card";
