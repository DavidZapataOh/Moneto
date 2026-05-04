import { radius, springs, durations } from "@moneto/theme";
import { forwardRef, useCallback } from "react";
import { Pressable, type PressableProps, View, ActivityIndicator } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from "react-native-reanimated";

import { haptics, type HapticPattern } from "../hooks/useHaptics";
import { useTheme } from "../hooks/useTheme";

import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  /** Visual variant. Default `primary`. */
  variant?: ButtonVariant;
  /** Tamaño vertical + radius. Default `md`. */
  size?: ButtonSize;
  /** Texto principal. Mantener corto (≤2 palabras idealmente). */
  label: string;
  /** Icono delante del label (opcional). */
  leftIcon?: React.ReactNode;
  /** Icono detrás del label (opcional). */
  rightIcon?: React.ReactNode;
  /** Reemplaza el label con spinner; bloquea onPress. */
  loading?: boolean;
  /** Bloquea onPress + atenúa visual. */
  disabled?: boolean;
  /** Stretch al ancho del padre. */
  fullWidth?: boolean;
  /** Patrón haptic en press. Default `tap`. `null` para desactivar. */
  haptic?: HapticPattern | null;
  /** Handler de press. */
  onPress?: () => void;
}

const SIZE_MAP = {
  sm: { py: 10, px: 14, r: radius.md, iconGap: 6 },
  md: { py: 14, px: 18, r: radius.md, iconGap: 8 },
  lg: { py: 18, px: 22, r: radius.lg, iconGap: 10 },
} as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Primary action button. Animated press + haptic + a11y por default.
 *
 * `disabled || loading` previenen onPress. `accessibilityRole="button"` y
 * `accessibilityState` se setean automáticamente — no hace falta pasarlos.
 *
 * @example
 *   <Button label="Continuar" onPress={handle} fullWidth />
 *   <Button label="Cancelar" variant="ghost" onPress={onCancel} />
 *   <Button label="Eliminar" variant="danger" haptic="heavy" onPress={onDelete} />
 */
export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    label,
    leftIcon,
    rightIcon,
    loading = false,
    disabled = false,
    fullWidth = false,
    haptic = "tap",
    onPress,
    accessibilityLabel,
    accessibilityHint,
    testID,
    ...rest
  },
  ref,
) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.97, springs.tap);
    opacity.value = withTiming(0.85, { duration: durations.instant });
  }, [scale, opacity]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, springs.tap);
    opacity.value = withTiming(1, { duration: durations.fast });
  }, [scale, opacity]);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    if (haptic) haptics[haptic]();
    onPress?.();
  }, [disabled, loading, haptic, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const variantStyle = (() => {
    switch (variant) {
      case "primary":
        return {
          bg: disabled ? colors.border.subtle : colors.brand.primary,
          fg: disabled ? colors.text.tertiary : colors.text.inverse,
          border: "transparent",
        };
      case "secondary":
        return {
          bg: "transparent",
          fg: disabled ? colors.text.tertiary : colors.text.primary,
          border: disabled ? colors.border.subtle : colors.border.default,
        };
      case "ghost":
        return {
          bg: "transparent",
          fg: disabled ? colors.text.tertiary : colors.text.secondary,
          border: "transparent",
        };
      case "danger":
        return {
          bg: disabled ? colors.border.subtle : colors.danger,
          fg: colors.text.inverse,
          border: "transparent",
        };
    }
  })();

  const s = SIZE_MAP[size];

  return (
    <AnimatedPressable
      ref={ref as never}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      disabled={disabled || loading}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      testID={testID}
      style={[
        animatedStyle,
        {
          backgroundColor: variantStyle.bg,
          borderColor: variantStyle.border,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderRadius: s.r,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          minHeight: 44,
          justifyContent: "center",
        },
      ]}
      {...rest}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: s.iconGap,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={variantStyle.fg} />
        ) : (
          <>
            {leftIcon}
            <Text variant="button" style={{ color: variantStyle.fg }}>
              {label}
            </Text>
            {rightIcon}
          </>
        )}
      </View>
    </AnimatedPressable>
  );
});

Button.displayName = "Button";
