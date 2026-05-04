import { springs, durations } from "@moneto/theme";
import { useEffect, useCallback } from "react";
import { Pressable, View, type AccessibilityProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { haptics } from "../hooks/useHaptics";
import { useTheme } from "../hooks/useTheme";

export type ToggleSize = "sm" | "md";

export interface ToggleProps extends Pick<
  AccessibilityProps,
  "accessibilityLabel" | "accessibilityHint"
> {
  /** Estado actual. Controlled. */
  value: boolean;
  /** Callback con el nuevo estado. */
  onValueChange: (next: boolean) => void;
  /** Bloquea interacción. */
  disabled?: boolean;
  /** Tamaño visual. Default `md`. */
  size?: ToggleSize;
  /** testID para E2E. */
  testID?: string;
}

const SIZE_MAP = {
  sm: { trackW: 36, trackH: 22, knob: 18, padding: 2 },
  md: { trackW: 48, trackH: 28, knob: 24, padding: 2 },
} as const;

/**
 * Themed switch con haptic + animated knob.
 *
 * Track usa `colors.brand.primary` cuando ON, `colors.border.default` cuando
 * OFF. Knob siempre `colors.bg.primary` (alto contraste con ambos tracks en
 * light + dark).
 *
 * @example
 *   <Toggle
 *     value={notifications}
 *     onValueChange={setNotifications}
 *     accessibilityLabel="Notificaciones push"
 *   />
 */
export function Toggle({
  value,
  onValueChange,
  disabled = false,
  size = "md",
  testID,
  accessibilityLabel,
  accessibilityHint,
}: ToggleProps) {
  const { colors } = useTheme();
  const s = SIZE_MAP[size];

  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, springs.tap);
  }, [value, progress]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    haptics.select();
    onValueChange(!value);
  }, [disabled, value, onValueChange]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (s.trackW - s.knob - s.padding * 2) }],
  }));

  const trackOpacity = useSharedValue(1);
  useEffect(() => {
    trackOpacity.value = withTiming(disabled ? 0.5 : 1, { duration: durations.fast });
  }, [disabled, trackOpacity]);

  const trackStyle = useAnimatedStyle(() => ({ opacity: trackOpacity.value }));

  const trackColor = value ? colors.brand.primary : colors.border.default;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={12}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      <Animated.View
        style={[
          {
            width: s.trackW,
            height: s.trackH,
            borderRadius: s.trackH / 2,
            padding: s.padding,
            backgroundColor: trackColor,
            justifyContent: "center",
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: s.knob,
              height: s.knob,
              borderRadius: s.knob / 2,
              backgroundColor: colors.bg.primary,
            },
            knobStyle,
          ]}
        />
        {/* invisible center overlay to keep knob + track aligned visually */}
        <View pointerEvents="none" style={{ position: "absolute" }} />
      </Animated.View>
    </Pressable>
  );
}

Toggle.displayName = "Toggle";
