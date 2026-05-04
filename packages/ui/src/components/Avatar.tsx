import { forwardRef } from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../hooks/useTheme";

export type AvatarSize = "sm" | "md" | "lg" | "xl";
export type AvatarTone = "brand" | "value" | "neutral";

export interface AvatarProps {
  /** Nombre completo (o handle) — derivamos initials de aquí. */
  name: string;
  /** Tamaño visual. Default `md`. */
  size?: AvatarSize;
  /** Color de fondo (semantic). Default `brand`. */
  tone?: AvatarTone;
  /** testID para E2E. */
  testID?: string;
}

const SIZE_MAP: Record<AvatarSize, { box: number; font: number }> = {
  sm: { box: 32, font: 11 },
  md: { box: 40, font: 14 },
  lg: { box: 52, font: 18 },
  xl: { box: 72, font: 24 },
};

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Initials avatar. Sin imágenes — los neobancos privados no muestran fotos
 * de perfil de counterparties (decisión deliberada: privacy-first, además
 * evita un vector de phishing visual).
 *
 * @example
 *   <Avatar name="Maria Lopez" size="md" />
 *   <Avatar name={merchant.name} size="sm" tone="neutral" />
 */
export const Avatar = forwardRef<View, AvatarProps>(function Avatar(
  { name, size = "md", tone = "brand", testID },
  ref,
) {
  const { colors } = useTheme();
  const s = SIZE_MAP[size];

  const bgMap: Record<AvatarTone, string> = {
    brand: colors.brand.primary,
    value: colors.value,
    neutral: colors.bg.overlay,
  };

  const fgMap: Record<AvatarTone, string> = {
    brand: colors.text.inverse,
    value: colors.text.inverse,
    neutral: colors.text.primary,
  };

  const initials = initialsFor(name);

  return (
    <View
      ref={ref}
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={{
        width: s.box,
        height: s.box,
        borderRadius: s.box / 2,
        backgroundColor: bgMap[tone],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        variant="bodyMedium"
        style={{
          color: fgMap[tone],
          fontSize: s.font,
          letterSpacing: 0.3,
        }}
      >
        {initials}
      </Text>
    </View>
  );
});

Avatar.displayName = "Avatar";
