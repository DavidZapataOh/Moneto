import { radius } from "@moneto/theme";
import { forwardRef } from "react";
import { View } from "react-native";

import { useTheme } from "../hooks/useTheme";

import { Text } from "./Text";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "brand" | "value";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  /** Texto. Mantener corto (≤2 palabras). */
  label: string;
  /** Color semántico. Default `neutral`. */
  tone?: BadgeTone;
  /** Icono opcional a la izquierda del label. */
  icon?: React.ReactNode;
  /** Tamaño visual. Default `sm`. */
  size?: BadgeSize;
  /** testID para E2E. */
  testID?: string;
}

/**
 * Pill-shaped status indicator. Por convención usa el background tintado
 * en `rgba(..., 0.16)` del color tonal — suficiente contraste sin saturar
 * la jerarquía visual de la screen.
 *
 * @example
 *   <Badge label="Activo" tone="success" />
 *   <Badge label="3 días" tone="warning" size="md" icon={<Clock />} />
 */
export const Badge = forwardRef<View, BadgeProps>(function Badge(
  { label, tone = "neutral", icon, size = "sm", testID },
  ref,
) {
  const { colors } = useTheme();

  // Background tintado para cada tono (rgba derivado del fg).
  const TONE_BG: Record<BadgeTone, string> = {
    neutral: colors.bg.overlay,
    success: "rgba(107, 122, 56, 0.16)",
    warning: "rgba(194, 137, 32, 0.16)",
    danger: "rgba(168, 49, 26, 0.16)",
    brand: "rgba(197, 103, 64, 0.16)",
    value: "rgba(200, 148, 80, 0.16)",
  };

  const TONE_FG: Record<BadgeTone, string> = {
    neutral: colors.text.secondary,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    brand: colors.brand.primary,
    value: colors.value,
  };

  const padY = size === "sm" ? 4 : 6;
  const padX = size === "sm" ? 8 : 12;

  return (
    <View
      ref={ref}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: TONE_BG[tone],
        paddingVertical: padY,
        paddingHorizontal: padX,
        borderRadius: radius.full,
        alignSelf: "flex-start",
      }}
    >
      {icon}
      <Text
        variant="label"
        style={{
          color: TONE_FG[tone],
          fontSize: size === "sm" ? 10 : 11,
          letterSpacing: 0.8,
        }}
      >
        {label}
      </Text>
    </View>
  );
});

Badge.displayName = "Badge";
