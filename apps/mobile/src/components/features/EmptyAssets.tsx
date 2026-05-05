import { Ionicons } from "@expo/vector-icons";
import { Text, useTheme, haptics } from "@moneto/ui";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

/**
 * Empty state cuando el user no tiene patrimonio (totalPatrimonioUsd === 0).
 *
 * Diseño (mobile-design.txt — gift framework):
 * - Copy invitacional ("Empezá tu patrimonio") en lugar de reportar ausencia.
 * - Icon low-contrast `wallet-outline` en círculo neutral → no compite
 *   con el balance hero ni con CTAs primarios de otras pantallas.
 * - CTA primary brand "Recibí tu primer pago" → navega a `/receive`.
 *   El camino natural es aceptar un pago, no comprar crypto.
 *
 * El user no debería ver este state después del MVP cuando hayan onramps —
 * pero queda como red de seguridad.
 */
export function EmptyAssets() {
  const router = useRouter();
  const { colors } = useTheme();

  const handlePress = () => {
    haptics.medium();
    router.push("/receive");
  };

  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 32,
        paddingHorizontal: 24,
        gap: 20,
      }}
    >
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: colors.bg.overlay,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="wallet-outline" size={40} color={colors.text.tertiary} />
      </View>

      <View style={{ alignItems: "center", gap: 8, maxWidth: 320 }}>
        <Text variant="h3">Empezá tu patrimonio</Text>
        <Text variant="body" tone="secondary" style={{ textAlign: "center", lineHeight: 22 }}>
          Cuando recibas tu primer pago, vas a ver acá tus saldos en USD, COP, SOL y más — todo en
          un solo lugar.
        </Text>
      </View>

      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Recibí tu primer pago"
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 999,
          backgroundColor: colors.brand.primary,
        })}
      >
        <Ionicons name="arrow-down" size={18} color={colors.text.inverse} />
        <Text variant="bodyMedium" style={{ color: colors.text.inverse, fontWeight: "600" }}>
          Recibí tu primer pago
        </Text>
      </Pressable>
    </View>
  );
}
