import { forwardRef } from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { type, fonts } from "@moneto/theme";
import { useTheme } from "../hooks/useTheme";

type Variant =
  | "wordmark"
  | "heroDisplay"
  | "heroDisplayLarge"
  | "h2"
  | "h3"
  | "body"
  | "bodyMedium"
  | "bodySmall"
  | "label"
  | "button"
  | "balanceHero"
  | "balanceHeroLarge"
  | "amountPrimary"
  | "amountSecondary"
  | "mono";

type Tone = "primary" | "secondary" | "tertiary" | "inverse" | "brand" | "value" | "success" | "warning" | "danger";

interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  style?: TextStyle;
}

const isMonoVariant = (v: Variant) =>
  ["balanceHero", "balanceHeroLarge", "amountPrimary", "amountSecondary", "mono"].includes(v);

export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = "body", tone = "primary", style, children, ...rest },
  ref
) {
  const { colors } = useTheme();

  const toneMap: Record<Tone, string> = {
    primary: colors.text.primary,
    secondary: colors.text.secondary,
    tertiary: colors.text.tertiary,
    inverse: colors.text.inverse,
    brand: colors.brand.primary,
    value: colors.value,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  };

  const typeStyle = type[variant];
  const monoProps = isMonoVariant(variant)
    ? { allowFontScaling: false as const }
    : {};

  return (
    <RNText
      ref={ref}
      {...monoProps}
      {...rest}
      style={[typeStyle, { color: toneMap[tone] }, style]}
    >
      {children}
    </RNText>
  );
});

export { fonts };
