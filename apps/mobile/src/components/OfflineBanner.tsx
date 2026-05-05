import { Ionicons } from "@expo/vector-icons";
import { Text, useTheme } from "@moneto/ui";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNetworkStatus } from "@hooks/useNetworkStatus";

const ANIMATION_DURATION_MS = 220;

/**
 * Banner sutil al top de la app cuando el device está offline. Slide
 * down desde arriba del safe area, auto-hide al recovery con un slide
 * up.
 *
 * Diseño (colors.txt + design.txt):
 * - **Color = warning** (no danger). Estar offline NO es destructive,
 *   es un attention state que el user puede resolver. Coherent con el
 *   pattern de KYC pending.
 * - Icon `cloud-offline-outline` reconocible. Copy corto: "Sin conexión".
 * - Position fixed above safe area top → no usurpa el header de la
 *   pantalla, no provoca jump del content.
 * - z-index alto pero `pointerEvents="none"` → no intercepta taps.
 */
export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const offline = !isOnline;

  // Animación: translateY de -100% (escondido) a 0 (visible).
  const progress = useSharedValue(offline ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(offline ? 1 : 0, {
      duration: ANIMATION_DURATION_MS,
      easing: Easing.out(Easing.quad),
    });
  }, [offline, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * -64 }],
    opacity: progress.value,
  }));

  // No-op render cuando online y la animación terminó — evita layer
  // extra activo. Pero mientras se está animando para esconder, dejamos
  // que el componente siga visible para que el slide-up se vea.
  // (Heurística: render siempre; el opacity 0 + translateY off-screen
  // se encarga del visual hide.)

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        animatedStyle,
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top,
          zIndex: 1000,
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 8,
          backgroundColor: colors.warning,
        }}
        accessibilityLiveRegion="polite"
        accessibilityLabel="Sin conexión a internet"
      >
        <Ionicons name="cloud-offline-outline" size={14} color={colors.text.inverse} />
        <Text variant="bodySmall" style={{ color: colors.text.inverse, fontWeight: "600" }}>
          Sin conexión
        </Text>
      </View>
    </Animated.View>
  );
}
