import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import { Screen, Text, Button, useTheme, haptics } from "@moneto/ui";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState, useRef } from "react";
import {
  View,
  Image,
  ScrollView,
  Dimensions,
  Pressable,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ImageSourcePropType,
} from "react-native";

const { width, height: SCREEN_H } = Dimensions.get("window");

// Fallback conservador para el primer frame. Cada slide luego reporta su
// altura real vía onLayout del text block. No es un "número mágico" — es
// simplemente la peor posición razonable del text block en devices típicos.
const HERO_HEIGHT_FALLBACK = SCREEN_H * 0.38;

// translateY negativo aplicado a la imagen para "subir" la figura dentro del
// hero (la figura del line-art queda visualmente más alta). El hueco que esto
// deja abajo queda oculto por el floor sólido del gradient.
const IMAGE_RISE = 120;

// Extiende el hero container por debajo del top del text block. El text
// block tiene zIndex mayor, así el 01 queda sobre bg sólido (por el floor
// del gradient). Baja visualmente el degradado sin tocar la card.
const HERO_EXTEND = 180;

type Slide = {
  id: number;
  badge: string;
  title: string;
  body: string;
  image?: ImageSourcePropType;
};

const slides: Slide[] = [
  {
    id: 1,
    badge: "01",
    title: "Tu dinero,\nen cualquier moneda.",
    body: "Todas las formas de tu dinero, en un solo lugar. Listas para moverse.",
    image: require("../../assets/images/slide-1.png"),
  },
  {
    id: 2,
    badge: "02",
    title: "Rinde\nmientras dormís.",
    body: "Cada dólar genera 6.2% anual automáticamente. Sin CDT, sin mínimos, sin mover nada.",
    image: require("../../assets/images/slide-2.png"),
  },
  {
    id: 3,
    badge: "03",
    title: "Gastá donde sea,\ncomo sea.",
    body: "Tarjeta Visa en el mundo o escaneá un QR en tu esquina. Desde cualquier moneda que tengas.",
    image: require("../../assets/images/slide-3.png"),
  },
];

export default function IntroCarousel() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [index, setIndex] = useState(0);
  // Una altura por slide: cada card (01 + título + body) tiene distinto height,
  // y con justifyContent: "center" la `y` del text block cambia por slide.
  const [heroHeights, setHeroHeights] = useState<number[]>(() =>
    slides.map(() => HERO_HEIGHT_FALLBACK),
  );
  const scrollRef = useRef<ScrollView>(null);

  // onLayout del text block (01 + título + body): su `y` relativo al content
  // container (que llena el slide con top: 0) es donde arranca visualmente
  // la card — o sea, donde el gradient debe haber alcanzado bg 100% opaco.
  const handleTextBlockLayout = (slideIdx: number) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    setHeroHeights((prev) => {
      const current = prev[slideIdx] ?? 0;
      if (Math.abs(current - y) < 1) return prev;
      const next = [...prev];
      next[slideIdx] = y;
      return next;
    });
  };

  const goNext = () => {
    if (index === slides.length - 1) {
      haptics.medium();
      router.push("/(onboarding)/auth?mode=signup");
      return;
    }
    haptics.tap();
    const next = index + 1;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIdx = Math.round(x / width);
    if (newIdx !== index) setIndex(newIdx);
  };

  const bgRgbaStart = isDark ? "rgba(20, 16, 11, 0)" : "rgba(251, 247, 239, 0)";
  const bgRgbaMid = isDark ? "rgba(20, 16, 11, 0.55)" : "rgba(251, 247, 239, 0.55)";
  const bgRgbaEnd = isDark ? "rgba(20, 16, 11, 1)" : "rgba(251, 247, 239, 1)";

  return (
    <Screen padded={false} edges={["top", "bottom"]}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 16,
          zIndex: 3,
        }}
      >
        <View style={{ flexDirection: "row", gap: 6 }}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 24 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === index ? colors.brand.primary : colors.border.default,
              }}
            />
          ))}
        </View>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push("/(onboarding)/auth?mode=signup");
          }}
          hitSlop={16}
        >
          <Text variant="bodySmall" tone="secondary">
            Saltar
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {slides.map((slide, slideIdx) => (
          <View key={slide.id} style={{ width, flex: 1 }}>
            {/* Imagen + gradient — solo si el slide tiene imagen. No altera nada más. */}
            {slide.image && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  width,
                  height: (heroHeights[slideIdx] ?? 0) + HERO_EXTEND,
                  overflow: "hidden",
                  zIndex: 1,
                }}
              >
                <Image
                  source={slide.image}
                  style={{
                    width,
                    height: (heroHeights[slideIdx] ?? 0) + HERO_EXTEND,
                    transform: [{ translateY: -IMAGE_RISE }],
                  }}
                  resizeMode="cover"
                />
                {/* Gradient cubre TODA la altura del hero. Locations llegan a
                    bg 100% opaco en 0.72 → deja ~28% inferior de bg sólido
                    que enmascara el hueco del translateY (80px) y cualquier
                    trazo del line-art en el borde. */}
                <LinearGradient
                  colors={[bgRgbaStart, bgRgbaMid, bgRgbaEnd]}
                  locations={[0, 0.5, 0.72]}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
              </View>
            )}

            {/* Contenido del slide — ancla al bottom para darle aire a la imagen */}
            <View
              style={{
                width,
                flex: 1,
                paddingHorizontal: 28,
                paddingBottom: 24,
                justifyContent: "flex-end",
                zIndex: 2,
              }}
            >
              <View style={{ gap: 14 }} onLayout={handleTextBlockLayout(slideIdx)}>
                <Text
                  style={{
                    fontFamily: fonts.sansMedium,
                    fontSize: 12,
                    letterSpacing: 1.5,
                    color: colors.text.tertiary,
                  }}
                >
                  {slide.badge}
                </Text>
                <Text variant="heroDisplay" tone="primary">
                  {slide.title}
                </Text>
                <Text variant="body" tone="secondary" style={{ lineHeight: 24 }}>
                  {slide.body}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <Button
          label={index === slides.length - 1 ? "Crear cuenta" : "Siguiente"}
          variant="primary"
          size="lg"
          fullWidth
          onPress={goNext}
          rightIcon={<Ionicons name="arrow-forward" size={18} color={colors.text.inverse} />}
        />
      </View>
    </Screen>
  );
}
