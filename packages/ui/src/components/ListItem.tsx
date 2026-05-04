import { durations, radius } from "@moneto/theme";
import { forwardRef, useCallback } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { haptics, type HapticPattern } from "../hooks/useHaptics";
import { useTheme } from "../hooks/useTheme";

import { Text } from "./Text";

export interface ListItemProps {
  /** Slot izquierdo (icono, avatar, etc.). */
  leading?: React.ReactNode;
  /** Texto principal (1 línea, truncated). */
  title: string;
  /** Texto secundario (1 línea, truncated). */
  subtitle?: string;
  /** Slot derecho (chevron, monto, badge). */
  trailing?: React.ReactNode;
  /** Si se provee, el row es Pressable con highlight. */
  onPress?: () => void;
  /** Reduce el padding vertical (10 vs 14). */
  compact?: boolean;
  /** Haptic en press (cuando hay `onPress`). Default `tap`. */
  haptic?: HapticPattern | null;
  /** Override label para a11y (default: `title`). */
  accessibilityLabel?: string;
  /** Hint para a11y. */
  accessibilityHint?: string;
  /** testID para E2E. */
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Row con leading slot + title/subtitle + trailing slot. Se vuelve
 * Pressable solo si recibes `onPress`.
 *
 * Highlight via background animado (no scale) — más apropiado para listas
 * densas que un scale per-row.
 *
 * @example
 *   <ListItem
 *     leading={<Avatar name={tx.counterpartyName} />}
 *     title={tx.counterpartyName}
 *     subtitle={formatRelative(tx.timestamp)}
 *     trailing={<AmountDisplay amount={tx.amount} />}
 *     onPress={() => router.push(`/tx/${tx.id}`)}
 *   />
 */
export const ListItem = forwardRef<View, ListItemProps>(function ListItem(
  {
    leading,
    title,
    subtitle,
    trailing,
    onPress,
    compact = false,
    haptic = "tap",
    accessibilityLabel,
    accessibilityHint,
    testID,
  },
  ref,
) {
  const { colors } = useTheme();
  const bgProgress = useSharedValue(0);

  const handlePress = useCallback(() => {
    if (!onPress) return;
    if (haptic) haptics[haptic]();
    onPress();
  }, [onPress, haptic]);

  const onPressIn = useCallback(() => {
    bgProgress.value = withTiming(1, { duration: durations.instant });
  }, [bgProgress]);

  const onPressOut = useCallback(() => {
    bgProgress.value = withTiming(0, { duration: durations.fast });
  }, [bgProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: bgProgress.value > 0.5 ? colors.bg.overlay : "transparent",
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
        {subtitle ? (
          <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) {
    return (
      <View ref={ref} testID={testID} style={{ paddingHorizontal: 4 }}>
        {content}
      </View>
    );
  }

  return (
    <AnimatedPressable
      ref={ref as never}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={[animatedStyle, { borderRadius: radius.sm, paddingHorizontal: 4, minHeight: 44 }]}
    >
      {content}
    </AnimatedPressable>
  );
});

ListItem.displayName = "ListItem";
