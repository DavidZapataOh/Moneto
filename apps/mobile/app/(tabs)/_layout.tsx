import { Ionicons } from "@expo/vector-icons";
import { useTheme, haptics } from "@moneto/ui";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Platform, View, StyleSheet } from "react-native";

import { TAB_BAR_CONTENT_HEIGHT, useTabBarBottomPad } from "@hooks/useTabBarSpace";

/**
 * Bottom tab bar spec:
 * - iOS: 56pt content + 34pt home indicator = 90pt total (Revolut/Nubank-tier)
 * - iPhone SE (home button): 56pt + 8pt padding = 64pt total
 * - Android gesture nav: 64dp content + 24dp inset = 88dp total
 * - Android 3-button: 64dp content + 48dp inset = 112dp total
 *
 * Icon 24pt (Apple HIG) / 24dp (Material) · label 11pt iOS / 12sp Android
 */
export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const bottomPad = useTabBarBottomPad();
  const totalHeight = TAB_BAR_CONTENT_HEIGHT + bottomPad;

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
      screenListeners={{
        tabPress: () => haptics.select(),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Saldo",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="card"
        options={{
          title: "Tarjeta",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "card" : "card-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activos"
        options={{
          title: "Activos",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "layers" : "layers-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Yo",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person-circle" : "person-circle-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
