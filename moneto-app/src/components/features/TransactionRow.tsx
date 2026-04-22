import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { useTheme } from "@hooks/useTheme";
import { haptics } from "@hooks/useHaptics";
import { formatRelative } from "@lib/format";
import { fonts } from "@theme/typography";
import type { Transaction } from "@data/mock";

interface TransactionRowProps {
  tx: Transaction;
  onPress?: () => void;
  showDate?: boolean;
}

const typeConfig = {
  payroll: { icon: "arrow-down" as const, color: "success" as const, label: "Nómina" },
  p2p_in: { icon: "arrow-down" as const, color: "success" as const, label: "Recibido" },
  p2p_out: { icon: "arrow-up" as const, color: "primary" as const, label: "Enviado" },
  card: { icon: "card" as const, color: "primary" as const, label: "Tarjeta" },
  cashout: { icon: "cash" as const, color: "primary" as const, label: "Retiro" },
  yield: { icon: "leaf" as const, color: "value" as const, label: "Rendimiento" },
  credit: { icon: "git-branch" as const, color: "primary" as const, label: "Crédito" },
  qr_pay: { icon: "qr-code" as const, color: "primary" as const, label: "Pago QR" },
  swap: { icon: "swap-horizontal" as const, color: "value" as const, label: "Conversión" },
};

/**
 * Layout horizontal rica (como VaultRow en Yield):
 *
 *   ┌─────────────────────────────────────────────┐
 *   │  ◉   Acme Inc.               +$3,000 USD    │
 *   │      Nómina · hace 1 día     🔒 Privado     │
 *   └─────────────────────────────────────────────┘
 *
 * Top line: título (flex:1) + amount (derecha) baseline aligned
 * Bottom line: tipo · fecha (flex:1) + status privacy (derecha)
 * Ambas líneas tienen contenido a IZQUIERDA y DERECHA → estructura visible
 */
export function TransactionRow({
  tx,
  onPress,
  showDate = true,
}: TransactionRowProps) {
  const { colors } = useTheme();
  const cfg = typeConfig[tx.type];
  const isIncoming = tx.amount > 0;

  const amountColor =
    tx.type === "yield"
      ? colors.value
      : isIncoming
        ? colors.success
        : colors.text.primary;

  const iconBg =
    cfg.color === "success"
      ? "rgba(107, 122, 56, 0.18)"
      : cfg.color === "value"
        ? "rgba(200, 148, 80, 0.18)"
        : "rgba(255, 255, 255, 0.08)"; // visible en card elevated

  const iconColor =
    cfg.color === "success"
      ? colors.success
      : cfg.color === "value"
        ? colors.value
        : colors.text.secondary;

  const handlePress = () => {
    if (!onPress) return;
    haptics.tap();
    onPress();
  };

  const title = tx.counterpartyName ?? cfg.label;
  const typeLabel = tx.counterpartyName ? cfg.label : tx.description;
  const timeLabel = showDate ? formatRelative(tx.timestamp) : "";

  // Format amount — SIN nested Text
  const sign = tx.amount > 0 ? "+" : tx.amount < 0 ? "−" : "";
  const absAmt = Math.abs(tx.amount);
  const [intPart, decPart] = absAmt.toFixed(2).split(".");
  const formattedInt = parseInt(intPart, 10).toLocaleString("en-US");

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      {/* Layout exactamente como VaultRow: View plano con todo el styling */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 12,
        }}
      >
        {/* Icon 48×48 */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name={cfg.icon} size={20} color={iconColor} />
        </View>

        {/* Content column */}
        <View style={{ flex: 1, minWidth: 0 }}>
        {/* TOP LINE: title (left) + amount (right) */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>

          {/* Amount — View con dos Text separados (NO nested) */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              flexShrink: 0,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 16,
                lineHeight: 20,
                letterSpacing: -0.1,
                color: amountColor,
              }}
              allowFontScaling={false}
            >
              {sign}${formattedInt}
            </Text>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 12,
                lineHeight: 16,
                color: amountColor,
                opacity: 0.55,
              }}
              allowFontScaling={false}
            >
              .{decPart}
            </Text>
          </View>
        </View>

        {/* BOTTOM LINE: tipo · timestamp (la privacidad es invisible, no se comunica) */}
        <Text
          variant="bodySmall"
          tone="tertiary"
          numberOfLines={1}
        >
          {typeLabel}
          {timeLabel ? "  ·  " + timeLabel : ""}
        </Text>
      </View>
      </View>
    </Pressable>
  );
}
