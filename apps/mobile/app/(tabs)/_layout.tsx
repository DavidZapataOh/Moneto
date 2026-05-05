import { useTheme, haptics } from "@moneto/ui";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { useCallback, useRef } from "react";
import { AccessibilityInfo, Platform, View, StyleSheet } from "react-native";

import { AnimatedTabIcon } from "@/components/AnimatedTabIcon";
import { capture, Events, getPostHog } from "@/lib/observability";
import { TAB_BAR_CONTENT_HEIGHT, useTabBarBottomPad } from "@hooks/useTabBarSpace";
import { useUnreadNotificationCount } from "@hooks/useUnreadNotificationCount";

/**
 * Bottom tab bar spec:
 * - iOS: 56pt content + 34pt home indicator = 90pt total (Revolut/Nubank-tier)
 * - iPhone SE (home button): 56pt + 8pt padding = 64pt total
 * - Android gesture nav: 64dp content + 24dp inset = 88dp total
 * - Android 3-button: 64dp content + 48dp inset = 112dp total
 *
 * Icon 24pt (Apple HIG) / 24dp (Material) · label 11pt iOS / 12sp Android.
 *
 * BlurView nativo en iOS (intensity 80, premium feel), sólido en Android
 * (la implementación BlurView en Android es buggy + costosa en perf).
 */

type TabKey = "saldo" | "tarjeta" | "activos" | "yo";

const TAB_LABEL: Record<TabKey, string> = {
  saldo: "Saldo",
  tarjeta: "Tarjeta",
  activos: "Activos",
  yo: "Yo",
};

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const bottomPad = useTabBarBottomPad();
  const totalHeight = TAB_BAR_CONTENT_HEIGHT + bottomPad;
  const unreadCount = useUnreadNotificationCount();

  // Track de la tab actual para reportar `tab_switched.from`. `useRef` —
  // no queremos re-render cuando cambia, solo recordar el valor.
  const currentTab = useRef<TabKey>("saldo");

  const onTabPress = useCallback((next: TabKey) => {
    haptics.select();
    const prev = currentTab.current;
    if (prev !== next) {
      const ph = getPostHog();
      if (ph) capture(ph, Events.tab_switched, { from: prev, to: next });
      currentTab.current = next;
      // TalkBack/VoiceOver no anuncian consistentemente el tab change
      // (especialmente Android). Forzamos el announce explícito —
      // mensaje corto en español con el label de la tab destino.
      AccessibilityInfo.announceForAccessibility(`${TAB_LABEL[next]}, pestaña seleccionada`);
    }
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: Platform.OS === "ios" ? 11 : 12,
          letterSpacing: 0.2,
          marginTop: 3,
        },
        tabBarItemStyle: {
          paddingTop: 8,
          paddingBottom: 4,
          height: TAB_BAR_CONTENT_HEIGHT,
        },
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          borderTopColor: colors.border.subtle,
          borderTopWidth: StyleSheet.hairlineWidth,
          backgroundColor: Platform.OS === "ios" ? "transparent" : colors.bg.primary,
          height: totalHeight,
          paddingBottom: bottomPad,
          paddingTop: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              tint={isDark ? "dark" : "light"}
              intensity={80}
              style={{
                flex: 1,
                backgroundColor: isDark ? "rgba(20,16,11,0.72)" : "rgba(251,247,239,0.82)",
              }}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: colors.bg.primary }} />
          ),
      }}
      // Listener global — `screenListeners.tabPress` no permite leer el
      // target de la tab, así que cada Screen abajo wirea un listener
      // específico para enviar `from`/`to` correctos a PostHog.
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Saldo",
          tabBarAccessibilityLabel: "Saldo",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              focused={focused}
              icon={focused ? "home" : "home-outline"}
              color={color}
              label="Saldo"
            />
          ),
        }}
        listeners={{ tabPress: () => onTabPress("saldo") }}
      />
      <Tabs.Screen
        name="card"
        options={{
          title: "Tarjeta",
          tabBarAccessibilityLabel: "Tarjeta",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              focused={focused}
              icon={focused ? "card" : "card-outline"}
              color={color}
              label="Tarjeta"
            />
          ),
        }}
        listeners={{ tabPress: () => onTabPress("tarjeta") }}
      />
      <Tabs.Screen
        name="activos"
        options={{
          title: "Activos",
          tabBarAccessibilityLabel: "Activos",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              focused={focused}
              icon={focused ? "layers" : "layers-outline"}
              color={color}
              label="Activos"
            />
          ),
        }}
        listeners={{ tabPress: () => onTabPress("activos") }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Yo",
          tabBarAccessibilityLabel:
            unreadCount > 0 ? `Yo, ${unreadCount} notificaciones sin leer` : "Yo",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              focused={focused}
              icon={focused ? "person-circle" : "person-circle-outline"}
              color={color}
              label="Yo"
              {...(unreadCount > 0 ? { badge: unreadCount } : {})}
            />
          ),
        }}
        listeners={{ tabPress: () => onTabPress("yo") }}
      />
    </Tabs>
  );
}
