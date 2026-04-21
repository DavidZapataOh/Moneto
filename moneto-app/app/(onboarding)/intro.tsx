import { useState, useRef } from "react";
import { View, ScrollView, Dimensions, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { Screen } from "@components/ui/Screen";
import { Text } from "@components/ui/Text";
import { Button } from "@components/ui/Button";
import { IconButton } from "@components/ui/IconButton";
import { useTheme } from "@hooks/useTheme";
import { haptics } from "@hooks/useHaptics";
import { fonts } from "@theme/typography";

const { width } = Dimensions.get("window");

const slides = [
  {
    id: 1,
    badge: "01",
    title: "Tu salario,\ninvisible.",
    body: "Recibí USD de trabajos remotos. Tu empleador ve que te pagó; nadie más ve cuánto tenés.",
    icon: "shield-checkmark-outline" as const,
  },
  {
    id: 2,
    badge: "02",
    title: "Rinde\nmientras dormís.",
    body: "Cada dólar genera 6.2% anual automáticamente. Sin CDT, sin mínimos, sin mover nada.",
    icon: "trending-up-outline" as const,
  },
  {
    id: 3,
    badge: "03",
    title: "Gastá en pesos\ndonde vivís.",
    body: "Tarjeta Visa que funciona en cualquier esquina. El comerciante recibe pesos; vos mantenés dólares.",
    icon: "card-outline" as const,
  },
];

export default function IntroCarousel() {
  const router = useRouter();
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const goNext = () => {
    if (index === slides.length - 1) {
      haptics.medium();
      router.push("/(onboarding)/auth");
      return;
    }
    haptics.tap();
    const next = index + 1;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  };

  const onScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIdx = Math.round(x / width);
    if (newIdx !== index) setIndex(newIdx);
  };

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
                backgroundColor:
                  i === index ? colors.brand.primary : colors.border.default,
              }}
            />
          ))}
        </View>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push("/(onboarding)/auth");
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
        {slides.map((slide) => (
          <View
            key={slide.id}
            style={{
              width,
              flex: 1,
              paddingHorizontal: 28,
              justifyContent: "center",
              gap: 28,
            }}
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 24,
                backgroundColor: colors.bg.elevated,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={slide.icon} size={40} color={colors.brand.primary} />
            </View>

            <View style={{ gap: 16 }}>
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
