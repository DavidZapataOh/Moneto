import { hitSlop, springs } from "@moneto/theme";
import { forwardRef, useCallback } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { haptics, type HapticPattern } from "../hooks/useHaptics";
import { useTheme } from "../hooks/useTheme";

export type IconButtonVariant = "ghost" | "filled" | "outlined";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps {
  /** Icono (ej: `<Ionicons name="..." />`). */
  icon: React.ReactNode;
  /** Handler. */
  onPress?: () => void;
  /** Visual variant. Default `ghost`. */
  variant?: IconButtonVariant;
  /** Tamaño cuadrado. Default `md` (44pt — cumple a11y mínimo). */
  size?: IconButtonSize;
  /**
   * Label para a11y. Obligatorio cuando el icono es la única señal del
   * propósito del botón (sin texto).
   */
  accessibilityLabel: string;
  /** Hint extra para a11y (acción que se ejecutará). */
  accessibilityHint?: string;
  /** Bloquea + atenúa. */
  disabled?: boolean;
  /** Haptic en press. Default `tap`. `null` para desactivar. */
  haptic?: HapticPattern | null;
  /** testID para E2E. */
  testID?: string;
}

const SIZE_MAP: Record<IconButtonSize, number> = { sm: 36, md: 44, lg: 52 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Round icon-only button. `accessibilityLabel` es REQUERIDO porque el icono
 * solo no es accesible. Touch target real ≥44pt vía hitSlop incluso para `sm`.
 *
 * @example
 *   <IconButton
 *     icon={<Ionicons name="close" size={20} />}
 *     accessibilityLabel="Cerrar"
 *     onPress={onClose}
 *   />
 */
export const IconButton = forwardRef<View, IconButtonProps>(function IconButton(
  {
    icon,
    onPress,
    variant = "ghost",
    size = "md",
    accessibilityLabel,
    accessibilityHint,
    disabled = false,
    haptic = "tap",
    testID,
  },
  ref,
) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (haptic) haptics[haptic]();
    onPress?.();
  }, [disabled, haptic, onPress]);

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.9, springs.tap);
  }, [scale]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, springs.tap);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const s = SIZE_MAP[size];

  const variantStyle = (() => {
    switch (variant) {
      case "filled":
        return { bg: colors.bg.elevated, border: "transparent" };
      case "outlined":
        return { bg: "transparent", border: colors.border.subtle };
      case "ghost":
        return { bg: "transparent", border: "transparent" };
    }
  })();

  return (
    <AnimatedPressable
      ref={ref as never}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={size === "sm" ? hitSlop.medium : hitSlop.small}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      testID={testID}
      style={[
        animatedStyle,
        {
          width: s,
          height: s,
          borderRadius: s / 2,
          backgroundColor: variantStyle.bg,
          borderColor: variantStyle.border,
          borderWidth: variant === "outlined" ? 1 : 0,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <View>{icon}</View>
    </AnimatedPressable>
  );
});

IconButton.displayName = "IconButton";
