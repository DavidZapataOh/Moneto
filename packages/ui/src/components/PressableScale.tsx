import { springs, durations } from "@moneto/theme";
import { forwardRef, useCallback } from "react";
import { Pressable, type PressableProps, type View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { haptics, type HapticPattern } from "../hooks/useHaptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<
  PressableProps,
  "style" | "children" | "onPress"
> {
  /** Contenido. */
  children: React.ReactNode;
  /** Cuánto se encoge al pulsar. Default 0.97 (sutil). */
  scaleTo?: number;
  /** Opacidad target durante press. Default 0.85. */
  pressedOpacity?: number;
  /** Patrón haptic — `null` para desactivar. Default `"tap"`. */
  haptic?: HapticPattern | null;
  /** Handler. No se dispara si `disabled`. */
  onPress?: () => void;
  /** Style estático aplicado debajo del transform animado. */
  style?: PressableProps["style"];
}

/**
 * Pressable primitive con scale + opacity feedback + haptic estandarizado.
 *
 * Usado como base de Button, IconButton, ListItem y cualquier tap-target
 * custom que quiera el "tactile press" del design system. Encapsula el
 * spring (`springs.tap`) para que el feedback sea consistente cross-app.
 *
 * @example
 *   <PressableScale onPress={handle} haptic="medium">
 *     <Card>...</Card>
 *   </PressableScale>
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  {
    children,
    scaleTo = 0.97,
    pressedOpacity = 0.85,
    haptic = "tap",
    onPress,
    disabled,
    style,
    testID,
    ...rest
  },
  ref,
) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(scaleTo, springs.tap);
    opacity.value = withTiming(pressedOpacity, { duration: durations.instant });
  }, [scale, opacity, scaleTo, pressedOpacity]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, springs.tap);
    opacity.value = withTiming(1, { duration: durations.fast });
  }, [scale, opacity]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (haptic) haptics[haptic]();
    onPress?.();
  }, [disabled, haptic, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      ref={ref as never}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityState={disabled ? { disabled: true } : undefined}
      testID={testID}
      style={[animatedStyle, style as never]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
});

PressableScale.displayName = "PressableScale";
