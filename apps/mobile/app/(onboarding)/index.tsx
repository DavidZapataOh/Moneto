import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, Button, useTheme } from "@moneto/ui";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View, Image, Dimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// La imagen ocupa todo el ancho del device
// Altura proporcional al aspect ratio de la imagen source (asumimos ~1:1.2)
const HERO_HEIGHT = SCREEN_H * 0.58;

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const heroOpacity = useSharedValue(0);
  const heroTranslate = useSharedValue(20);
  const titleOpacity = useSharedValue(0);
  const subOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);

  useEffect(() => {
    heroOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    heroTranslate.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) });
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
    subOpacity.value = withDelay(480, withTiming(1, { duration: 500 }));
    ctaOpacity.value = withDelay(660, withTiming(1, { duration: 400 }));
  }, [heroOpacity, heroTranslate, titleOpacity, subOpacity, ctaOpacity]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ translateY: heroTranslate.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const subStyle = useAnimatedStyle(() => ({ opacity: subOpacity.value }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

  const bgRgbaStart = isDark ? "rgba(20, 16, 11, 0)" : "rgba(251, 247, 239, 0)";
  const bgRgbaMid = isDark ? "rgba(20, 16, 11, 0.55)" : "rgba(251, 247, 239, 0.55)";
  const bgRgbaEnd = isDark ? "rgba(20, 16, 11, 1)" : "rgba(251, 247, 239, 1)";

  return (
    <Screen padded={false} edges={["top", "bottom"]} bg="primary">
      {/* Top wordmark */}
      <View
        style={{
          paddingTop: 12,
          paddingHorizontal: 20,
          zIndex: 2,
        }}
      >
        <Text variant="wordmark" style={{ fontSize: 18, letterSpacing: -0.4 }}>
          Moneto
        </Text>
      </View>

      {/* Hero image — full width, gradient disolviéndose al bg en la parte inferior */}
      <Animated.View
        style={[
          heroStyle,
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            width: SCREEN_W,
            height: HERO_HEIGHT,
            zIndex: 1,
          },
        ]}
      >
        <Image
          source={require("../../assets/images/onboarding.png")}
          style={{ width: SCREEN_W, height: HERO_HEIGHT }}
          resizeMode="cover"
        />

        {/* Gradient de disolución: arranca transparente arriba, se vuelve bg opaco abajo.
            Efecto "agua": 3 stops para que no sea un corte duro. */}
        <LinearGradient
          colors={[bgRgbaStart, bgRgbaMid, bgRgbaEnd]}
          locations={[0, 0.55, 1]}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: HERO_HEIGHT * 0.55, // la disolución ocupa el 55% inferior de la imagen
          }}
        />
      </Animated.View>

      {/* Contenido inferior — se solapa con la parte disuelta del hero */}
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          paddingHorizontal: 24,
          paddingBottom: 16,
          gap: 28,
          zIndex: 2,
        }}
      >
        <View style={{ gap: 10 }}>
          <Animated.View style={titleStyle}>
            <Text variant="heroDisplayLarge" tone="primary" style={{ letterSpacing: -1.5 }}>
              Tu dinero,{"\n"}a tu manera.
            </Text>
          </Animated.View>
          <Animated.View style={subStyle}>
            <Text variant="body" tone="secondary" style={{ lineHeight: 24, maxWidth: 320 }}>
              Un banco que trabaja para vos, no al revés.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[ctaStyle, { gap: 10 }]}>
          <Button
            label="Empezar"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.push("/(onboarding)/intro")}
            rightIcon={<Ionicons name="arrow-forward" size={18} color={colors.text.inverse} />}
          />
          <Button
            label="Ya tengo cuenta"
            variant="ghost"
            size="md"
            fullWidth
            onPress={() => router.push("/(onboarding)/auth?mode=login")}
          />
        </Animated.View>
      </View>
    </Screen>
  );
}
