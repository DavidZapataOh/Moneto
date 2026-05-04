import { useEffect } from "react";
import { View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, Button, useTheme, haptics } from "@moneto/ui";
import { fonts } from "@moneto/theme";

export default function SendSuccessScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ amount: string; to: string; mode: string }>();

  const amount = Number(params.amount) || 0;
  const isCashout = params.mode === "cashout";

  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.6);
  const ringOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const bodyOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);

  useEffect(() => {
    // Three-stage reveal: anticipation → reveal → afterglow
    // Anticipation (ring pulses)
    ringOpacity.value = withTiming(1, { duration: 200 });
    ringScale.value = withSpring(1, { damping: 12, stiffness: 140 });

    // Reveal
    checkOpacity.value = withDelay(180, withTiming(1, { duration: 200 }));
    checkScale.value = withDelay(
      180,
      withSequence(
        withSpring(1.2, { damping: 10, stiffness: 240 }),
        withSpring(1, { damping: 14, stiffness: 200 })
      )
    );

    // Afterglow
    titleOpacity.value = withDelay(480, withTiming(1, { duration: 400 }));
    bodyOpacity.value = withDelay(680, withTiming(1, { duration: 400 }));
    ctaOpacity.value = withDelay(960, withTiming(1, { duration: 400 }));

    // Haptic sequence
    const t1 = setTimeout(() => haptics.medium(), 180);
    const t2 = setTimeout(() => haptics.success(), 460);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [
    ringOpacity,
    ringScale,
    checkOpacity,
    checkScale,
    titleOpacity,
    bodyOpacity,
    ctaOpacity,
  ]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const bodyStyle = useAnimatedStyle(() => ({ opacity: bodyOpacity.value }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 40 }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 32 }}>
          {/* Check animation */}
          <View
            style={{
              width: 140,
              height: 140,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animated.View
              style={[
                ringStyle,
                {
                  position: "absolute",
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  borderWidth: 1.5,
                  borderColor: colors.brand.primary,
                  opacity: 0.2,
                },
              ]}
            />
            <Animated.View
              style={[
                ringStyle,
                {
                  position: "absolute",
                  width: 110,
                  height: 110,
                  borderRadius: 55,
                  borderWidth: 1.5,
                  borderColor: colors.brand.primary,
                  opacity: 0.35,
                },
              ]}
            />
            <Animated.View
              style={[
                checkStyle,
                {
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: colors.brand.primary,
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <Ionicons name="checkmark" size={40} color={colors.text.inverse} />
            </Animated.View>
          </View>

          {/* Amount + recipient */}
          <Animated.View style={[titleStyle, { alignItems: "center", gap: 12 }]}>
            <Text variant="label" tone="secondary">
              {isCashout ? "Retiro en proceso" : "Enviado con éxito"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: 56,
                  lineHeight: 68,
                  color: colors.text.primary,
                  letterSpacing: -1.4,
                  includeFontPadding: false,
                }}
              >
                ${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.sansMedium,
                  fontSize: 14,
                  color: colors.text.tertiary,
                  marginLeft: 6,
                }}
              >
                USD
              </Text>
            </View>
            <Text variant="body" tone="secondary" style={{ textAlign: "center" }}>
              {isCashout ? "hacia" : "a"}{" "}
              <Text variant="body" tone="primary">
                {params.to}
              </Text>
            </Text>
          </Animated.View>

          {isCashout && (
            <Animated.View style={[bodyStyle]}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: "rgba(200, 148, 80, 0.12)",
                }}
              >
                <Ionicons name="time-outline" size={12} color={colors.value} />
                <Text variant="bodySmall" tone="value">
                  COP llegará a tu banco en ~10 min
                </Text>
              </View>
            </Animated.View>
          )}
        </View>

        <Animated.View style={[ctaStyle, { gap: 12 }]}>
          <Button
            label="Listo"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => {
              haptics.tap();
              router.replace("/(tabs)");
            }}
          />
          <Button
            label="Enviar otro pago"
            variant="ghost"
            size="md"
            fullWidth
            onPress={() => {
              haptics.tap();
              router.replace("/send");
            }}
          />
        </Animated.View>
      </View>
    </Screen>
  );
}
