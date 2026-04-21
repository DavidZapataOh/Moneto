import { useState } from "react";
import { View, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Screen } from "@components/ui/Screen";
import { Text } from "@components/ui/Text";
import { Card } from "@components/ui/Card";
import { Badge } from "@components/ui/Badge";
import { IconButton } from "@components/ui/IconButton";
import { Divider } from "@components/ui/Divider";
import { VirtualCard } from "@components/features/VirtualCard";
import { TransactionRow } from "@components/features/TransactionRow";
import { useAppStore } from "@stores/useAppStore";
import { useTheme } from "@hooks/useTheme";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { haptics } from "@hooks/useHaptics";
import { fonts } from "@theme/typography";

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
    <Screen padded={false} edges={["top"]} scroll>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        {/* Header */}
        <View style={{ marginBottom: 28 }}>
          <Text variant="label" tone="secondary">
            Tu tarjeta Visa
          </Text>
          <Text variant="h2" style={{ marginTop: 4 }}>
            Privada por default
          </Text>
        </View>

        {/* Card visual */}
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

        <Animated.View entering={FadeIn.duration(400).delay(120)}>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 20 }}>
            <Badge
              label={frozen ? "Congelada" : "Activa"}
              tone={frozen ? "warning" : "success"}
            />
            <Badge label="Virtual" tone="neutral" />
            <Badge label="Apple Pay" tone="brand" />
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(180)}
          style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginBottom: 24 }}
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
            onPress={() => {}}
          />
        </Animated.View>

        {/* Daily usage */}
        <Animated.View entering={FadeInDown.duration(400).delay(260)}>
          <Card variant="outlined" padded radius="lg">
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View>
                <Text variant="label" tone="secondary">
                  Gastado hoy
                </Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 }}>
                  <Text
                    style={{
                      fontFamily: fonts.monoMedium,
                      fontSize: 22,
                      color: colors.text.primary,
                    }}
                  >
                    ${card.spentTodayUsd.toFixed(2)}
                  </Text>
                  <Text variant="bodySmall" tone="tertiary">
                    / ${card.limitDailyUsd}
                  </Text>
                </View>
              </View>
              <Text variant="bodySmall" tone="tertiary">
                {(100 - spentPct).toFixed(0)}% disponible
              </Text>
            </View>

            {/* Progress bar */}
            <View
              style={{
                height: 6,
                backgroundColor: colors.bg.overlay,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${spentPct}%`,
                  backgroundColor: colors.brand.primary,
                  borderRadius: 3,
                }}
              />
            </View>
          </Card>
        </Animated.View>

        {/* Transactions */}
        <View style={{ marginTop: 32 }}>
          <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
            Movimientos con tarjeta
          </Text>
          {transactions.length === 0 ? (
            <Card variant="sunken" padded>
              <Text variant="body" tone="secondary" style={{ textAlign: "center" }}>
                Aún sin gastos hoy.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: 2 }}>
              {transactions.map((tx, i) => (
                <View key={tx.id}>
                  <TransactionRow tx={tx} />
                  {i < transactions.length - 1 && <Divider />}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: bottomSpace }} />
      </View>
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
      style={({ pressed }) => ({
        alignItems: "center",
        gap: 8,
        opacity: pressed ? 0.6 : 1,
      })}
      hitSlop={8}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.bg.elevated,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={20} color={colors.text.primary} />
      </View>
      <Text variant="bodySmall" tone="secondary" style={{ fontSize: 11 }}>
        {label}
      </Text>
    </Pressable>
  );
}
