import { forwardRef } from "react";
import { Image, View, type ImageSourcePropType } from "react-native";

import { useTheme } from "../hooks/useTheme";

import { Text } from "./Text";

export type LogoVariant = "mark" | "wordmark" | "full";
export type LogoTone = "brand" | "inverse" | "primary";

export interface LogoProps {
  /** Tamaño en puntos del lado del mark (y proporcional del wordmark). */
  size?: number;
  /** `mark` (solo símbolo), `wordmark` (solo texto), `full` (ambos). */
  variant?: LogoVariant;
  /** Color del wordmark (el mark es bitmap, no se tiñe). */
  tone?: LogoTone;
  /**
   * Override del asset del mark. Default: el logo bundleado en
   * `@moneto/ui/assets/images/moneto-logo.png`. Útil si una app necesita
   * mostrar un mark co-branded.
   */
  source?: ImageSourcePropType;
  /** testID para E2E. */
  testID?: string;
}

const DEFAULT_LOGO_SOURCE: ImageSourcePropType = require("../../assets/images/moneto-logo.png");

/**
 * Marca Moneto. `mark` para anclas pequeñas (header, virtual card),
 * `wordmark` cuando la jerarquía visual lo prioriza (splash, footer
 * landing), `full` solo cuando es la primera impresión y queremos refuerzo
 * mark + texto (auth screen).
 *
 * @example
 *   <Logo variant="mark" size={28} />
 *   <Logo variant="wordmark" size={48} tone="primary" />
 *   <Logo variant="full" size={56} />
 */
export const Logo = forwardRef<View, LogoProps>(function Logo(
  { size = 40, variant = "mark", tone = "brand", source = DEFAULT_LOGO_SOURCE, testID },
  ref,
) {
  const { colors } = useTheme();

  const color =
    tone === "brand"
      ? colors.brand.primary
      : tone === "inverse"
        ? colors.text.inverse
        : colors.text.primary;

  const Mark = (
    <Image
      source={source}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible
      accessibilityLabel="Moneto"
      accessibilityRole="image"
    />
  );

  if (variant === "mark") {
    return (
      <View ref={ref} testID={testID}>
        {Mark}
      </View>
    );
  }

  if (variant === "wordmark") {
    return (
      <View ref={ref} testID={testID}>
        <Text
          variant="wordmark"
          accessibilityLabel="Moneto"
          style={{ color, fontSize: size * 0.8 }}
        >
          Moneto
        </Text>
      </View>
    );
  }

  return (
    <View
      ref={ref}
      testID={testID}
      style={{ flexDirection: "row", alignItems: "center", gap: size * 0.25 }}
    >
      {Mark}
      <Text variant="wordmark" accessibilityLabel="Moneto" style={{ color, fontSize: size * 0.8 }}>
        Moneto
      </Text>
    </View>
  );
});

Logo.displayName = "Logo";
