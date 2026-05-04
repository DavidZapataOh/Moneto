import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../hooks/useTheme";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand" | "value";

interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: React.ReactNode;
  size?: "sm" | "md";
}

export function Badge({ label, tone = "neutral", icon, size = "sm" }: BadgeProps) {
  const { colors } = useTheme();

  const toneStyles = {
    neutral: { bg: colors.bg.overlay, fg: colors.text.secondary },
    success: { bg: "rgba(107, 122, 56, 0.16)", fg: colors.success },
    warning: { bg: "rgba(194, 137, 32, 0.16)", fg: colors.warning },
    danger: { bg: "rgba(168, 49, 26, 0.16)", fg: colors.danger },
    brand: { bg: "rgba(197, 103, 64, 0.16)", fg: colors.brand.primary },
    value: { bg: "rgba(200, 148, 80, 0.16)", fg: colors.value },
  };

  const s = toneStyles[tone];
  const padY = size === "sm" ? 4 : 6;
  const padX = size === "sm" ? 8 : 12;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: s.bg,
        paddingVertical: padY,
        paddingHorizontal: padX,
        borderRadius: 999,
        alignSelf: "flex-start",
      }}
    >
      {icon}
      <Text
        variant="label"
        style={{
          color: s.fg,
          fontSize: size === "sm" ? 10 : 11,
          letterSpacing: 0.8,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
