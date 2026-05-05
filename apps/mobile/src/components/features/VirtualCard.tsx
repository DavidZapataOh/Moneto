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
  /** Mes 1-12 + año 4 dígitos. Se renderea como `MM/YY` en la cara back. */
  expiryMonth: number;
  expiryYear: number;
  /**
   * Si true, gira la card a back-face (CVV + exp visible). Animado con
   * flip 3D suave (~500ms). El back-face ya NO muestra "•••" sino los
   * datos reales cuando `showFullPan` también está true.
   */
  showDetails?: boolean;
  /**
   * Si true, renderea el PAN completo en la front-face (en lugar del
   * mask `•••• •••• •••• 0142`). Caller debe garantizar que el reveal
   * pasó por biometric antes de setear esto.
   */
  showFullPan?: boolean;
  /** PAN sin separadores. Sólo se usa si `showFullPan === true`. */
  fullPan?: string;
  /** CVV de 3 dígitos para mostrar en la back-face cuando se reveló PAN. */
  cvv?: string;
  /**
   * Si true, dim la card a opacity 0.55 + pause de la idle breathe
   * animation. Indica que la card está congelada y no permite pagos.
   */
  frozen?: boolean;
  onTap?: () => void;
}

/**
 * Formatea un PAN sin separadores (16 dígitos) en grupos de 4. Ejemplo:
 * `4929501234564829` → `4929 5012 3456 4829`. No-op si el PAN no tiene
 * exactamente 16 dígitos (defensivo).
 */
function formatPanSpaced(pan: string): string {
  if (pan.length !== 16) return pan;
  return pan.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/**
 * Tarjeta virtual Visa con tilt 3D sutil.
 * Reference: Revolut Premium card moment — card feels tactile, not static.
 */
export function VirtualCard({
  last4,
  cardholderName,
  expiryMonth,
  expiryYear,
  showDetails = false,
  showFullPan = false,
  fullPan,
  cvv,
  frozen = false,
  onTap,
}: VirtualCardProps) {
  const rotateY = useSharedValue(0);
  const rotateX = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const dimOpacity = useSharedValue(frozen ? 0.55 : 1);

  const flip = useSharedValue(0);

  useEffect(() => {
    flip.value = withTiming(showDetails ? 1 : 0, {
      duration: 500,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [showDetails, flip]);

  // Frozen → dim card a 0.55 (visual signal de "no funcional"). Cuando
  // descongela, vuelve a 1.0 con timing suave.
  useEffect(() => {
    dimOpacity.value = withTiming(frozen ? 0.55 : 1, { duration: 220 });
  }, [frozen, dimOpacity]);

  // Subtle idle breathe — Revolut-esque. Pausada cuando frozen para que el
  // user perciba el "estado quieto" de una card desactivada.
  useEffect(() => {
    if (frozen) return;
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
  }, [rotateY, rotateX, frozen]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${rotateY.value + flip.value * 180}deg` },
      { rotateX: `${rotateX.value}deg` },
      { scale: pressScale.value },
    ],
    opacity: interpolate(flip.value, [0, 0.5, 1], [1, 0, 0]) * dimOpacity.value,
    backfaceVisibility: "hidden",
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${rotateY.value + flip.value * 180 - 180}deg` },
      { rotateX: `${rotateX.value}deg` },
      { scale: pressScale.value },
    ],
    opacity: interpolate(flip.value, [0, 0.5, 1], [0, 0, 1]) * dimOpacity.value,
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
                  // Reducimos el size cuando se renderea PAN completo
                  // (más texto, mantener el ancho contained).
                  fontSize: showFullPan && fullPan ? 18 : 22,
                  letterSpacing: showFullPan && fullPan ? 2 : 4,
                  color: palette.cream[50],
                }}
                allowFontScaling={false}
                numberOfLines={1}
                accessibilityLabel={
                  showFullPan && fullPan
                    ? "Número de tarjeta visible"
                    : `Tarjeta terminada en ${last4.split("").join(" ")}`
                }
              >
                {showFullPan && fullPan ? formatPanSpaced(fullPan) : `•••• •••• •••• ${last4}`}
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
                allowFontScaling={false}
                accessibilityLabel={
                  showFullPan && cvv ? "Datos de seguridad visibles" : "Datos ocultos"
                }
              >
                {showFullPan && cvv ? cvv : "•••"}
                {" · "}
                {showFullPan
                  ? `${expiryMonth.toString().padStart(2, "0")}/${(expiryYear % 100).toString().padStart(2, "0")}`
                  : "••/••"}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Pressable>
  );
}
