import { Ionicons } from "@expo/vector-icons";
import { Avatar, Card, Divider, Screen, SectionHeader, Text, haptics, useTheme } from "@moneto/ui";
import { useRouter, type Href } from "expo-router";
import { useCallback } from "react";
import { Alert, Pressable, RefreshControl, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { getCountryInfo } from "@/lib/countries";
import { capture, Events, getPostHog } from "@/lib/observability";
import { useDashboardData } from "@hooks/useDashboardData";
import { useLogout } from "@hooks/useLogout";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { useUnreadNotificationCount } from "@hooks/useUnreadNotificationCount";
import { useAppStore } from "@stores/useAppStore";
import { useThemeStore } from "@stores/useThemeStore";

const SECTION_GAP = 32;

type SectionKey = "privacidad" | "cuenta" | "app" | "legal";
type BadgeTone = "brand" | "success" | "warning";

interface RowItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  meta?: string;
  /** Si está set, el row navega. Si null, dispara `unavailableMessage`. */
  route: string | null;
  badge?: string;
  badgeTone?: BadgeTone;
  /** Mensaje "próximamente" custom para rows sin route. Si vacío, Alert default. */
  unavailableMessage?: string;
}

interface SectionDef {
  key: SectionKey;
  header: string;
  items: RowItem[];
}

const THEME_LABEL: Record<"system" | "light" | "dark", string> = {
  system: "Automático",
  light: "Claro",
  dark: "Oscuro",
};

