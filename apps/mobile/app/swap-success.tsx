import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import { Button, Screen, Text, haptics, useTheme } from "@moneto/ui";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

/**
 * Pantalla de éxito post-swap. Three-stage reveal coherente con send-success
 * (anticipation → reveal → afterglow) — gift framework.
 *
 * Params:
 * - `signature` — tx hash; permite "Ver en explorer" (Solana).
 * - `fromAsset`, `toAsset` — symbols UPPERCASE para display.
 * - `fromAmount`, `toAmount` — display strings ya formateados.
 */
export default function SwapSuccessScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    signature?: string;
    fromAsset?: string;
    toAsset?: string;
    fromAmount?: string;
    toAmount?: string;
  }>();

  const fromAsset = (params.fromAsset ?? "").toUpperCase();
  const toAsset = (params.toAsset ?? "").toUpperCase();
  const fromAmount = params.fromAmount ?? "";
  const toAmount = params.toAmount ?? "";
  const signature = params.signature ?? "";

  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.6);
  const ringOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const bodyOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);

  useEffect(() => {
    ringOpacity.value = withTiming(1, { duration: 200 });
    ringScale.value = withSpring(1, { damping: 12, stiffness: 140 });

    checkOpacity.value = withDelay(180, withTiming(1, { duration: 200 }));
    checkScale.value = withDelay(
      180,
      withSequence(
        withSpring(1.2, { damping: 10, stiffness: 240 }),
        withSpring(1, { damping: 14, stiffness: 200 }),
      ),
    );

    titleOpacity.value = withDelay(480, withTiming(1, { duration: 400 }));
    bodyOpacity.value = withDelay(680, withTiming(1, { duration: 400 }));
    ctaOpacity.value = withDelay(960, withTiming(1, { duration: 400 }));

    const t1 = setTimeout(() => haptics.medium(), 180);
    const t2 = setTimeout(() => haptics.success(), 460);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ringOpacity, ringScale, checkOpacity, checkScale, titleOpacity, bodyOpacity, ctaOpacity]);

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

  const handleCopySignature = async () => {
    if (!signature) return;
    haptics.tap();
    await Clipboard.setStringAsync(signature);
  };

  return (
    <Screen padded isModal>
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

          {/* Conversion summary */}
          <Animated.View style={[titleStyle, { alignItems: "center", gap: 12 }]}>
            <Text variant="label" tone="secondary">
              Conversión completada
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginTop: 4,
              }}
            >
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontFamily: fonts.monoMedium,
                    fontSize: 22,
                    color: colors.text.primary,
                    lineHeight: 28,
                  }}
                >
                  {fromAmount}
                </Text>
                <Text variant="bodySmall" tone="tertiary">
                  {fromAsset}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.text.tertiary} />
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontFamily: fonts.monoMedium,
                    fontSize: 22,
                    color: colors.text.primary,
                    lineHeight: 28,
                  }}
                >
                  {toAmount}
                </Text>
                <Text variant="bodySmall" tone="tertiary">
                  {toAsset}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Tx signature pill */}
          {signature ? (
            <Animated.View style={bodyStyle}>
              <Pressable
                onPress={handleCopySignature}
                accessibilityRole="button"
                accessibilityLabel="Copiar hash de la transacción"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: colors.bg.overlay,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Ionicons name="copy-outline" size={12} color={colors.text.tertiary} />
                <Text variant="bodySmall" tone="tertiary" style={{ fontFamily: fonts.monoMedium }}>
                  {signature.slice(0, 6)}…{signature.slice(-6)}
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}
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
            label="Convertir otra vez"
            variant="ghost"
            size="md"
            fullWidth
            onPress={() => {
              haptics.tap();
              router.replace("/swap");
            }}
          />
        </Animated.View>
      </View>
    </Screen>
  );
}
