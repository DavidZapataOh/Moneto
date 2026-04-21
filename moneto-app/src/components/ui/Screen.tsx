import { View, ViewProps, ScrollView, ScrollViewProps, StatusBar, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@hooks/useTheme";

interface ScreenProps extends ViewProps {
  scroll?: boolean;
  scrollProps?: ScrollViewProps;
  padded?: boolean;
  edges?: ("top" | "bottom" | "left" | "right")[];
  bg?: "primary" | "elevated" | "sunken";
}

/**
 * Top-level screen wrapper.
 * - Aplica safe area insets
 * - Respeta tema dark/light
 * - Optional scroll
 * - No usa pure white/black — siempre tokens del sistema
 */
export function Screen({
  children,
  scroll = false,
  scrollProps,
  padded = true,
  edges = ["top", "left", "right"],
  bg = "primary",
  style,
  ...rest
}: ScreenProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const bgColor = colors.bg[bg];

  const content = (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: bgColor,
          paddingHorizontal: padded ? 20 : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={{ flex: 1, backgroundColor: bgColor }}
    >
      {Platform.OS === "android" && (
        <StatusBar
          backgroundColor={bgColor}
          barStyle={isDark ? "light-content" : "dark-content"}
        />
      )}
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
