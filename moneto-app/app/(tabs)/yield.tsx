import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen } from "@components/ui/Screen";
import { ScreenHeader, SectionHeader } from "@components/ui/ScreenHeader";
import { Text } from "@components/ui/Text";
import { Card } from "@components/ui/Card";
import { Divider } from "@components/ui/Divider";
import { YieldChart } from "@components/features/YieldChart";
import { useAppStore } from "@stores/useAppStore";
import { mockYieldHistory } from "@data/mock";
import { useTheme } from "@hooks/useTheme";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { fonts } from "@theme/typography";

const SECTION_GAP = 32;

const vaults = [
  { name: "Reflect USDC+", apy: 6.24, allocation: 62 },
  { name: "Huma PayFi", apy: 7.1, allocation: 28 },
  { name: "Kamino Lend", apy: 4.9, allocation: 10 },
];

export default function YieldScreen() {
  const { colors } = useTheme();
  const balance = useAppStore((s) => s.balance);
  const bottomSpace = useTabBarSpace();

  return (
    <Screen padded edges={["top"]} scroll>
      <ScreenHeader title="Rinde" subtitle="Tu dinero, creciendo en silencio" />

      {/* Hero — label arriba, número solo, subtitle abajo */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <Card variant="elevated" padded radius="lg">
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Ionicons name="leaf" size={12} color={colors.value} />
            <Text variant="label" tone="value">
              APY ponderado
            </Text>
          </View>

          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 48,
              lineHeight: 52,
              color: colors.value,
              letterSpacing: -1.2,
            }}
            allowFontScaling={false}
            numberOfLines={1}
          >
            {(balance.yieldApy * 100).toFixed(2)}%
          </Text>

          <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 4 }}>
            Auto-compounding · sobre tu saldo privado
          </Text>

          <View style={{ marginTop: 20, marginHorizontal: -4 }}>
            <YieldChart points={mockYieldHistory} height={96} />
          </View>

          <View
            style={{
              flexDirection: "row",
              marginTop: 20,
              paddingTop: 20,
              borderTopWidth: 1,
              borderTopColor: colors.border.subtle,
            }}
          >
            <StatCell
              label="Hoy"
              value={`+$${balance.yieldAccrued24h.toFixed(2)}`}
            />
            <StatCell
              label="Este mes"
              value={`+$${balance.yieldAccruedMonth.toFixed(2)}`}
            />
            <StatCell
              label="Proyectado"
              value={`+$${(balance.totalUsd * balance.yieldApy).toFixed(0)}`}
            />
          </View>
        </Card>
      </Animated.View>

      {/* Vaults allocation */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(120)}
        style={{ marginTop: SECTION_GAP }}
      >
        <SectionHeader title="Dónde está tu dinero" />
        <Card variant="elevated" padded={false} radius="lg">
          {vaults.map((v, i) => (
            <View key={v.name}>
              <VaultRow vault={v} balance={balance.totalUsd} />
              {i < vaults.length - 1 && (
                <View style={{ paddingHorizontal: 16 }}>
                  <Divider />
                </View>
              )}
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* Info */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(220)}
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

function StatCell({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text variant="label" tone="tertiary">
        {label}
      </Text>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: 16,
          lineHeight: 20,
          color: colors.text.primary,
        }}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {value}
      </Text>
    </View>
  );
}

function VaultRow({
  vault,
  balance,
}: {
  vault: { name: string; apy: number; allocation: number };
  balance: number;
}) {
  const { colors } = useTheme();
  const amount = (balance * vault.allocation) / 100;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 12,
      }}
    >
      {/* Icon bubble clay-tinted */}
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: "rgba(200, 148, 80, 0.18)",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Ionicons name="leaf" size={20} color={colors.value} />
      </View>

      {/* Text column */}
      <View style={{ flex: 1, minWidth: 0 }}>
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
            {vault.name}
          </Text>
          <Text variant="amountPrimary" tone="value">
            {vault.apy.toFixed(2)}%
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
            {vault.allocation}% · $
            {amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
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
                width: `${vault.allocation}%`,
                backgroundColor: colors.value,
                borderRadius: 2,
                opacity: 0.75,
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
