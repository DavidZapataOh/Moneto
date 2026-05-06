import { Ionicons } from "@expo/vector-icons";
import { Card, Text, useTheme, haptics } from "@moneto/ui";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";

import { getPushPermissionStatus } from "@/lib/notifications";

/**
 * Banner inline que aparece en la pantalla Saldo cuando el push permission
 * está `denied` (el user dijo "No permitir" en algún momento).
 *
 * Sprint 4.04. CTA → `Linking.openSettings()` para llevar al user
 * directo al panel de notifs del OS, donde puede activar.
 *
 * **Diseño** (design.txt + colors.txt + mobile-design.txt):
 * - **Sutil, no atemorizante**: variant `outlined` con border subtle,
 *   no llena de color ni forzamos un primary color. Coherente con el
 *   principio "color is reserved for status, not decoration".
 * - **Single emphasis**: el copy explica el valor; la CTA inline arrow
 *   indica "vamos al settings". No competimos con el balance hero del
 *   dashboard.
 * - **Auto-recheck on focus**: si el user vuelve del Settings, refrescamos
 *   el status. Así el banner desaparece sin force-reload.
 * - **Dismissible local**: el user puede esconderlo con la X. Lo
 *   reset-eamos en cada cold start (no persistimos el dismiss state —
 *   recordatorio amable, no spam).
 */
export function PushPermissionBanner() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<"unknown" | "denied" | "granted" | "undetermined">(
    "unknown",
  );
  const [dismissed, setDismissed] = useState(false);

  // Re-check al focus — útil cuando el user vuelve del Settings habilitado.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const next = await getPushPermissionStatus();
        if (cancelled) return;
        if (next === "denied") setStatus("denied");
        else if (next === "granted") setStatus("granted");
        else setStatus("undetermined");
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (status !== "denied" || dismissed) return null;

  const handleEnable = async () => {
    haptics.tap();
    try {
      await Linking.openSettings();
    } catch {
      // Algunos OEMs no soportan openSettings — el banner queda y el
      // user puede intentar manual.
    }
  };

  const handleDismiss = () => {
    haptics.tap();
    setDismissed(true);
  };

  return (
    <Card
      variant="outlined"
      padded
      radius="lg"
      style={{ marginTop: 12, marginBottom: 4 }}
      accessibilityLabel="Notificaciones desactivadas"
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: `${colors.brand.primary}1F`,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 2,
          }}
          aria-hidden
        >
          <Ionicons name="notifications-off-outline" size={18} color={colors.brand.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text variant="bodyMedium">Activá las notificaciones</Text>
          <Text variant="bodySmall" tone="tertiary" style={{ lineHeight: 18 }}>
            {Platform.OS === "ios"
              ? "Te avisamos cuando llega un pago o tu APY se actualiza."
              : "Recibí alertas cuando un pago llega o tu APY se actualiza."}
          </Text>
        </View>
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Descartar"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
        >
          <Ionicons name="close" size={16} color={colors.text.tertiary} />
        </Pressable>
      </View>

      <Pressable
        onPress={handleEnable}
        accessibilityRole="button"
        accessibilityLabel="Abrir Configuración para activar notificaciones"
        style={({ pressed }) => ({
          marginTop: 12,
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: colors.brand.primary,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text
          variant="bodySmall"
          style={{
            color: colors.text.inverse,
            fontWeight: "600",
          }}
        >
          Abrir Configuración
        </Text>
        <Ionicons name="arrow-forward" size={12} color={colors.text.inverse} />
      </Pressable>
    </Card>
  );
}
