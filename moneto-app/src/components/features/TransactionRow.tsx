import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { Avatar } from "../ui/Avatar";
import { AmountDisplay } from "../ui/AmountDisplay";
import { useTheme } from "@hooks/useTheme";
import { haptics } from "@hooks/useHaptics";
import { formatRelative } from "@lib/format";
import type { Transaction } from "@data/mock";

interface TransactionRowProps {
  tx: Transaction;
  onPress?: () => void;
  showDate?: boolean;
}

const typeConfig = {
  payroll: { icon: "arrow-down" as const, tone: "success" as const, label: "Salario" },
  p2p_in: { icon: "arrow-down" as const, tone: "success" as const, label: "Recibido" },
  p2p_out: { icon: "arrow-up" as const, tone: "secondary" as const, label: "Enviado" },
  card: { icon: "card-outline" as const, tone: "secondary" as const, label: "Tarjeta" },
  cashout: { icon: "cash-outline" as const, tone: "secondary" as const, label: "Retiro" },
  yield: { icon: "leaf-outline" as const, tone: "value" as const, label: "Rendimiento" },
  credit: { icon: "git-branch-outline" as const, tone: "secondary" as const, label: "Crédito" },
};

export function TransactionRow({ tx, onPress, showDate = true }: TransactionRowProps) {
  const { colors } = useTheme();
  const cfg = typeConfig[tx.type];
  const isIncoming = tx.amount > 0;

  const amountTone: "success" | "primary" | "value" =
    tx.type === "yield" ? "value" : isIncoming ? "success" : "primary";

  const handlePress = () => {
    if (!onPress) return;
    haptics.tap();
    onPress();
  };

  const iconBg =
    cfg.tone === "success"
      ? "rgba(107, 122, 56, 0.14)"
      : cfg.tone === "value"
        ? "rgba(200, 148, 80, 0.14)"
        : colors.bg.overlay;

  const iconColor =
    cfg.tone === "success"
      ? colors.success
      : cfg.tone === "value"
        ? colors.value
        : colors.text.secondary;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderRadius: 12,
        backgroundColor: pressed ? colors.bg.overlay : "transparent",
      })}
    >
      {tx.counterpartyName ? (
        <Avatar name={tx.counterpartyName} size="md" tone="neutral" />
      ) : (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={cfg.icon} size={18} color={iconColor} />
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {tx.counterpartyName ?? cfg.label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text variant="bodySmall" tone="tertiary">
            {tx.description}
          </Text>
          {showDate && (
            <>
              <View
                style={{
                  width: 2,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: colors.text.tertiary,
                }}
              />
              <Text variant="bodySmall" tone="tertiary">
                {formatRelative(tx.timestamp)}
              </Text>
            </>
          )}
          {tx.isPrivate && (
            <>
              <View
                style={{
                  width: 2,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: colors.text.tertiary,
                }}
              />
              <Ionicons name="lock-closed" size={10} color={colors.value} />
            </>
          )}
        </View>
      </View>

      <AmountDisplay
        amount={tx.amount}
        size="primary"
        tone={amountTone}
        showSign
      />
    </Pressable>
  );
}
