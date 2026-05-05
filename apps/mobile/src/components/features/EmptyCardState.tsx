import { Ionicons } from "@expo/vector-icons";
import { Text, useTheme, haptics } from "@moneto/ui";
import { Pressable, View } from "react-native";

/**
 * Empty state cuando el user NO tiene tarjeta provisionada todavía.
 *
 * Sprint 1-2: cosmetic — el CTA no llama a un endpoint real porque Rain
 * issuance es Sprint 6. El user aún ve un placeholder funcional para que
 * la screen no esté vacía cuando entre.
 *
 * Diseño (mobile-design.txt — gift framework):
 * - Icon "card-outline" grande pero low-contrast → no compite con Saldo.
 * - Copy en español que **invita** ("Pedí tu tarjeta") en lugar de
 *   anunciar un missing state ("No hay tarjeta") — mejor UX vs reportar
 *   ausencia.
 * - CTA primary brand — único acento de color en la pantalla cuando
 *   estamos en este estado.
 */
export function EmptyCardState({ onRequest }: { onRequest: () => void }) {
  const { colors } = useTheme();

  const handlePress = () => {
    haptics.medium();
    onRequest();
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
        <Ionicons name="card-outline" size={40} color={colors.text.tertiary} />
      </View>

      <View style={{ alignItems: "center", gap: 8, maxWidth: 320 }}>
        <Text variant="h3">Pedí tu tarjeta Moneto</Text>
        <Text variant="body" tone="secondary" style={{ textAlign: "center", lineHeight: 22 }}>
          Una Visa virtual lista para usar online y agregar a Apple Pay o Google Pay. La física
          llega después si la querés.
        </Text>
      </View>

      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Solicitar tarjeta Moneto"
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
        <Ionicons name="card" size={18} color={colors.text.inverse} />
        <Text variant="bodyMedium" style={{ color: colors.text.inverse, fontWeight: "600" }}>
          Solicitar tarjeta
        </Text>
      </Pressable>

      <Text variant="bodySmall" tone="tertiary" style={{ textAlign: "center" }}>
        Sin costo de emisión · Disponible en todo LATAM
      </Text>
    </View>
  );
}
