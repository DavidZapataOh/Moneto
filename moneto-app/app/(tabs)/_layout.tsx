import { Tabs } from "expo-router";
import { Platform, View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@hooks/useTheme";
import { haptics } from "@hooks/useHaptics";

const TAB_BAR_CONTENT_HEIGHT = 54;

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // En devices con home indicator iOS insets.bottom ~34
  // En Android con gesture nav insets.bottom ~16-24
  // En devices con home button físico insets.bottom ~0, damos 12 de respiro
  const bottomPad = insets.bottom > 0 ? insets.bottom : 12;
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10.5,
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
        tabBarItemStyle: {
          paddingTop: 8,
          height: TAB_BAR_CONTENT_HEIGHT,
        },
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          borderTopColor: colors.border.subtle,
          borderTopWidth: StyleSheet.hairlineWidth,
          backgroundColor:
            Platform.OS === "ios" ? "transparent" : colors.bg.primary,
          height: tabBarHeight,
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
                backgroundColor: isDark
                  ? "rgba(20,16,11,0.72)"
                  : "rgba(251,247,239,0.82)",
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
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="card"
        options={{
          title: "Tarjeta",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "card" : "card-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="yield"
        options={{
          title: "Rinde",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "leaf" : "leaf-outline"}
              size={22}
              color={color}
            />
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
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
