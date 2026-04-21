import { View, ViewProps } from "react-native";
import { useTheme } from "@hooks/useTheme";
import { radius } from "@theme/spacing";

type Variant = "elevated" | "outlined" | "sunken" | "brand";

interface CardProps extends ViewProps {
  variant?: Variant;
  padded?: boolean;
  radius?: keyof typeof radius;
}

export function Card({
  variant = "elevated",
  padded = true,
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
          padding: padded ? 20 : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
