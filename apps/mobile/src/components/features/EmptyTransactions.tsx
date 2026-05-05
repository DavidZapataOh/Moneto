import { Ionicons } from "@expo/vector-icons";
import { Text, useTheme, haptics } from "@moneto/ui";
import { useRouter } from "expo-router";
import { View, Pressable } from "react-native";

/**
 * Empty state cuando el user todavía no tiene movimientos.
 *
 * Diseño:
 * - Mismo height que el wrapper de 5 rows (~ 5 × 80 = 400, pero acá usamos
 *   ~200 con copy + CTA — la diferencia visual deja claro al user que NO
 *   está cargando: hay un mensaje activo).
 * - Icon grande y opacity-reducido (no compite con el balance hero por
 *   atención visual).
 * - CTA primary "Recibir" — el camino natural para que el dashboard se
 *   llene es aceptar tu primer pago.
 * - Tono cálido en español: invitación, no error.
 */
export function EmptyTransactions() {
  const router = useRouter();
  const { colors } = useTheme();

  const handleReceive = () => {
    haptics.medium();
    router.push("/receive");
  };

  return (
    <View style={{ paddingHorizontal: 24, paddingVertical: 32, alignItems: "center", gap: 16 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.bg.overlay,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="receipt-outline" size={26} color={colors.text.tertiary} />
      </View>

      <View style={{ alignItems: "center", gap: 4 }}>
        <Text variant="bodyMedium">Aún sin movimientos</Text>
        <Text variant="bodySmall" tone="tertiary" style={{ textAlign: "center", maxWidth: 280 }}>
          Tu primer pago aparecerá acá. Compartí tu link para empezar a recibir.
        </Text>
      </View>

      <Pressable
        onPress={handleReceive}
        accessibilityRole="button"
        accessibilityLabel="Recibir tu primer pago"
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 999,
          backgroundColor: colors.brand.primary,
        })}
      >
        <Ionicons name="arrow-down" size={16} color={colors.text.inverse} />
        <Text variant="bodySmall" style={{ color: colors.text.inverse, fontWeight: "600" }}>
          Recibir un pago
        </Text>
      </Pressable>
    </View>
  );
}
