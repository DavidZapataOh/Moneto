import { Ionicons } from "@expo/vector-icons";
import { Card, Divider, Screen, Text, useTheme, haptics } from "@moneto/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { capture, Events, getPostHog } from "@/lib/observability";

/**
 * Modal "Gestionar prioridades de pago" — el user define en qué orden
 * Moneto consume sus assets cuando paga / convierte / retira. Stables
 * primero (USD/COP) preserva crypto que aprecia.
 *
 * Sprint 2 (este): UI cosmética. Lista reordenable con copy explicando
 * el comportamiento. Persistimos local en `useState` (cuando el modal
 * cierra, la elección se pierde — feature flag de futuro).
 *
 * Sprint 6: el `priorityOrder` se persiste en `user_preferences` y se
 * lee desde el payment router server-side. Todo este screen ya queda
 * armado para que el Sprint 6 sea solo wiring.
 */

type AssetKey = "usd" | "cop" | "sol" | "btc";

interface PriorityItem {
  id: AssetKey;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const DEFAULT_ORDER: PriorityItem[] = [
  { id: "usd", label: "USD", description: "Dólar — sin volatilidad", icon: "logo-usd" },
  { id: "cop", label: "COPm", description: "Peso colombiano — gasto local", icon: "cash-outline" },
  { id: "sol", label: "SOL", description: "Crypto líquido", icon: "flash-outline" },
  { id: "btc", label: "BTC", description: "Reserva de valor", icon: "logo-bitcoin" },
];

export default function AssetPrioritiesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [order, setOrder] = useState<PriorityItem[]>(DEFAULT_ORDER);

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    haptics.select();
    const next = [...order];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    setOrder(next);
    const ph = getPostHog();
    if (ph && moved) {
      capture(ph, Events.assets_priorities_changed, { asset: moved.id, direction });
    }
  };

  const handleClose = () => {
    haptics.tap();
    router.back();
  };

  return (
    <Screen padded edges={["top", "bottom"]} scroll>
      {/* Header — close button + title */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 4,
          marginBottom: 16,
        }}
      >
        <Text variant="h2">Prioridades</Text>
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      <Text variant="body" tone="secondary" style={{ marginBottom: 24, lineHeight: 22 }}>
        Cuando pagás, retirás o convertís, Moneto usa tus assets en este orden. Mové los stables
        arriba para preservar tu crypto que aprecia.
      </Text>

      <Card variant="elevated" padded={false} radius="lg">
        {order.map((item, i) => (
          <View key={item.id}>
            <PriorityRow
              item={item}
              index={i}
              total={order.length}
              onMoveUp={() => moveItem(i, -1)}
              onMoveDown={() => moveItem(i, 1)}
            />
            {i < order.length - 1 && (
              <View style={{ paddingHorizontal: 16 }}>
                <Divider />
              </View>
            )}
          </View>
        ))}
      </Card>

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 8,
          marginTop: 20,
        }}
      >
        <Ionicons
          name="information-circle-outline"
          size={16}
          color={colors.text.tertiary}
          style={{ marginTop: 2 }}
        />
        <Text variant="bodySmall" tone="tertiary" style={{ flex: 1, lineHeight: 18 }}>
          La integración con el payment router se conecta en Sprint 6. Por ahora podés explorar el
          flow — tu elección no se persiste todavía.
        </Text>
      </View>
    </Screen>
  );
}

function PriorityRow({
  item,
  index,
  total,
  onMoveUp,
  onMoveDown,
}: {
  item: PriorityItem;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { colors } = useTheme();
  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.bg.overlay,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text variant="label" tone="secondary" style={{ fontSize: 12 }}>
          {index + 1}
        </Text>
      </View>

      <Ionicons name={item.icon} size={18} color={colors.text.secondary} />

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {item.label}
        </Text>
        <Text variant="bodySmall" tone="tertiary" numberOfLines={1}>
          {item.description}
        </Text>
      </View>

      {/* Up/Down chevrons — más simple que un drag handle, suficiente
          para 4 items. Sprint 8 polish puede swap a react-native-draggable-flatlist. */}
      <View style={{ flexDirection: "row", gap: 4 }}>
        <ArrowButton
          direction="up"
          enabled={canMoveUp}
          onPress={onMoveUp}
          accessibilityLabel={`Mover ${item.label} arriba`}
        />
        <ArrowButton
          direction="down"
          enabled={canMoveDown}
          onPress={onMoveDown}
          accessibilityLabel={`Mover ${item.label} abajo`}
        />
      </View>
    </View>
  );
}

function ArrowButton({
  direction,
  enabled,
  onPress,
  accessibilityLabel,
}: {
  direction: "up" | "down";
  enabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.bg.overlay,
        opacity: !enabled ? 0.3 : pressed ? 0.6 : 1,
      })}
    >
      <Ionicons
        name={direction === "up" ? "chevron-up" : "chevron-down"}
        size={16}
        color={colors.text.primary}
      />
    </Pressable>
  );
}
