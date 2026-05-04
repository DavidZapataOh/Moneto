import { forwardRef, useCallback } from "react";
import { Pressable, type PressableProps, View, ActivityIndicator } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { Text } from "./Text";
import { useTheme } from "../hooks/useTheme";
import { haptics } from "../hooks/useHaptics";
import { radius } from "@moneto/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  variant?: Variant;
  size?: Size;
  label: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
    onPress,
    ...rest
  },
  ref
) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 18, stiffness: 300 });
    opacity.value = withTiming(0.85, { duration: 80 });
  }, [scale, opacity]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 18, stiffness: 300 });
    opacity.value = withTiming(1, { duration: 120 });
  }, [scale, opacity]);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    haptics.tap();
    onPress?.();
  }, [disabled, loading, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const sizeMap = {
    sm: { py: 10, px: 14, r: radius.md, iconGap: 6 },
    md: { py: 14, px: 18, r: radius.md, iconGap: 8 },
    lg: { py: 18, px: 22, r: radius.lg, iconGap: 10 },
  } as const;

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

  const s = sizeMap[size];

  return (
    <AnimatedPressable
      ref={ref as any}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
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
