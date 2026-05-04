import { forwardRef } from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { type, fonts } from "@moneto/theme";
import { useTheme } from "../hooks/useTheme";

export type TextVariant =
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

export type TextTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "inverse"
  | "brand"
  | "value"
  | "success"
  | "warning"
  | "danger";

export interface TextProps extends RNTextProps {
  /** Variant tipográfica del design system. Default `body`. */
  variant?: TextVariant;
  /** Color semántico desde el theme. Default `primary`. */
  tone?: TextTone;
  /** Style overrides. Aplicado después del variant + tone. */
  style?: TextStyle;
}

const MONO_VARIANTS: ReadonlySet<TextVariant> = new Set([
  "balanceHero",
  "balanceHeroLarge",
  "amountPrimary",
  "amountSecondary",
  "mono",
]);

/**
 * Text primitive del design system.
 *
 * Reglas:
 * - Variant define familia + size + line-height + letter-spacing.
 * - Tone define color (semántico, no literal). Sin `tone` ni `style.color`,
 *   hereda `colors.text.primary`.
 * - Variants mono (`balanceHero`, `amountPrimary`, etc.) desactivan
 *   `allowFontScaling` para que números no salten cuando el user sube el
 *   tamaño de letra del sistema (decisión consciente: legibilidad numérica
 *   se logra con weight/spacing, no con escalar).
 *
 * @example
 *   <Text variant="h2">Saldo total</Text>
 *   <Text variant="bodySmall" tone="secondary">{description}</Text>
 *   <Text variant="amountPrimary">{formatUsd(amount)}</Text>
 */
export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = "body", tone = "primary", style, children, ...rest },
  ref,
) {
  const { colors } = useTheme();

  const toneMap: Record<TextTone, string> = {
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
  const allowFontScaling = MONO_VARIANTS.has(variant) ? false : rest.allowFontScaling;

  return (
    <RNText
      ref={ref}
      {...rest}
      allowFontScaling={allowFontScaling}
      style={[typeStyle, { color: toneMap[tone] }, style]}
    >
      {children}
    </RNText>
  );
});

Text.displayName = "Text";

export { fonts };
