import { Ionicons } from "@expo/vector-icons";
import { Screen, SectionHeader, Text, Card, Avatar, Divider, useTheme, haptics } from "@moneto/ui";
import { useRouter, type Href } from "expo-router";
import { Alert, View, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useLogout } from "@hooks/useLogout";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { useAppStore } from "@stores/useAppStore";
import { useThemeStore } from "@stores/useThemeStore";

const SECTION_GAP = 32;

type RowItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  // Top-right slot: value destacado (Verificado, Gestionar, "Activo")
  // Bottom line tiene sub a izq y meta a der SIEMPRE — así queda estructura 2-col
  sub: string; // izquierda línea inferior
  meta?: string; // derecha línea inferior
  route: string | null;
  badge?: string;
  badgeTone?: "brand" | "success";
};

const THEME_LABEL: Record<"system" | "light" | "dark", string> = {
  system: "Automático",
  light: "Claro",
  dark: "Oscuro",
};

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAppStore((s) => s.user);
  const themePreference = useThemeStore((s) => s.preference);
  const bottomSpace = useTabBarSpace();
  const { logout, isLoggingOut } = useLogout();

  const handleLogout = () => {
    if (isLoggingOut) return;
    haptics.tap();
    Alert.alert(
      "Cerrar sesión",
      "¿Seguro que querés cerrar sesión? Tu sesión se cerrará completamente. Vas a necesitar Face ID o tu cuenta para volver a entrar.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar sesión",
          style: "destructive",
          onPress: async () => {
            haptics.medium();
            const result = await logout();
            if (!result.ok && result.failedAt !== "privy") {
              // El navigation a /(onboarding) ya pasó (siempre escapamos),
              // pero avisamos que algo quedó a medio limpiar para que el
              // user sepa que un kill manual de la app no está de más.
              Alert.alert(
                "Sesión cerrada parcialmente",
                "Cerramos tu sesión pero algo falló al limpiar el cache. Para mayor seguridad cerrá la app y volvé a abrirla.",
              );
            }
          },
        },
      ],
    );
  };

  const sections: Array<{ header: string; items: RowItem[] }> = [
    {
      header: "Privacidad",
      items: [
        {
          icon: "shield-checkmark",
          label: "Viewing keys",
          sub: "Selective disclosure",
          meta: "1 activa",
          route: "/privacy",
          badge: "Gestionar",
          badgeTone: "brand",
        },
        {
          icon: "document-text",
          label: "Reporte fiscal",
          sub: "PDF para contador",
          meta: "Sin generar",
          route: "/privacy",
        },
        {
          icon: "lock-closed",
          label: "Seguridad",
          sub: "Face ID · 3 guardianes",
          meta: "Activo",
          route: null,
        },
      ],
    },
    {
      header: "Cuenta",
      items: [
        {
          icon: "ribbon",
          label: "Verificación KYC",
          sub: "Nivel 2",
          meta: "Completo",
          route: null,
          badge: "Verificado",
          badgeTone: "success",
        },
        {
          icon: "business",
          label: "Cuenta bancaria",
          sub: "Bancolombia",
          meta: "•••• 0284",
          route: null,
        },
        {
          icon: "people",
          label: "Guardianes",
          sub: "Recovery social",
          meta: "3 de 5",
          route: null,
        },
      ],
    },
    {
      header: "App",
      items: [
        {
          icon: "contrast",
          label: "Apariencia",
          sub: "Tema",
          meta: THEME_LABEL[themePreference],
          route: "/appearance",
        },
        {
          icon: "notifications",
          label: "Notificaciones",
          sub: "Push · Email",
          meta: "Activas",
          route: null,
        },
        {
          icon: "chatbubble-ellipses",
          label: "Soporte",
          sub: "Chat · Discord",
          meta: "Respuesta <24h",
          route: null,
        },
      ],
    },
  ];

  return (
    <Screen padded edges={["top"]} scroll>
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={{
          alignItems: "center",
          paddingTop: 16,
          paddingBottom: 24,
          gap: 16,
        }}
      >
        <Avatar name={user.name} size="xl" tone="brand" />
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text variant="h2">{user.name}</Text>
          <Text variant="bodySmall" tone="tertiary">
            {user.handle} · Colombia
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: "rgba(107, 122, 56, 0.16)",
          }}
        >
          <Ionicons name="shield-checkmark" size={12} color={colors.success} />
          <Text variant="label" style={{ color: colors.success }}>
            KYC nivel 2 verificado
          </Text>
        </View>
      </Animated.View>

      {sections.map((section, si) => (
        <Animated.View
          key={section.header}
          entering={FadeInDown.duration(400).delay(80 + si * 60)}
          style={{ marginTop: SECTION_GAP }}
        >
          <SectionHeader title={section.header} />
          <Card variant="elevated" padded={false} radius="lg">
            {section.items.map((item, i) => (
              <View key={item.label}>
                <SettingRow
                  item={item}
                  onPress={() => {
                    haptics.tap();
                    if (item.route) router.push(item.route as Href);
                  }}
                />
                {i < section.items.length - 1 && (
                  <View style={{ paddingHorizontal: 16 }}>
                    <Divider />
                  </View>
                )}
              </View>
            ))}
          </Card>
        </Animated.View>
      ))}

      <Pressable
        onPress={handleLogout}
        disabled={isLoggingOut}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoggingOut, busy: isLoggingOut }}
        style={({ pressed }) => ({
          marginTop: SECTION_GAP,
          opacity: isLoggingOut ? 0.5 : pressed ? 0.55 : 1,
        })}
      >
        <View style={{ paddingVertical: 16, alignItems: "center" }}>
          <Text variant="bodyMedium" tone="danger">
            {isLoggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
          </Text>
        </View>
      </Pressable>

      <View style={{ alignItems: "center", marginTop: 16 }}>
        <Text variant="bodySmall" tone="tertiary">
          Moneto v0.1.0
        </Text>
      </View>

      <View style={{ height: bottomSpace }} />
    </Screen>
  );
}

