import { useEffect } from "react";
import { View, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { Screen } from "@components/ui/Screen";
import { Text } from "@components/ui/Text";
import { Button } from "@components/ui/Button";
import { Logo } from "@components/ui/Logo";
import { useTheme } from "@hooks/useTheme";

const { height } = Dimensions.get("window");

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.92);
  const titleOpacity = useSharedValue(0);
  const subOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
    logoScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    titleOpacity.value = withDelay(280, withTiming(1, { duration: 500 }));
    subOpacity.value = withDelay(520, withTiming(1, { duration: 500 }));
    ctaOpacity.value = withDelay(760, withTiming(1, { duration: 400 }));

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.3, { duration: 2200, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [logoOpacity, logoScale, titleOpacity, subOpacity, ctaOpacity, glowOpacity]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const subStyle = useAnimatedStyle(() => ({ opacity: subOpacity.value }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  return (
    <Screen padded>
      {/* Ambient glow */}
      <Animated.View
        pointerEvents="none"
        style={[
          glowStyle,
          {
            position: "absolute",
            top: height * 0.15,
            left: -60,
            right: -60,
            height: 340,
            backgroundColor: colors.brand.primary,
            opacity: 0.15,
            borderRadius: 300,
            transform: [{ scaleX: 1.4 }],
          },
        ]}
      />

      <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 40 }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 32 }}>
          <Animated.View style={logoStyle}>
            <Logo size={72} variant="mark" tone="brand" />
          </Animated.View>

          <View style={{ alignItems: "center", gap: 12 }}>
            <Animated.View style={titleStyle}>
              <Text variant="heroDisplayLarge" tone="primary" style={{ textAlign: "center" }}>
                Money,{"\n"}privately.
              </Text>
            </Animated.View>
            <Animated.View style={[subStyle, { paddingHorizontal: 24, marginTop: 8 }]}>
              <Text variant="body" tone="secondary" style={{ textAlign: "center", lineHeight: 24 }}>
                El neobanco para quienes prefieren{"\n"}no ser vistos.
              </Text>
            </Animated.View>
          </View>
        </View>

        <Animated.View style={[ctaStyle, { gap: 12 }]}>
          <Button
            label="Empezar"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.push("/(onboarding)/intro")}
          />
          <Button
            label="Ya tengo cuenta"
            variant="ghost"
            size="md"
            fullWidth
            onPress={() => router.push("/(onboarding)/auth")}
          />
        </Animated.View>
      </View>
    </Screen>
  );
}
