import { fonts } from "@moneto/theme";
import { Text, useTheme, haptics } from "@moneto/ui";
import { formatAmountForA11y } from "@moneto/utils";
import { useRouter, type Href } from "expo-router";
import { View, Pressable } from "react-native";

import { AssetIcon } from "./AssetIcon";

import type { Asset } from "@data/mock";

interface AssetRowProps {
  asset: Asset;
  onPress?: () => void;
}

/**
 * Row de asset para lista en Activos. Mismo patrón estructural que VaultRow.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │  ◉   Bitcoin                     0.042 BTC       │
 *   │      ↑ 3.2% hoy                  $1,512 USD      │
 *   └──────────────────────────────────────────────────┘
 *
 * Para assets rindiendo: subtitle = "X% APY · rindiendo" + right = native balance
 * Para volátiles: subtitle = "↑ X% hoy" + right = native balance
 */
export function AssetRow({ asset, onPress }: AssetRowProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      haptics.tap();
      onPress();
      return;
    }
    haptics.tap();
    router.push(`/(tabs)/activos?asset=${asset.id}` as Href);
  };

  // Format native balance
  const formatNative = (v: number, asset: Asset) => {
    if (asset.id === "btc" || asset.id === "eth") return v.toFixed(4);
    if (asset.id === "sol") return v.toFixed(2);
    if (asset.category === "stable_local") {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);
  };

  // Format USD equivalent
  const formattedUsd = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asset.balanceUsd);

  // Sub line — contextual per type
  const subLine =
    asset.isEarning && asset.apy ? (
      <Text variant="bodySmall" tone="tertiary" numberOfLines={1}>
        <Text variant="bodySmall" tone="value">
          {(asset.apy * 100).toFixed(2)}% APY
        </Text>
        {"  ·  rindiendo"}
      </Text>
    ) : asset.change24h !== undefined ? (
      <Text variant="bodySmall" tone="tertiary" numberOfLines={1}>
        <Text
          variant="bodySmall"
          style={{
            color: asset.change24h >= 0 ? colors.success : colors.danger,
          }}
        >
          {asset.change24h >= 0 ? "↑" : "↓"} {Math.abs(asset.change24h * 100).toFixed(2)}%
        </Text>
        {"  ·  hoy"}
      </Text>
    ) : (
      <Text variant="bodySmall" tone="tertiary">
        —
      </Text>
    );

  // Accessibility label — humanizado por VoiceOver. Composición:
  // "Bitcoin, 0.042 BTC, 1512 dólares". Si rinde: + "rindiendo X% APY".
  // Si volátil: + "subió/bajó X% hoy".
  const a11yNativeBalance = `${formatNative(asset.balance, asset)} ${asset.shortName}`;
  const a11yUsdValue = formatAmountForA11y(asset.balanceUsd, "USD");
  const a11yState =
    asset.isEarning && asset.apy
      ? `, rindiendo ${(asset.apy * 100).toFixed(1)}% anual`
      : asset.change24h !== undefined
        ? `, ${asset.change24h >= 0 ? "subió" : "bajó"} ${Math.abs(asset.change24h * 100).toFixed(1)}% hoy`
        : "";
  const a11yLabel = `${asset.name}, ${a11yNativeBalance}, ${a11yUsdValue}${a11yState}`;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={onPress ? "Tocar para ver detalles del asset" : undefined}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 12,
        }}
      >
        <AssetIcon asset={asset} size={48} />

        <View style={{ flex: 1, minWidth: 0 }}>
          {/* TOP LINE: nombre (left) + balance nativo (right) */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
              {asset.name}
            </Text>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 15,
                lineHeight: 20,
                letterSpacing: -0.1,
                color: colors.text.primary,
              }}
              allowFontScaling={false}
              numberOfLines={1}
            >
              {formatNative(asset.balance, asset)} {asset.shortName}
            </Text>
          </View>

          {/* BOTTOM LINE: sub (izq) + USD equivalent (der) */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View style={{ flex: 1 }}>{subLine}</View>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 12,
                lineHeight: 16,
                color: colors.text.tertiary,
                letterSpacing: 0,
              }}
              allowFontScaling={false}
            >
              ${formattedUsd}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
