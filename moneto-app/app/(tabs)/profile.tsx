import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen } from "@components/ui/Screen";
import { SectionHeader } from "@components/ui/ScreenHeader";
import { Text } from "@components/ui/Text";
import { Card } from "@components/ui/Card";
import { Avatar } from "@components/ui/Avatar";
import { Divider } from "@components/ui/Divider";
import { useAppStore } from "@stores/useAppStore";
import { useTheme } from "@hooks/useTheme";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { haptics } from "@hooks/useHaptics";

const SECTION_GAP = 32;

type RowItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  // Top-right slot: value destacado (Verificado, Gestionar, "Activo")
  // Bottom line tiene sub a izq y meta a der SIEMPRE — así queda estructura 2-col
  sub: string;         // izquierda línea inferior
  meta?: string;       // derecha línea inferior
  route: string | null;
  badge?: string;
  badgeTone?: "brand" | "success";
};

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAppStore((s) => s.user);
  const bottomSpace = useTabBarSpace();

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
          meta: "Automático",
          route: null,
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
            {user.handle}  ·  Colombia
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
                    if (item.route) router.push(item.route as any);
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
        onPress={() => haptics.tap()}
        hitSlop={8}
        style={({ pressed }) => ({
          marginTop: SECTION_GAP,
          opacity: pressed ? 0.55 : 1,
        })}
      >
        <View style={{ paddingVertical: 16, alignItems: "center" }}>
          <Text variant="bodyMedium" tone="danger">
            Cerrar sesión
          </Text>
        </View>
      </Pressable>

      <View style={{ alignItems: "center", gap: 4, marginTop: 16 }}>
        <Text variant="bodySmall" tone="tertiary">
          Moneto v0.1.0
        </Text>
        <Text variant="label" tone="tertiary">
          Built on Solana
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
function SettingRow({
  item,
  onPress,
}: {
  item: RowItem;
  onPress: () => void;
}) {
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
    <Pressable
      onPress={onPress}
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
              <Text
                variant="bodySmall"
                style={{ color: badgeFg, fontSize: 11 }}
              >
                {item.badge}
              </Text>
            </View>
          )}
        </View>

        {/* BOTTOM LINE: sub (izq) + meta (der) */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            variant="bodySmall"
            tone="tertiary"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {item.sub}
          </Text>
          {item.meta && (
            <Text
              variant="bodySmall"
              tone="secondary"
              numberOfLines={1}
              style={{ flexShrink: 0 }}
            >
              {item.meta}
            </Text>
          )}
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.text.tertiary}
      />
      </View>
    </Pressable>
  );
}
