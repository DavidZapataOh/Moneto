import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen } from "@components/ui/Screen";
import { Text } from "@components/ui/Text";
import { Card } from "@components/ui/Card";
import { Badge } from "@components/ui/Badge";
import { Divider } from "@components/ui/Divider";
import { YieldChart } from "@components/features/YieldChart";
import { useAppStore } from "@stores/useAppStore";
import { mockYieldHistory } from "@data/mock";
import { useTheme } from "@hooks/useTheme";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { fonts } from "@theme/typography";

const vaults = [
  { name: "Reflect USDC+", apy: 6.24, allocation: 62, color: "#C89450" },
  { name: "Huma PayFi", apy: 7.1, allocation: 28, color: "#C56740" },
  { name: "Kamino Lend", apy: 4.9, allocation: 10, color: "#7F786C" },
];

export default function YieldScreen() {
  const { colors } = useTheme();
  const balance = useAppStore((s) => s.balance);
  const bottomSpace = useTabBarSpace();

  return (
    <Screen padded={false} edges={["top"]} scroll>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <View style={{ marginBottom: 24 }}>
          <Text variant="label" tone="secondary">
            Tu dinero, creciendo
          </Text>
          <Text variant="h2" style={{ marginTop: 4 }}>
            Rendimiento privado
          </Text>
        </View>

        {/* Hero del yield acumulado */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card variant="sunken" padded radius="xl">
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="leaf" size={14} color={colors.value} />
                <Text variant="label" tone="value">
                  APY AUTO
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text
                  style={{
                    fontFamily: fonts.monoMedium,
                    fontSize: 56,
                    color: colors.value,
                    letterSpacing: -1.6,
                  }}
                >
                  {(balance.yieldApy * 100).toFixed(2)}%
                </Text>
                <Text variant="body" tone="tertiary">
                  ponderado
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall" tone="tertiary">
                    Hoy
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.monoMedium,
                      fontSize: 18,
                      color: colors.text.primary,
                    }}
                  >
                    +${balance.yieldAccrued24h.toFixed(2)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall" tone="tertiary">
                    Este mes
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.monoMedium,
                      fontSize: 18,
                      color: colors.text.primary,
                    }}
                  >
                    +${balance.yieldAccruedMonth.toFixed(2)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall" tone="tertiary">
                    Proyec. anual
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.monoMedium,
                      fontSize: 18,
                      color: colors.text.primary,
                    }}
                  >
                    +${(balance.totalUsd * balance.yieldApy).toFixed(0)}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: 4 }}>
                <YieldChart points={mockYieldHistory} height={100} />
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Vaults allocation */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(120)}
          style={{ marginTop: 28 }}
        >
          <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
            Dónde está tu dinero
          </Text>
          <Card variant="outlined" padded radius="lg">
            <View style={{ gap: 18 }}>
              {vaults.map((v) => (
                <View key={v.name} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: v.color,
                        }}
                      />
                      <Text variant="bodyMedium">{v.name}</Text>
                    </View>
                    <Text variant="amountSecondary" tone="value">
                      {v.apy.toFixed(2)}% APY
                    </Text>
                  </View>
                  <View
                    style={{
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
                        backgroundColor: v.color,
                        borderRadius: 2,
                      }}
                    />
                  </View>
                  <Text variant="bodySmall" tone="tertiary">
                    {v.allocation}% · ${((balance.totalUsd * v.allocation) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* Info card */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(240)}
          style={{ marginTop: 20 }}
        >
          <Card variant="elevated" padded radius="lg">
            <View style={{ flexDirection: "row", gap: 14 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "rgba(200, 148, 80, 0.16)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.value} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="bodyMedium">Tu rendimiento es privado</Text>
                <Text variant="bodySmall" tone="secondary" style={{ lineHeight: 20 }}>
                  Moneto reparte tu balance entre vaults usando cómputo encriptado. Ningún protocolo ve cuánto tenés; tú ves todo.
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        <View style={{ height: bottomSpace }} />
      </View>
    </Screen>
  );
}
