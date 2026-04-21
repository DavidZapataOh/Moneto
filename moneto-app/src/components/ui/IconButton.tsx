import { useCallback } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "@hooks/useTheme";
import { haptics } from "@hooks/useHaptics";
import { hitSlop } from "@theme/spacing";

interface IconButtonProps {
  icon: React.ReactNode;
  onPress?: () => void;
  variant?: "ghost" | "filled" | "outlined";
  size?: "sm" | "md" | "lg";
  label?: string;
  disabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function IconButton({
  icon,
  onPress,
  variant = "ghost",
  size = "md",
  label,
  disabled = false,
}: IconButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    if (disabled) return;
    haptics.tap();
    onPress?.();
  }, [disabled, onPress]);

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 14, stiffness: 300 });
  }, [scale]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 300 });
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizeMap = { sm: 36, md: 44, lg: 52 };
  const s = sizeMap[size];

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
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={hitSlop.small}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
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
}
