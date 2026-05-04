import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen } from "@moneto/ui";
import { ScreenHeader, SectionHeader } from "@moneto/ui";
import { Text } from "@moneto/ui";
import { Card } from "@moneto/ui";
import { Divider } from "@moneto/ui";
import { YieldChart } from "@components/features/YieldChart";
import { AssetRow } from "@components/features/AssetRow";
import { useAppStore } from "@stores/useAppStore";
import {
  mockAssets,
  mockYieldHistory,
  totalPatrimonioUsd,
  weightedApy,
  totalEarningUsd,
} from "@data/mock";
import { useTheme } from "@moneto/ui";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { haptics } from "@moneto/ui";
import { fonts } from "@moneto/theme";

const SECTION_GAP = 32;

const vaults = [
  { name: "Reflect USDC+", apy: 6.24, allocation: 62 },
  { name: "Huma PayFi", apy: 7.1, allocation: 28 },
  { name: "Kamino Lend", apy: 4.9, allocation: 10 },
];

export default function ActivosScreen() {
  const { colors } = useTheme();
  const balance = useAppStore((s) => s.balance);
  const bottomSpace = useTabBarSpace();

  // Separar assets por categoría
  const earning = mockAssets.filter((a) => a.isEarning);
  const holdings = mockAssets.filter((a) => !a.isEarning);

  const change24h = balance.change24hUsd ?? 0;
  const changePct = balance.change24hPct ?? 0;

  return (
    <Screen padded edges={["top"]} scroll>
      <ScreenHeader title="Activos" subtitle="Tu patrimonio completo" />

      {/* Hero — Total patrimonio */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <Card variant="elevated" padded radius="lg">
          <Text variant="label" tone="tertiary" style={{ marginBottom: 8 }}>
            Patrimonio total
          </Text>

          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 40,
                lineHeight: 44,
                color: colors.text.primary,
                letterSpacing: -1.2,
              }}
              allowFontScaling={false}
              numberOfLines={1}
            >
              ${totalPatrimonioUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </Text>
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 16,
                color: colors.text.tertiary,
              }}
            >
              USD
            </Text>
          </View>

          {/* Change 24h */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
            }}
          >
            <Ionicons
              name={change24h >= 0 ? "trending-up" : "trending-down"}
              size={14}
              color={change24h >= 0 ? colors.success : colors.danger}
            />
            <Text
              variant="bodySmall"
              style={{
                color: change24h >= 0 ? colors.success : colors.danger,
                fontFamily: fonts.monoMedium,
              }}
            >
              {change24h >= 0 ? "+" : ""}${change24h.toFixed(2)} · {(changePct * 100).toFixed(2)}%
            </Text>
            <Text variant="bodySmall" tone="tertiary">
              hoy
            </Text>
          </View>

          {/* Yield mini summary */}
          <View
            style={{
              flexDirection: "row",
              marginTop: 20,
              paddingTop: 20,
              borderTopWidth: 1,
              borderTopColor: colors.border.subtle,
              gap: 12,
            }}
          >
            <StatCell
              label="Rindiendo"
              value={`$${totalEarningUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              tone="value"
            />
            <StatCell
              label="APY ponderado"
              value={`${(weightedApy * 100).toFixed(2)}%`}
              tone="value"
            />
            <StatCell
              label="Proyectado/año"
              value={`+$${(totalEarningUsd * weightedApy).toFixed(0)}`}
              tone="value"
            />
          </View>
        </Card>
      </Animated.View>

      {/* Gestionar prioridades */}
      <Pressable
        onPress={() => haptics.tap()}
        style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, marginTop: 12 })}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border.subtle,
          }}
        >
          <Ionicons name="options-outline" size={16} color={colors.text.secondary} />
          <Text variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
            Prioridad de pago: USD → COP → SOL → BTC
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
        </View>
      </Pressable>

      {/* Rindiendo */}
      {earning.length > 0 && (
        <Animated.View
          entering={FadeInDown.duration(400).delay(80)}
          style={{ marginTop: SECTION_GAP }}
        >
          <SectionHeader title="Rindiendo" />
          <Card variant="elevated" padded={false} radius="lg">
            {earning.map((asset, i) => (
              <View key={asset.id}>
                <AssetRow asset={asset} />
                {i < earning.length - 1 && (
                  <View style={{ paddingHorizontal: 16 }}>
                    <Divider />
                  </View>
                )}
              </View>
            ))}
          </Card>
        </Animated.View>
      )}

      {/* Holdings (volátiles) */}
      {holdings.length > 0 && (
        <Animated.View
          entering={FadeInDown.duration(400).delay(140)}
          style={{ marginTop: SECTION_GAP }}
        >
          <SectionHeader title="Holdings" />
          <Card variant="elevated" padded={false} radius="lg">
            {holdings.map((asset, i) => (
              <View key={asset.id}>
                <AssetRow asset={asset} />
                {i < holdings.length - 1 && (
                  <View style={{ paddingHorizontal: 16 }}>
                    <Divider />
                  </View>
                )}
              </View>
            ))}
          </Card>
        </Animated.View>
      )}

      {/* Chart + Vaults */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(200)}
        style={{ marginTop: SECTION_GAP }}
      >
        <SectionHeader title="Dónde rinde tu dinero" />
        <Card variant="elevated" padded radius="lg">
          <View style={{ marginHorizontal: -4, marginBottom: 16 }}>
            <YieldChart points={mockYieldHistory} height={90} />
          </View>

          {vaults.map((v, i) => (
            <View key={v.name}>
              <View
                style={{
                  paddingVertical: 12,
                  gap: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <Text variant="bodyMedium">{v.name}</Text>
                  <Text variant="amountPrimary" tone="value">
                    {v.apy.toFixed(2)}%
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Text variant="bodySmall" tone="tertiary">
                    {v.allocation}% · ${((totalEarningUsd * v.allocation) / 100).toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
                  </Text>
                  <View
                    style={{
                      width: 72,
                      height: 4,
                      backgroundColor: colors.bg.overlay,
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${v.allocation}%`,
                        backgroundColor: colors.value,
                        borderRadius: 2,
                        opacity: 0.75,
                      }}
                    />
                  </View>
                </View>
              </View>
              {i < vaults.length - 1 && <Divider />}
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* Info */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(260)}
        style={{ marginTop: 16, flexDirection: "row", gap: 12 }}
      >
        <Ionicons
          name="shield-checkmark-outline"
          size={16}
          color={colors.text.tertiary}
          style={{ marginTop: 2 }}
        />
        <Text variant="bodySmall" tone="tertiary" style={{ flex: 1 }}>
          Moneto reparte tu balance entre vaults usando cómputo encriptado. Ningún protocolo ve cuánto tenés.
        </Text>
      </Animated.View>

      <View style={{ height: bottomSpace }} />
    </Screen>
  );
}

function StatCell({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: string;
  tone?: "primary" | "value";
}) {
  const { colors } = useTheme();
  const valueColor = tone === "value" ? colors.value : colors.text.primary;

  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text variant="label" tone="tertiary" style={{ fontSize: 10 }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: 15,
          lineHeight: 20,
          color: valueColor,
        }}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {value}
      </Text>
    </View>
  );
}
