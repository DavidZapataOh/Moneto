import { View, Image } from "react-native";
import { Text } from "../ui/Text";
import { useTheme } from "@hooks/useTheme";
import type { Asset, AssetId } from "@data/mock";

interface AssetIconProps {
  asset: Asset;
  size?: number;
}

/**
 * Assets con imagen PNG propia.
 * Stables con flag → la flag llena el círculo (cover).
 * Crypto logos → logo dentro de bubble tinted.
 */
const flagImages: Partial<Record<AssetId, any>> = {
  usd: require("../../../assets/images/Flag_of_the_United_States.png"),
  cop: require("../../../assets/images/Flag_Colombia.png"),
};

const cryptoLogos: Partial<Record<AssetId, any>> = {
  btc: require("../../../assets/images/bitcoin.png"),
  eth: require("../../../assets/images/ethereum-eth-logo.png"),
  sol: require("../../../assets/images/Solana_logo.png"),
};

export function AssetIcon({ asset, size = 48 }: AssetIconProps) {
  const { colors } = useTheme();

  // 1. Flags (stables con bandera de país) — llenan el círculo
  const flag = flagImages[asset.id];
  if (flag) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          flexShrink: 0,
          borderWidth: 1,
          borderColor: colors.border.subtle,
        }}
      >
        <Image
          source={flag}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // 2a. BTC y SOL — logo al 100% (son su propia identidad)
  if (asset.id === "btc" || asset.id === "sol") {
    const logo = cryptoLogos[asset.id];
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          flexShrink: 0,
          backgroundColor: colors.bg.overlay,
        }}
      >
        <Image
          source={logo}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // 2b. ETH — logo al 62% dentro de bubble tinted con ETH Blue (#627EEA) brand
  if (asset.id === "eth") {
    const logo = cryptoLogos[asset.id];
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "rgba(98, 126, 234, 0.18)",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Image
          source={logo}
          style={{ width: size * 0.62, height: size * 0.62 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  // 3. Fallback — otros stables con emoji de bandera (MXN, BRL, ARS, EUR)
  const config = (() => {
    switch (asset.id) {
      case "mxn":
        return { bg: "rgba(200, 148, 80, 0.22)", fg: colors.value, label: "🇲🇽" };
      case "brl":
        return { bg: "rgba(200, 148, 80, 0.22)", fg: colors.value, label: "🇧🇷" };
      case "ars":
        return { bg: "rgba(200, 148, 80, 0.22)", fg: colors.value, label: "🇦🇷" };
      case "eur":
        return { bg: "rgba(107, 122, 56, 0.2)", fg: colors.success, label: "🇪🇺" };
      default:
        return { bg: colors.bg.overlay, fg: colors.text.primary, label: "?" };
    }
  })();

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
        borderWidth: 1,
        borderColor: colors.border.subtle,
      }}
    >
      <Text style={{ fontSize: size * 0.48 }} allowFontScaling={false}>
        {config.label}
      </Text>
    </View>
  );
}
