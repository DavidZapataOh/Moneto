import { Ionicons } from "@expo/vector-icons";
import { Text, useTheme } from "@moneto/ui";
import { memo, useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

/**
 * Iconito de tab con animación de spring scale al recibir focus + opcional
 * badge de notificaciones overlap top-right.
 *
 * Spec animación:
 * - inactive scale = 0.85, active = 1.0.
 * - spring damping 14 / stiffness 220 → arrival ~180ms, sin overshoot
 *   visible. Match con el feel de Phantom/Revolut.
 *
 * Badge:
 * - sólo se renderiza cuando `badge !== undefined && badge > 0` (evita
 *   "0" rendereado).
 * - >99 → "99+".
 * - color = `colors.danger`, foreground = `colors.text.inverse` (contraste
 *   AA garantizado por el theme).
 *
 * Memoizado: renderea solo si cambian props. El parent (tabs layout)
 * pasa props estables vía función inline pero React.memo hace shallow
 * compare igual — `color` es string, `icon` es string, `focused` es bool.
 */
interface AnimatedTabIconProps {
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  /** Color que `expo-router` ya resuelve según `tabBarActiveTintColor`. */
  color: string;
  /** Si presente y >0, muestra badge top-right. >99 colapsa a "99+". */
  badge?: number;
  /** Opcional — para accesibilidad / e2e. Se concatena en `accessibilityLabel`. */
  label?: string;
}

const ICON_SIZE = 24;
const BADGE_HEIGHT = 18;

function AnimatedTabIconImpl({ focused, icon, color, badge, label }: AnimatedTabIconProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(focused ? 1 : 0.85);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.85, {
      damping: 14,
      stiffness: 220,
    });
  }, [focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const showBadge = badge !== undefined && badge > 0;
  const badgeText = showBadge ? (badge > 99 ? "99+" : String(badge)) : null;

  return (
    <Animated.View
      style={animatedStyle}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={
        label ? (showBadge ? `${label}, ${badge} notificaciones sin leer` : label) : undefined
      }
    >
      <Ionicons name={icon} size={ICON_SIZE} color={color} />
      {showBadge ? (
        <View
          // No-op para hit testing — el badge nunca debe interceptar taps.
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -4,
            right: -8,
            minWidth: BADGE_HEIGHT,
            height: BADGE_HEIGHT,
            borderRadius: BADGE_HEIGHT / 2,
            backgroundColor: colors.danger,
            paddingHorizontal: 4,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: colors.text.inverse,
              fontSize: 10,
              fontFamily: "Inter_600SemiBold",
              lineHeight: 14,
            }}
          >
            {badgeText}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

export const AnimatedTabIcon = memo(AnimatedTabIconImpl);
