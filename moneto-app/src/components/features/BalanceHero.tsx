import { useEffect } from "react";
import { View, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { useTheme } from "@hooks/useTheme";
import { haptics } from "@hooks/useHaptics";
import { fonts } from "@theme/typography";

interface BalanceHeroProps {
  balance: number;
  yieldApy: number;
  hidden: boolean;
  onToggleVisibility: () => void;
  isPrivate?: boolean;
}

/**
 * Balance hero con ticker animado de yield.
 * Cumple principio "ceremony for money-in moments" — el saldo respira.
 */
export function BalanceHero({
  balance,
  yieldApy,
  hidden,
  onToggleVisibility,
  isPrivate = true,
}: BalanceHeroProps) {
  const { colors } = useTheme();

  // Yield ticker — acumula en tiempo real para dar sensación de movimiento
  const yieldAccrued = useSharedValue(0);
  const perSecond = (balance * yieldApy) / (365 * 24 * 60 * 60);

  useEffect(() => {
    yieldAccrued.value = 0;
    const interval = setInterval(() => {
      yieldAccrued.value = withTiming(yieldAccrued.value + perSecond, {
        duration: 1000,
        easing: Easing.linear,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [balance, perSecond, yieldAccrued]);

  const balanceOpacity = useSharedValue(1);
  useEffect(() => {
    balanceOpacity.value = withTiming(hidden ? 0.2 : 1, { duration: 220 });
  }, [hidden, balanceOpacity]);

  const balanceStyle = useAnimatedStyle(() => ({
    opacity: balanceOpacity.value,
  }));

  const [intPart, decPart] = Math.abs(balance).toFixed(2).split(".");
  const formattedInt = parseInt(intPart, 10).toLocaleString("en-US");

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text variant="label" tone="secondary">
          Saldo total
        </Text>
        <Pressable
          onPress={() => {
            haptics.tap();
            onToggleVisibility();
          }}
          hitSlop={8}
        >
          <Ionicons
            name={hidden ? "eye-off-outline" : "eye-outline"}
            size={16}
            color={colors.text.tertiary}
          />
        </Pressable>
        {isPrivate && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginLeft: "auto",
            }}
          >
            <Ionicons name="lock-closed" size={12} color={colors.value} />
            <Text variant="label" tone="value" style={{ letterSpacing: 0.8 }}>
              Privado
            </Text>
          </View>
        )}
      </View>

      <Animated.View style={balanceStyle}>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 56,
              lineHeight: 58,
              letterSpacing: -1.6,
              color: colors.text.primary,
            }}
          >
            {hidden ? "••••" : `$${formattedInt}`}
          </Text>
          {!hidden && (
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 28,
                lineHeight: 32,
                letterSpacing: -0.6,
                color: colors.text.secondary,
                marginLeft: 2,
              }}
            >
              .{decPart}
            </Text>
          )}
          {!hidden && (
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 14,
                color: colors.text.tertiary,
                marginLeft: 8,
                letterSpacing: 0.2,
              }}
            >
              USD
            </Text>
          )}
        </View>
      </Animated.View>

      {!hidden && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.value,
            }}
          />
          <Text variant="bodySmall" tone="secondary">
            Rindiendo{" "}
            <Text variant="bodySmall" tone="value">
              {(yieldApy * 100).toFixed(2)}% APY
            </Text>
            {" · +$"}
            <Text variant="amountSecondary" tone="value">
              {(perSecond * 86400).toFixed(2)}
            </Text>
            {" hoy"}
          </Text>
        </View>
      )}
    </View>
  );
}