/**
 * Row iOS-Settings-grade con estructura 2-columnas en AMBAS líneas:
 *
 *   ┌────────────────────────────────────────────────────┐
 *   │  ◉   Viewing keys                  Gestionar  ›    │
 *   │      Selective disclosure          1 activa        │
 *   └────────────────────────────────────────────────────┘
 *
 * TOP LINE:    label (flex:1)          badge opcional
 * BOTTOM LINE: sub (izq)               meta (der)
 *
 * Siempre contenido a izquierda Y derecha en ambas líneas = estructura visible.
 */
function SettingRow({ item, onPress }: { item: RowItem; onPress: () => void }) {
  const { colors } = useTheme();

  const iconBg =
    item.badgeTone === "brand"
      ? "rgba(197, 103, 64, 0.18)"
      : item.badgeTone === "success"
        ? "rgba(107, 122, 56, 0.18)"
        : "rgba(255, 255, 255, 0.08)"; // visible en card elevated

  const iconColor =
    item.badgeTone === "brand"
      ? colors.brand.primary
      : item.badgeTone === "success"
        ? colors.success
        : colors.text.secondary;

  const badgeBg =
    item.badgeTone === "brand"
      ? "rgba(197, 103, 64, 0.16)"
      : item.badgeTone === "success"
        ? "rgba(107, 122, 56, 0.16)"
        : colors.bg.overlay;

  const badgeFg =
    item.badgeTone === "brand"
      ? colors.brand.primary
      : item.badgeTone === "success"
        ? colors.success
        : colors.text.secondary;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
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
          <Ionicons name={item.icon} size={20} color={iconColor} />
        </View>

        {/* Content column */}
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* TOP LINE: label + badge (si hay) */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
              {item.label}
            </Text>

            {item.badge && (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: badgeBg,
                  flexShrink: 0,
                }}
              >
                <Text variant="bodySmall" style={{ color: badgeFg, fontSize: 11 }}>
                  {item.badge}
                </Text>
              </View>
            )}
          </View>

          {/* BOTTOM LINE: sub (izq) + meta + chevron (der, inline y alineados) */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Text variant="bodySmall" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
              {item.sub}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              {item.meta && (
                <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
                  {item.meta}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