/**
 * Yo screen — settings hub. Estructura iOS Settings-grade con sections
 * agrupadas por dominio (Privacidad / Cuenta / App / Legal).
 *
 * Filosofía visual aplicada (design.txt + colors.txt):
 * - **Hero como statement de identidad**: avatar XL + name + handle +
 *   country flag. KYC badge condicional comunica state.
 * - **Settings rows neutros**: el único color es el badge cuando aplica
 *   (Gestionar = brand, Verificado = success, Completá tu KYC = warning,
 *   Cerrar sesión = danger). Esto sigue colors.txt: *"Color should be
 *   reserved for communicating status."*
 * - **Logout destructive separado**: no es un row, es un Pressable text
 *   destructive con confirmation Alert. Fricción intencional.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAppStore((s) => s.user);
  const profile = useAppStore((s) => s.profile);
  const themePreference = useThemeStore((s) => s.preference);
  const bottomSpace = useTabBarSpace();
  const dashboard = useDashboardData();
  const unreadCount = useUnreadNotificationCount();
  const { logout, isLoggingOut } = useLogout();

  const country = getCountryInfo(profile.countryCode);
  const handle = profile.handle ?? user.handle;

  const handleRefresh = useCallback(async () => {
    haptics.tap();
    const ph = getPostHog();
    if (ph) capture(ph, Events.dashboard_refresh, { screen: "profile" });
    // Profile refresh = re-fetch del profile/KYC slice. Hoy mockeamos via
    // dashboard.refresh; Sprint 5 wirea invalidate de queries reales.
    await dashboard.refresh();
    haptics.success();
  }, [dashboard]);

  const handleLogout = useCallback(() => {
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
              Alert.alert(
                "Sesión cerrada parcialmente",
                "Cerramos tu sesión pero algo falló al limpiar el cache. Para mayor seguridad cerrá la app y volvé a abrirla.",
              );
            }
          },
        },
      ],
    );
  }, [isLoggingOut, logout]);

  const handleRowPress = useCallback(
    (section: SectionKey, item: RowItem) => {
      haptics.tap();
      const ph = getPostHog();
      if (ph) {
        capture(ph, Events.profile_setting_tapped, {
          section,
          item: item.id,
          has_target: item.route !== null,
        });
      }
      if (item.route) {
        router.push(item.route as Href);
      } else {
        Alert.alert(
          item.label,
          item.unavailableMessage ??
            "Esta sección llega en un próximo sprint. Estamos priorizando los flujos core.",
          [{ text: "Entendido" }],
        );
      }
    },
    [router],
  );

  const handleKycBadgePress = useCallback(() => {
    if (profile.kycLevel >= 1) return;
    haptics.tap();
    router.push(`/kyc?target_level=1` as Href);
  }, [profile.kycLevel, router]);

  // ── Sections — derivadas del profile real ────────────────────────────────
  const sections: SectionDef[] = [
    {
      key: "privacidad",
      header: "Privacidad",
      items: [
        {
          id: "viewing-keys",
          icon: "shield-checkmark",
          label: "Viewing keys",
          sub: "Selective disclosure",
          meta: "1 activa",
          route: "/privacy",
          badge: "Gestionar",
          badgeTone: "brand",
        },
        {
          id: "tax-report",
          icon: "document-text",
          label: "Reporte fiscal",
          sub: "PDF para contador",
          meta: "Sin generar",
          route: "/privacy",
        },
        {
          id: "security",
          icon: "lock-closed",
          label: "Seguridad",
          sub: "Face ID · 3 guardianes",
          meta: "Activo",
          route: null,
          unavailableMessage:
            "Configuración de Face ID + guardian recovery se conecta en Sprint 7 con el sistema Squads.",
        },
      ],
    },
    {
      key: "cuenta",
      header: "Cuenta",
      items: [
        {
          id: "kyc",
          icon: "ribbon",
          label: "Verificación KYC",
          sub: kycSubLabel(profile.kycLevel),
          meta: kycMetaLabel(profile.kycLevel),
          route: profile.kycLevel >= 3 ? null : "/kyc",
          ...(profile.kycLevel >= 1
            ? { badge: "Verificado" as const, badgeTone: "success" as const }
            : { badge: "Completar" as const, badgeTone: "warning" as const }),
        },
        {
          id: "bank",
          icon: "business",
          label: "Cuenta bancaria",
          sub: "Bancolombia",
          meta: "•••• 0284",
          route: null,
          unavailableMessage:
            "Cash-out a tu cuenta bancaria llega en Sprint 6 con la integración de Bold (Colombia) y rails locales LATAM.",
        },
        {
          id: "guardians",
          icon: "people",
          label: "Guardianes",
          sub: "Recovery social",
          meta: "3 de 5",
          route: null,
          unavailableMessage:
            "Squads-based social recovery llega en Sprint 7. Por ahora podés explorar la idea en /privacy.",
        },
      ],
    },
    {
      key: "app",
      header: "App",
      items: [
        {
          id: "appearance",
          icon: "contrast",
          label: "Apariencia",
          sub: "Tema",
          meta: THEME_LABEL[themePreference],
          route: "/appearance",
        },
        {
          id: "notifications",
          icon: "notifications",
          label: "Notificaciones",
          sub: "Push · Email",
          meta: unreadCount > 0 ? `${unreadCount} sin leer` : "Activas",
          route: null,
          unavailableMessage:
            "El centro de notificaciones (push + email + in-app) llega en Sprint 7.",
        },
        {
          id: "language",
          icon: "language",
          label: "Idioma",
          sub: "App language",
          meta: "Español",
          route: null,
          unavailableMessage:
            "El selector de idioma llega cuando expandamos beyond LATAM (Sprint 8). Por ahora todo en español.",
        },
        {
          id: "support",
          icon: "chatbubble-ellipses",
          label: "Soporte",
          sub: "Chat · Discord",
          meta: "Respuesta <24h",
          route: null,
          unavailableMessage:
            "El canal de soporte se abre con el lanzamiento beta. Mientras tanto: hello@moneto.app",
        },
      ],
    },
    {
      key: "legal",
      header: "Legal",
      items: [
        {
          id: "tos",
          icon: "document-outline",
          label: "Términos de servicio",
          sub: "Versión 0.1",
          route: null,
          unavailableMessage:
            "Los TOS se publican antes del lanzamiento beta (Sprint 8) — hoy estamos en pre-launch.",
        },
        {
          id: "privacy-policy",
          icon: "lock-closed-outline",
          label: "Privacidad",
          sub: "Cómo manejamos tu data",
          route: null,
          unavailableMessage:
            "La política de privacidad se publica antes del lanzamiento beta (Sprint 8).",
        },
      ],
    },
  ];

  return (
    <Screen
      padded
      edges={["top"]}
      scroll
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={dashboard.isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand.primary}
            colors={[colors.brand.primary]}
            progressBackgroundColor={colors.bg.elevated}
          />
        ),
      }}
    >
      {/* Hero */}
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
            {handle} · {country.flag} {country.name}
          </Text>
        </View>
        <KycBadge kycLevel={profile.kycLevel} onPress={handleKycBadgePress} />
      </Animated.View>

      {/* Sections */}
      {sections.map((section, si) => (
        <Animated.View
          key={section.key}
          entering={FadeInDown.duration(400).delay(80 + si * 60)}
          style={{ marginTop: SECTION_GAP }}
        >
          <SectionHeader title={section.header} />
          <Card variant="elevated" padded={false} radius="lg">
            {section.items.map((item, i) => (
              <View key={item.id}>
                <SettingRow item={item} onPress={() => handleRowPress(section.key, item)} />
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

      {/* Logout */}
      <Pressable
        onPress={handleLogout}
        disabled={isLoggingOut}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoggingOut, busy: isLoggingOut }}
        accessibilityLabel="Cerrar sesión"
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

// ─── Helpers locales ─────────────────────────────────────────────────────────

function kycSubLabel(level: 0 | 1 | 2 | 3): string {
  switch (level) {
    case 0:
      return "Necesario para mover montos mayores";
    case 1:
      return "Nivel 1";
    case 2:
      return "Nivel 2";
    case 3:
      return "Nivel 3";
  }
}

function kycMetaLabel(level: 0 | 1 | 2 | 3): string {
  switch (level) {
    case 0:
      return "$200 lifetime";
    case 1:
      return "$2.000 / mes";
    case 2:
      return "$10.000 / mes";
    case 3:
      return "Sin límite";
  }
}

/**
 * Badge inline del KYC. Tres estados:
 * - level 0 → "Completá tu verificación", warning, tappable → /kyc.
 * - level >= 1 → "KYC nivel X verificado", success, NO tappable.
 *
 * Usamos `colors.success` y `colors.warning` (no danger) — coherente con
 * colors.txt: *"red is for destructive."* KYC pendiente NO es
 * destructive, es amarillo "atención".
 */
function KycBadge({ kycLevel, onPress }: { kycLevel: 0 | 1 | 2 | 3; onPress: () => void }) {
  const { colors } = useTheme();
  const verified = kycLevel >= 1;

  const tone = verified ? colors.success : colors.warning;
  // RGBA tinted del color base — 0.16 alpha para que el chip se sienta
  // "iluminado" sin gritar. Coherente con el tinted background pattern
  // del resto de badges (TransactionRow icon bg, etc).
  const tintedBg = verified ? "rgba(168, 182, 90, 0.16)" : "rgba(224, 169, 82, 0.16)";

  const label = verified ? `KYC nivel ${kycLevel} verificado` : "Completá tu verificación";
  const icon = verified ? "shield-checkmark" : "alert-circle";

  return (
    <Pressable
      onPress={verified ? undefined : onPress}
      disabled={verified}
      accessibilityRole={verified ? "text" : "button"}
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: !verified && pressed ? 0.7 : 1 })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: tintedBg,
        }}
      >
        <Ionicons name={icon} size={12} color={tone} />
        <Text variant="label" style={{ color: tone }}>
          {label}
        </Text>
      </View>
    </Pressable>
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
 */
function SettingRow({ item, onPress }: { item: RowItem; onPress: () => void }) {
  const { colors } = useTheme();

  const iconBg =
    item.badgeTone === "brand"
      ? "rgba(197, 103, 64, 0.18)"
      : item.badgeTone === "success"
        ? "rgba(168, 182, 90, 0.18)"
        : item.badgeTone === "warning"
          ? "rgba(224, 169, 82, 0.18)"
          : "rgba(255, 255, 255, 0.08)";

  const iconColor =
    item.badgeTone === "brand"
      ? colors.brand.primary
      : item.badgeTone === "success"
        ? colors.success
        : item.badgeTone === "warning"
          ? colors.warning
          : colors.text.secondary;

  const badgeBg =
    item.badgeTone === "brand"
      ? "rgba(197, 103, 64, 0.16)"
      : item.badgeTone === "success"
        ? "rgba(168, 182, 90, 0.16)"
        : item.badgeTone === "warning"
          ? "rgba(224, 169, 82, 0.16)"
          : colors.bg.overlay;

  const badgeFg =
    item.badgeTone === "brand"
      ? colors.brand.primary
      : item.badgeTone === "success"
        ? colors.success
        : item.badgeTone === "warning"
          ? colors.warning
          : colors.text.secondary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.label}, ${item.sub}${item.meta ? `, ${item.meta}` : ""}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 16,
          gap: 12,
        }}
      >
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

        <View style={{ flex: 1, minWidth: 0 }}>
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

            {item.badge ? (
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
            ) : null}
          </View>

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
              {item.meta ? (
                <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
                  {item.meta}
                </Text>
              ) : null}
              <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
