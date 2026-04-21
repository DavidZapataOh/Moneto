import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen } from "@components/ui/Screen";
import { Text } from "@components/ui/Text";
import { Card } from "@components/ui/Card";
import { Avatar } from "@components/ui/Avatar";
import { Badge } from "@components/ui/Badge";
import { Divider } from "@components/ui/Divider";
import { useAppStore } from "@stores/useAppStore";
import { useTheme } from "@hooks/useTheme";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { haptics } from "@hooks/useHaptics";

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAppStore((s) => s.user);
  const bottomSpace = useTabBarSpace();

  const sections = [
    {
      header: "Privacidad",
      items: [
        {
          icon: "shield-checkmark-outline" as const,
          label: "Viewing keys",
          sub: "1 activa · Contador tax 2026",
          route: "/privacy",
          accent: true,
        },
        {
          icon: "key-outline" as const,
          label: "Exportar reporte",
          sub: "PDF para contador o SAT/DIAN",
          route: "/privacy",
        },
        {
          icon: "lock-closed-outline" as const,
          label: "Seguridad del dispositivo",
          sub: "Face ID · 3 guardianes",
          route: null,
        },
      ],
    },
    {
      header: "Cuenta",
      items: [
        {
          icon: "document-text-outline" as const,
          label: "KYC",
          sub: "Nivel 2 · Verificado",
          route: null,
        },
        {
          icon: "business-outline" as const,
          label: "Cuentas bancarias",
          sub: "Bancolombia •••• 0284",
          route: null,
        },
        {
          icon: "people-outline" as const,
          label: "Guardianes",
          sub: "3 de 5 configurados",
          route: null,
        },
      ],
    },
    {
      header: "App",
      items: [
        {
          icon: "color-palette-outline" as const,
          label: "Apariencia",
          sub: "Automático",
          route: null,
        },
        {
          icon: "notifications-outline" as const,
          label: "Notificaciones",
          sub: "Push · Email",
          route: null,
        },
        {
          icon: "help-circle-outline" as const,
          label: "Soporte",
          sub: "Chat · Discord",
          route: null,
        },
      ],
    },
  ];

  return (
    <Screen padded={false} edges={["top"]} scroll>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card variant="sunken" padded radius="xl">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Avatar name={user.name} size="xl" tone="brand" />
              <View style={{ flex: 1 }}>
                <Text variant="h3">{user.name}</Text>
                <Text variant="bodySmall" tone="secondary">
                  {user.handle}
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  <Badge label="Verificada" tone="success" size="sm" />
                  <Badge label="🇨🇴 Colombia" tone="neutral" size="sm" />
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        {sections.map((section, si) => (
          <Animated.View
            key={section.header}
            entering={FadeInDown.duration(400).delay(80 + si * 60)}
            style={{ marginTop: 28 }}
          >
            <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
              {section.header}
            </Text>
            <Card variant="outlined" padded={false} radius="lg">
              {section.items.map((item, i) => (
                <View key={item.label}>
                  <SettingRow
                    icon={item.icon}
                    label={item.label}
                    sub={item.sub}
                    accent={item.accent}
                    onPress={
                      item.route
                        ? () => {
                            haptics.tap();
                            router.push(item.route as any);
                          }
                        : undefined
                    }
                  />
                  {i < section.items.length - 1 && (
                    <View style={{ paddingLeft: 64 }}>
                      <Divider />
                    </View>
                  )}
                </View>
              ))}
            </Card>
          </Animated.View>
        ))}

        <Pressable
          onPress={() => {
            haptics.tap();
          }}
          style={{
            marginTop: 28,
            padding: 16,
            alignItems: "center",
          }}
        >
          <Text variant="bodyMedium" tone="danger">
            Cerrar sesión
          </Text>
        </Pressable>

        <View style={{ alignItems: "center", gap: 4, marginTop: 12 }}>
          <Text variant="bodySmall" tone="tertiary">
            Moneto v0.1.0 · mainnet-beta
          </Text>
          <Text variant="label" tone="tertiary" style={{ letterSpacing: 1 }}>
            Built on Solana
          </Text>
        </View>

        <View style={{ height: bottomSpace }} />
      </View>
    </Screen>
  );
}

function SettingRow({
  icon,
  label,
  sub,
  accent,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  accent?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: pressed ? colors.bg.overlay : "transparent",
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: accent
            ? "rgba(197, 103, 64, 0.14)"
            : colors.bg.elevated,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={icon}
          size={17}
          color={accent ? colors.brand.primary : colors.text.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{label}</Text>
        {sub && (
          <Text variant="bodySmall" tone="tertiary">
            {sub}
          </Text>
        )}
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
      )}
    </Pressable>
  );
}
