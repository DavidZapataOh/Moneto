import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../hooks/useTheme";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "brand" | "value" | "neutral";
}

const sizeMap = {
  sm: 32,
  md: 40,
  lg: 52,
  xl: 72,
};

export function Avatar({ name, size = "md", tone = "brand" }: AvatarProps) {
  const { colors } = useTheme();
  const s = sizeMap[size];
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const bgMap = {
    brand: colors.brand.primary,
    value: colors.value,
    neutral: colors.bg.overlay,
  };

  const fgMap = {
    brand: colors.text.inverse,
    value: colors.text.inverse,
    neutral: colors.text.primary,
  };

  const fontSize = size === "xl" ? 24 : size === "lg" ? 18 : size === "md" ? 14 : 11;

  return (
    <View
      style={{
        width: s,
        height: s,
        borderRadius: s / 2,
        backgroundColor: bgMap[tone],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        variant="bodyMedium"
        style={{
          color: fgMap[tone],
          fontSize,
          letterSpacing: 0.3,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
