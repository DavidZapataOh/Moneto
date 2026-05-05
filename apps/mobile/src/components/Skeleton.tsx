import { useTheme } from "@moneto/ui";
import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/**
 * Primitivo skeleton — pulsing rounded rect. Las composiciones (BalanceSkeleton,
 * TxRowSkeleton) usan este primitivo con dimensiones que matchean el componente
 * real para evitar layout shift entre `loading` y `ready`.
 *
 * Color: `colors.bg.overlay` (un tinte sobre el bg.primary). Animación de
 * opacity 0.4 ↔ 0.7 con duration 900ms — suficientemente sutil para que no
 * compita con el rest del UI, suficientemente visible para que el user
 * entienda que algo está cargando.
 */
export function Skeleton({
  width,
  height,
  radius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.bg.overlay,
        },
        animatedStyle,
        style,
      ]}
      accessible
      accessibilityLabel="Cargando"
      accessibilityState={{ busy: true }}
    />
  );
}

/**
 * Esqueleto del Balance hero. Match las dimensiones del `BalanceHero`
 * real (eyebrow line + 48pt mono number + yield line) para zero layout
 * shift al transición a `ready`.
 */
export function BalanceSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <Skeleton width={80} height={12} radius={4} />
      <Skeleton width={220} height={52} radius={6} />
      <Skeleton width={180} height={14} radius={4} />
    </View>
  );
}

/**
 * Esqueleto de una row de transaction. Match `TransactionRow` real:
 * 48×48 icon circle + título + subtítulo + amount derecho.
 */
export function TxRowSkeleton() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 12,
      }}
    >
      <Skeleton width={48} height={48} radius={24} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width={"60%"} height={14} radius={4} />
        <Skeleton width={"40%"} height={12} radius={4} />
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Skeleton width={72} height={14} radius={4} />
        <Skeleton width={48} height={10} radius={4} />
      </View>
    </View>
  );
}
