import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import { Text, useTheme, haptics } from "@moneto/ui";
import { formatAmountForA11y } from "@moneto/utils";
import { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
} from "react-native-reanimated";

interface BalanceHeroProps {
  balance: number;
  yieldApy: number;
  hidden: boolean;
  onToggleVisibility: () => void;
}

/**
 * Balance hero — única emphasis de la Home screen.
 * Sigue reglas mobile-design:
 * - 4 tamaños en el screen (48 hero, 24 para amount secundaria, 16 body, 12 label)
 * - Solo 2 weights (500 medium y 400 regular)
 * - Una emphasis: el número del saldo
 */
export function BalanceHero({ balance, yieldApy, hidden, onToggleVisibility }: BalanceHeroProps) {
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

  // Counter animation: cuando `balance` cambia (post-refresh, tx settled),
  // interpolamos el valor mostrado para crear el "reveal moment" — el user
  // siente el cambio en lugar de que el número salte. 700ms es la sweet
  // spot: suficientemente lento para registrarse, no tanto como para
  // sentirse lento. Easing `out(cubic)` para arrival agradable.
  const animatedBalance = useSharedValue(balance);
  const [displayBalance, setDisplayBalance] = useState(balance);

  useEffect(() => {
    animatedBalance.value = withTiming(balance, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [balance, animatedBalance]);

  useAnimatedReaction(
    () => animatedBalance.value,
    (current, prev) => {
      // Threshold de 0.005 evita re-render JS innecesario en cada frame
      // cuando el delta es sub-cent. ~60fps update si el delta es grande.
      if (prev === null || Math.abs(current - (prev ?? 0)) > 0.005) {
        runOnJS(setDisplayBalance)(current);
      }
    },
    [],
  );

  const parts = Math.abs(displayBalance).toFixed(2).split(".");
  const intPart = parts[0] ?? "0";
  const decPart = parts[1] ?? "00";
  const formattedInt = parseInt(intPart, 10).toLocaleString("en-US");

  // Accessibility label — humanizado para VoiceOver/TalkBack. Si está
  // hidden, anunciamos eso (no leemos los •••••). Si visible, usamos
  // `formatAmountForA11y` que lee el monto en español natural.
  const a11yLabel = hidden
    ? "Saldo total oculto"
    : `Saldo total, ${formatAmountForA11y(balance, "USD")}`;

  return (
    <View style={{ gap: 12 }}>
      {/* Eyebrow — sin "PRIVADO" (privacidad es promesa invisible, no feature visible) */}
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
          accessibilityRole="button"
          accessibilityLabel={hidden ? "Mostrar saldo" : "Ocultar saldo"}
        >
          <Ionicons
            name={hidden ? "eye-off-outline" : "eye-outline"}
            size={16}
            color={colors.text.tertiary}
          />
        </Pressable>
      </View>

      {/* Hero number — 48pt fits 8-pt grid. Wrapped en un View con
          `accessibilityRole="header"` para que VoiceOver/TalkBack lo
          anuncien como heading + leen el monto humanizado en lugar de
          "uno coma dos tres cuatro punto cinco seis". */}
      <Animated.View
        style={balanceStyle}
        accessible
        accessibilityRole="header"
        accessibilityLabel={a11yLabel}
      >
        <View
          style={{ flexDirection: "row", alignItems: "baseline" }}
          // El wrapper externo ya provee la a11y label completa
          // humanizada — los Text internos quedan invisibles al SR.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
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
                  fontSize: 18,
                  lineHeight: 24,
                  color: colors.text.tertiary,
                  marginLeft: 10,
                  letterSpacing: 0.2,
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
