import { Platform, View, ViewProps } from "react-native";
import { useTheme } from "@hooks/useTheme";
import { radius } from "@theme/spacing";

type Variant = "elevated" | "outlined" | "sunken" | "brand";

interface CardProps extends ViewProps {
  variant?: Variant;
  padded?: boolean;
  padding?: number;
  radius?: keyof typeof radius;
}

/**
 * Base card. Aplica squircle (borderCurve continuous) en iOS por default
 * para corners Apple-grade en lugar de circular genérico.
 *
 * Spacing rules (8-point grid):
 * - Default radius: 20 (lg)
 * - Default padding: 16 (cuando padded=true)
 * - Todas las cards de la misma screen usan el MISMO radius y padding
 */
export function Card({
  variant = "elevated",
  padded = true,
  padding = 16,
  radius: r = "lg",
  style,
  children,
  ...rest
}: CardProps) {
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
      style={[
        {
          backgroundColor: variantStyle.bg,
          borderColor: variantStyle.border,
          borderWidth: variantStyle.borderWidth,
          borderRadius: radius[r],
          padding: padded ? padding : 0,
          // iOS squircle — smoother continuous corners
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
}
