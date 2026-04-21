import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
  tone?: "default" | "primary";
}

const actions: QuickAction[] = [
  { id: "receive", label: "Recibir", icon: "arrow-down", route: "/receive", tone: "primary" },
  { id: "send", label: "Enviar", icon: "arrow-up", route: "/send" },
  { id: "card", label: "Tarjeta", icon: "card-outline", route: "/card" },
  { id: "cashout", label: "Retirar", icon: "cash-outline", route: "/send?mode=cashout" },
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const onPress = () => {
    haptics.tap();
    router.push(action.route as any);
  };

  const iconColor =
    action.tone === "primary" ? colors.text.inverse : colors.text.primary;
  const bgColor =
    action.tone === "primary" ? colors.brand.primary : colors.bg.elevated;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        animatedStyle,
        {
          flex: 1,
          paddingVertical: 16,
          paddingHorizontal: 8,
          borderRadius: 16,
          backgroundColor: bgColor,
          alignItems: "center",
          gap: 8,
        },
      ]}
    >
      <Ionicons name={action.icon} size={22} color={iconColor} />
      <Text
        variant="label"
        style={{
          color: iconColor,
          letterSpacing: 0.5,
          fontSize: 11,
        }}
      >
        {action.label}
      </Text>
    </AnimatedPressable>
  );
}
