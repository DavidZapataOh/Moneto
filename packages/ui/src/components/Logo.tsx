import { Image, View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../hooks/useTheme";

interface LogoProps {
  size?: number;
  variant?: "mark" | "wordmark" | "full";
  tone?: "brand" | "inverse" | "primary";
}

const logoSource = require("../../../assets/images/moneto-logo.png");

export function Logo({ size = 40, variant = "mark", tone = "brand" }: LogoProps) {
  const { colors } = useTheme();

  const color =
    tone === "brand"
      ? colors.brand.primary
      : tone === "inverse"
        ? colors.text.inverse
        : colors.text.primary;

  const Mark = (
    <Image
      source={logoSource}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );

  if (variant === "mark") return Mark;

  if (variant === "wordmark") {
    return (
      <Text variant="wordmark" style={{ color, fontSize: size * 0.8 }}>
        Moneto
      </Text>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.25 }}>
      {Mark}
      <Text variant="wordmark" style={{ color, fontSize: size * 0.8 }}>
        Moneto
      </Text>
    </View>
  );
}
