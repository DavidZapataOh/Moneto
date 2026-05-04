import { Ionicons } from "@expo/vector-icons";
import { fonts, palette } from "@moneto/theme";
import { Text, Logo, haptics } from "@moneto/ui";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect } from "react";
import { View, Pressable, Dimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_WIDTH = Math.min(SCREEN_W - 40, 360);
const CARD_HEIGHT = CARD_WIDTH * 0.63; // ratio Visa standard

interface VirtualCardProps {
  last4: string;
  cardholderName: string;
  showDetails?: boolean;
  onTap?: () => void;
}

/**
 * Tarjeta virtual Visa con tilt 3D sutil.
 * Reference: Revolut Premium card moment — card feels tactile, not static.
 */
export function VirtualCard({
  last4,
  cardholderName,
  showDetails = false,
  onTap,
}: VirtualCardProps) {
  const rotateY = useSharedValue(0);
  const rotateX = useSharedValue(0);
  const pressScale = useSharedValue(1);

  const flip = useSharedValue(0);

  useEffect(() => {
    flip.value = withTiming(showDetails ? 1 : 0, {
      duration: 500,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [showDetails, flip]);

  // Subtle idle breathe — Revolut-esque
  useEffect(() => {
    const loop = () => {
      rotateY.value = withTiming(4, { duration: 3200, easing: Easing.inOut(Easing.quad) });
      rotateX.value = withTiming(-2, { duration: 3200, easing: Easing.inOut(Easing.quad) });
      setTimeout(() => {
        rotateY.value = withTiming(-4, { duration: 3200, easing: Easing.inOut(Easing.quad) });
        rotateX.value = withTiming(2, { duration: 3200, easing: Easing.inOut(Easing.quad) });
      }, 3200);
    };
    loop();
    const interval = setInterval(loop, 6400);
    return () => clearInterval(interval);
  }, [rotateY, rotateX]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${rotateY.value + flip.value * 180}deg` },
      { rotateX: `${rotateX.value}deg` },
      { scale: pressScale.value },
    ],
    opacity: interpolate(flip.value, [0, 0.5, 1], [1, 0, 0]),
    backfaceVisibility: "hidden",
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${rotateY.value + flip.value * 180 - 180}deg` },
      { rotateX: `${rotateX.value}deg` },
      { scale: pressScale.value },
    ],
    opacity: interpolate(flip.value, [0, 0.5, 1], [0, 0, 1]),
    backfaceVisibility: "hidden",
  }));

  const onPressIn = useCallback(() => {
    pressScale.value = withSpring(0.98, { damping: 14, stiffness: 250 });
  }, [pressScale]);
  const onPressOut = useCallback(() => {
    pressScale.value = withSpring(1, { damping: 14, stiffness: 250 });
  }, [pressScale]);

  const handleTap = useCallback(() => {
    haptics.medium();
    onTap?.();
  }, [onTap]);

  return (
    <Pressable onPress={handleTap} onPressIn={onPressIn} onPressOut={onPressOut}>
      <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
        {/* Front */}
        <Animated.View
          style={[
            frontStyle,
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 20,
              overflow: "hidden",
            },
          ]}
        >
          <LinearGradient
            colors={[palette.terracota[700], palette.terracota[500], palette.terracota[400]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              padding: 20,
              justifyContent: "space-between",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Logo size={28} variant="mark" tone="inverse" />
              <Ionicons
                name="wifi"
                size={20}
                color={palette.cream[50]}
                style={{ transform: [{ rotate: "90deg" }] }}
              />
            </View>

            <View>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: 22,
                  letterSpacing: 4,
                  color: palette.cream[50],
                }}
              >
                •••• •••• •••• {last4}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                  marginTop: 14,
                }}
              >
                <View style={{ gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: fonts.sansMedium,
                      fontSize: 9,
                      letterSpacing: 1,
                      color: "rgba(251, 247, 239, 0.6)",
                      textTransform: "uppercase",
                    }}
                  >
                    Titular
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.sansMedium,
                      fontSize: 13,
                      letterSpacing: 0.5,
                      color: palette.cream[50],
                      textTransform: "uppercase",
                    }}
                  >
                    {cardholderName}
                  </Text>
                </View>

                <Text
                  style={{
                    fontFamily: fonts.displayRegular,
                    fontSize: 22,
                    fontStyle: "italic",
                    color: palette.cream[50],
                    letterSpacing: -0.5,
                  }}
                >
                  VISA
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Back */}
        <Animated.View
          style={[
            backStyle,
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 20,
              overflow: "hidden",
            },
          ]}
        >
          <LinearGradient
            colors={[palette.terracota[700], palette.terracota[600]]}
            style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              padding: 20,
              justifyContent: "center",
              gap: 12,
            }}
          >
            <View style={{ height: 40, backgroundColor: palette.ink[900] }} />
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: 12,
                  color: "rgba(251, 247, 239, 0.7)",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                CVV · Exp
              </Text>
              <Text
                style={{ fontFamily: fonts.monoMedium, fontSize: 16, color: palette.cream[50] }}
              >
                ••• · ••/••
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Pressable>
  );
}
