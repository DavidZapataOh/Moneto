import { useEffect } from "react";
import { type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../hooks/useTheme";

/**
 * Primitivo skeleton — pulsing rounded rect. Composiciones específicas
 * (BalanceSkeleton, TxRowSkeleton) viven en cada app porque dependen de
 * dimensiones del componente concreto que matchean.
 *
 * Color: `colors.bg.overlay` (un tinte sobre el bg.primary). Animación
 * de opacity 0.4 ↔ 0.7 con duration 900ms — suficientemente sutil para
 * que no compita con el rest del UI, suficientemente visible para que
 * el user entienda que algo está cargando.
 *
 * Accessibility: `accessibilityState.busy = true` — VoiceOver anuncia
 * "Cargando" sin necesidad de texto visible.
 *
 * @example
 *   <Skeleton width={80} height={12} radius={4} />
 *   <Skeleton width="60%" height={14} />
 */
export interface SkeletonProps {
  width?: number | `${number}%`;
  height: number;
  /** Default 8. */
  radius?: number;
  style?: ViewStyle;
  testID?: string;
}

export function Skeleton({ width, height, radius = 8, style, testID }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      testID={testID}
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.bg.overlay,
        },
        animatedStyle,
        style,
      ]}
      accessible
      accessibilityLabel="Cargando"
      accessibilityState={{ busy: true }}
    />
  );
}

Skeleton.displayName = "Skeleton";
