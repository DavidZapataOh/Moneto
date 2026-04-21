import Svg, { Path, Circle } from "react-native-svg";
import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "@hooks/useTheme";

interface LogoProps {
  size?: number;
  variant?: "mark" | "wordmark" | "full";
  tone?: "brand" | "inverse" | "primary";
}

export function Logo({ size = 40, variant = "mark", tone = "brand" }: LogoProps) {
  const { colors } = useTheme();

  const color =
    tone === "brand"
      ? colors.brand.primary
      : tone === "inverse"
        ? colors.text.inverse
        : colors.text.primary;

  const Mark = (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Círculo exterior (sigilo/seal) */}
      <Circle cx="20" cy="20" r="18" stroke={color} strokeWidth="1.5" opacity={0.25} />
      {/* M estilizada que también es dos "monedas apiladas" */}
      <Path
        d="M10 26V14L20 22L30 14V26"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Punto central (el núcleo privado) */}
      <Circle cx="20" cy="22" r="1.5" fill={color} />
    </Svg>
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
