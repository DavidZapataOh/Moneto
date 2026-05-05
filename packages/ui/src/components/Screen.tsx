import { forwardRef } from "react";
import {
  View,
  type ViewProps,
  ScrollView,
  type ScrollViewProps,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets, type Edge } from "react-native-safe-area-context";

import { useTheme } from "../hooks/useTheme";

export type ScreenBg = "primary" | "elevated" | "sunken";

export interface ScreenProps extends ViewProps {
  /** Wrap el contenido en `<ScrollView>`. Default `false`. */
  scroll?: boolean;
  /** Props pasadas al `<ScrollView>` interno (solo si `scroll`). */
  scrollProps?: ScrollViewProps;
  /** Aplica `paddingHorizontal: 20`. Default `true`. */
  padded?: boolean;
  /** Edges donde aplicar safe area. Default `["top", "left", "right"]`. */
  edges?: Edge[];
  /** Background semantic. Default `primary`. */
  bg?: ScreenBg;
  /**
   * Si la pantalla es un modal (presentación slide-from-bottom o
   * fullScreenModal), aplica `accessibilityViewIsModal` para que
   * VoiceOver/TalkBack lock-een el focus dentro del modal y no permitan
   * navigate al content de fondo. Default `false`.
   */
  isModal?: boolean;
}

/**
 * Top-level screen wrapper.
 *
 * - Safe area insets aplicados via `react-native-safe-area-context`.
 * - StatusBar style tracked al modo (Android setea bg color directo).
 * - Theme background — nunca puro blanco/negro.
 * - Optional `scroll` con `paddingBottom` que respeta `insets.bottom`.
 *
 * Convención: TODA pantalla top-level del app va wrapped en `<Screen>`.
 * Sub-views (modales, sheets) usan `<Card>` directamente.
 *
 * @example
 *   <Screen scroll>
 *     <Text variant="h2">Saldo</Text>
 *     ...
 *   </Screen>
 *
 *   <Screen padded={false} edges={["top", "bottom"]}>
 *     <FullBleedHero />
 *   </Screen>
 */
export const Screen = forwardRef<View, ScreenProps>(function Screen(
  {
    children,
    scroll = false,
    scrollProps,
    padded = true,
    edges = ["top", "left", "right"],
    bg = "primary",
    isModal = false,
    style,
    testID,
    ...rest
  },
  ref,
) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const bgColor = colors.bg[bg];

  const content = (
    <View
      ref={ref}
      testID={testID}
      accessibilityViewIsModal={isModal}
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
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: bgColor }}>
      {Platform.OS === "android" && (
        <StatusBar backgroundColor={bgColor} barStyle={isDark ? "light-content" : "dark-content"} />
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
});

Screen.displayName = "Screen";
