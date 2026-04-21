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
 * Balance hero — única emphasis de la Home screen.
 * Sigue reglas mobile-design:
 * - 4 tamaños en el screen (48 hero, 24 para amount secundaria, 16 body, 12 label)
 * - Solo 2 weights (500 medium y 400 regular)
 * - Una emphasis: el número del saldo
 */
export function BalanceHero({
  balance,
  yieldApy,
  hidden,
  onToggleVisibility,
  isPrivate = true,
}: BalanceHeroProps) {
  const { colors } = useTheme();

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
    balanceOpacity.value = withTiming(hidden ? 0.25 : 1, { duration: 200 });
  }, [hidden, balanceOpacity]);

  const balanceStyle = useAnimatedStyle(() => ({
    opacity: balanceOpacity.value,
  }));

  const [intPart, decPart] = Math.abs(balance).toFixed(2).split(".");
  const formattedInt = parseInt(intPart, 10).toLocaleString("en-US");

  return (
    <View style={{ gap: 12 }}>
      {/* Eyebrow */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="label" tone="tertiary">
            Saldo total
          </Text>
          <Pressable
            onPress={() => {
              haptics.tap();
              onToggleVisibility();
            }}
            hitSlop={12}
          >
            <Ionicons
              name={hidden ? "eye-off-outline" : "eye-outline"}
              size={16}
              color={colors.text.tertiary}
            />
          </Pressable>
        </View>
        {isPrivate && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Ionicons name="lock-closed" size={12} color={colors.value} />
            <Text variant="label" tone="value">
              Privado
            </Text>
          </View>
        )}
      </View>

      {/* Hero number — 48pt fits 8-pt grid */}
      <Animated.View style={balanceStyle}>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 48,
              lineHeight: 52,
              letterSpacing: -1.4,
              color: colors.text.primary,
            }}
            allowFontScaling={false}
            numberOfLines={1}
          >
            {hidden ? "••••••" : `$${formattedInt}`}
          </Text>
          {!hidden && (
            <>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: 24,
                  lineHeight: 28,
                  letterSpacing: -0.4,
                  color: colors.text.tertiary,
                }}
                allowFontScaling={false}
              >
                .{decPart}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.sansMedium,
                  fontSize: 12,
                  lineHeight: 16,
                  color: colors.text.tertiary,
                  marginLeft: 8,
                  letterSpacing: 0.4,
                }}
              >
                USD
              </Text>
            </>
          )}
        </View>
      </Animated.View>

      {/* Yield line */}
      {!hidden && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.value,
            }}
          />
          <Text variant="bodySmall" tone="secondary">
            <Text variant="bodySmall" tone="value">
              {(yieldApy * 100).toFixed(2)}% APY
            </Text>
            {"  ·  +$"}
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 12,
                color: colors.value,
              }}
            >
              {(perSecond * 86400).toFixed(2)}
            </Text>
            {" hoy"}
          </Text>
        </View>
      )}
    </View>
  );
}
