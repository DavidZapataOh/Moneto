import { useState } from "react";
import { View, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Screen } from "@components/ui/Screen";
import { ScreenHeader, SectionHeader } from "@components/ui/ScreenHeader";
import { Text } from "@components/ui/Text";
import { Card } from "@components/ui/Card";
import { Divider } from "@components/ui/Divider";
import { VirtualCard } from "@components/features/VirtualCard";
import { TransactionRow } from "@components/features/TransactionRow";
import { useAppStore } from "@stores/useAppStore";
import { useTheme } from "@hooks/useTheme";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { haptics } from "@hooks/useHaptics";
import { fonts } from "@theme/typography";

const SECTION_GAP = 32;

export default function CardScreen() {
  const { colors } = useTheme();
  const card = useAppStore((s) => s.card);
  const transactions = useAppStore((s) => s.transactions).filter(
    (t) => t.type === "card"
  );
  const [showDetails, setShowDetails] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const bottomSpace = useTabBarSpace();

  const spentPct = Math.min(100, (card.spentTodayUsd / card.limitDailyUsd) * 100);

  return (
    <Screen padded edges={["top"]} scroll>
      <ScreenHeader title="Tarjeta" subtitle="Virtual · privada por default" />

      {/* Card visual — único accent peak */}
      <Animated.View
        entering={FadeInDown.duration(420)}
        style={{ alignItems: "center", marginBottom: 20 }}
      >
        <VirtualCard
          last4={card.last4}
          cardholderName={card.cardholderName}
          showDetails={showDetails}
          onTap={() => setShowDetails((s) => !s)}
        />
      </Animated.View>

      {/* Status */}
      <Animated.View
        entering={FadeIn.duration(300).delay(120)}
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          marginBottom: SECTION_GAP,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: frozen ? colors.warning : colors.success,
          }}
        />
        <Text variant="bodySmall" tone="secondary">
          {frozen ? "Congelada — no permite pagos" : "Activa — Apple Pay listo"}
        </Text>
      </Animated.View>

      {/* Actions */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(180)}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: SECTION_GAP,
        }}
      >
        <CardAction
          icon={showDetails ? "eye-off-outline" : "eye-outline"}
          label={showDetails ? "Ocultar" : "Ver datos"}
          onPress={() => {
            haptics.tap();
            setShowDetails((s) => !s);
          }}
        />
        <CardAction
          icon="copy-outline"
          label="Copiar"
          onPress={async () => {
            haptics.success();
            await Clipboard.setStringAsync(`${card.last4}`);
          }}
        />
        <CardAction
          icon={frozen ? "flame-outline" : "snow-outline"}
          label={frozen ? "Descongelar" : "Congelar"}
          onPress={() => {
            haptics.medium();
            setFrozen((f) => !f);
          }}
        />
        <CardAction
          icon="settings-outline"
          label="Ajustes"
          onPress={() => haptics.tap()}
        />
      </Animated.View>

      {/* Daily usage card */}
      <Animated.View entering={FadeInDown.duration(400).delay(260)}>
        <SectionHeader title="Gastado hoy" />
        <Card variant="elevated" padded radius="lg">
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: 24,
                  lineHeight: 28,
                  color: colors.text.primary,
                  letterSpacing: -0.4,
                }}
              >
                ${card.spentTodayUsd.toFixed(2)}
              </Text>
              <Text variant="bodySmall" tone="tertiary">
                de ${card.limitDailyUsd}
              </Text>
            </View>
            <Text variant="bodySmall" tone="secondary">
              {(100 - spentPct).toFixed(0)}% libre
            </Text>
          </View>

          <View
            style={{
              height: 8,
              backgroundColor: colors.bg.overlay,
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: "100%",
                width: `${spentPct}%`,
                backgroundColor: colors.brand.primary,
                borderRadius: 4,
              }}
            />
          </View>
        </Card>
      </Animated.View>

      {/* Transactions */}
      <View style={{ marginTop: SECTION_GAP }}>
        <SectionHeader title="Movimientos con tarjeta" />
        {transactions.length === 0 ? (
          <Card variant="elevated" padded radius="lg">
            <View style={{ alignItems: "center", paddingVertical: 24, gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.bg.overlay,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="receipt-outline"
                  size={20}
                  color={colors.text.tertiary}
                />
              </View>
              <Text variant="bodySmall" tone="tertiary">
                Aún sin gastos hoy
              </Text>
            </View>
          </Card>
        ) : (
          <Card variant="elevated" padded={false} radius="lg">
            {transactions.map((tx, i) => (
              <View key={tx.id}>
                <TransactionRow tx={tx} showDate />
                {i < transactions.length - 1 && (
                  <View style={{ paddingHorizontal: 16 }}>
                    <Divider />
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}
      </View>

      <View style={{ height: bottomSpace }} />
    </Screen>
  );
}

function CardAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.55 : 1 })}
    >
      <View style={{ alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.bg.elevated,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={20} color={colors.text.primary} />
        </View>
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
