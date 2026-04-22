import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { useTheme } from "@hooks/useTheme";
import type { Asset } from "@data/mock";

interface AssetIconProps {
  asset: Asset;
  size?: number;
}

/**
 * Icon bubble por asset. Color + símbolo varían por asset.
 * Stables USD: verde, stables locales: azul suave, volátiles: cada uno su tono.
 */
export function AssetIcon({ asset, size = 48 }: AssetIconProps) {
  const { colors } = useTheme();

  const config = (() => {
    switch (asset.id) {
      case "usd":
        return { bg: "rgba(107, 122, 56, 0.2)", fg: colors.success, label: "$" };
      case "cop":
        return { bg: "rgba(200, 148, 80, 0.22)", fg: colors.value, label: "$" };
      case "mxn":
        return { bg: "rgba(200, 148, 80, 0.22)", fg: colors.value, label: "$" };
      case "brl":
        return { bg: "rgba(200, 148, 80, 0.22)", fg: colors.value, label: "R$" };
      case "ars":
        return { bg: "rgba(200, 148, 80, 0.22)", fg: colors.value, label: "$" };
      case "eur":
        return { bg: "rgba(107, 122, 56, 0.2)", fg: colors.success, label: "€" };
      case "sol":
        return { bg: "rgba(197, 103, 64, 0.2)", fg: colors.brand.primary, label: "◎" };
      case "btc":
        return { bg: "rgba(247, 147, 26, 0.18)", fg: "#F7931A", label: "₿" };
      case "eth":
        return { bg: "rgba(255, 255, 255, 0.12)", fg: colors.text.primary, label: "Ξ" };
      default:
        return { bg: colors.bg.overlay, fg: colors.text.primary, label: "?" };
    }
  })();

  const fontSize = size * 0.42;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: config.bg,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Text
        style={{
          fontSize,
          color: config.fg,
          fontWeight: "600",
          lineHeight: fontSize * 1.1,
        }}
        allowFontScaling={false}
      >
        {config.label}
      </Text>
      {asset.id === "cop" && (
        <View
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.bg.elevated,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 9 }}>🇨🇴</Text>
        </View>
      )}
      {asset.id === "mxn" && (
        <View
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.bg.elevated,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 9 }}>🇲🇽</Text>
        </View>
      )}
    </View>
  );
}
