import { useCallback } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Text } from "./Text";
import { useTheme } from "../hooks/useTheme";
import { haptics } from "../hooks/useHaptics";

interface ListItemProps {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  compact?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ListItem({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  compact = false,
}: ListItemProps) {
  const { colors } = useTheme();
  const bgColor = useSharedValue(0);

  const handlePress = useCallback(() => {
    if (!onPress) return;
    haptics.tap();
    onPress();
  }, [onPress]);

  const onPressIn = useCallback(() => {
    bgColor.value = withTiming(1, { duration: 80 });
  }, [bgColor]);

  const onPressOut = useCallback(() => {
    bgColor.value = withTiming(0, { duration: 160 });
  }, [bgColor]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: bgColor.value > 0.5 ? colors.bg.overlay : "transparent",
  }));

  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: compact ? 10 : 14,
      }}
    >
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) {
    return <View style={{ paddingHorizontal: 4 }}>{content}</View>;
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        animatedStyle,
        {
          borderRadius: 12,
          paddingHorizontal: 4,
        },
      ]}
    >
      {content}
    </AnimatedPressable>
  );
}
