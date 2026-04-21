import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Text } from "../ui/Text";
import { useTheme } from "@hooks/useTheme";
import { haptics } from "@hooks/useHaptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface QuickAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

/**
 * Quick actions — todas neutrales por default (60/30/10: estos son el 30%, no el 10%).
 * Color accent se reserva para el balance hero y el primary CTA contextual.
 * Icons sin color (design.txt): solo forma, color lo da el texto por hierarchy.
 */
const actions: QuickAction[] = [
  { id: "receive", label: "Recibir", icon: "arrow-down", route: "/receive" },
  { id: "send", label: "Enviar", icon: "arrow-up", route: "/send" },
  { id: "cashout", label: "Retirar", icon: "cash-outline", route: "/send?mode=cashout" },
  { id: "card", label: "Tarjeta", icon: "card-outline", route: "/(tabs)/card" },
];

export function QuickActions() {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {actions.map((a) => (
        <ActionButton key={a.id} action={a} />
      ))}
    </View>
  );
}

function ActionButton({ action }: { action: QuickAction }) {
  const router = useRouter();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const bgOverlay = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: bgOverlay.value,
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 280 });
    bgOverlay.value = withTiming(1, { duration: 80 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 280 });
    bgOverlay.value = withTiming(0, { duration: 180 });
  };

  const onPress = () => {
    haptics.tap();
    router.push(action.route as any);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        animatedStyle,
        {
          flex: 1,
          paddingVertical: 14,
          paddingHorizontal: 6,
          borderRadius: 16,
          backgroundColor: colors.bg.elevated,
          alignItems: "center",
          gap: 8,
          overflow: "hidden",
        },
      ]}
    >
      {/* Press overlay — press state slightly darker (design.txt principle) */}
      <Animated.View
        pointerEvents="none"
        style={[
          overlayStyle,
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.bg.overlay,
          },
        ]}
      />
      <Ionicons name={action.icon} size={20} color={colors.text.primary} />
      <Text
        variant="label"
        tone="secondary"
        style={{ fontSize: 11, letterSpacing: 0.4 }}
      >
        {action.label}
      </Text>
    </AnimatedPressable>
  );
}
