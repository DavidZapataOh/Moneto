import { fonts, palette } from "@moneto/theme";
import { Text, useTheme } from "@moneto/ui";
import { memo, useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
// eslint-disable-next-line import/no-named-as-default -- react-native-svg expone Svg como default + named.
import Svg, { Circle, G } from "react-native-svg";

import type { VaultAllocation } from "@hooks/useAssetsData";

/**
 * Donut chart custom para la sección "Dónde rinde tu dinero". Sin
 * dependencia de Victory — `react-native-svg` ya está instalado y nos
 * da control total de animación + theming.
 *
 * Spec visual (mobile-design.txt + colors.txt):
 * - Center hole grande (0.55 ratio) → respiración, no abruma.
 * - Center label = APY ponderado, monospace, color `value` (yield accent).
 *   Es el dato más importante de la pantalla rindiendo.
 * - Slices coloreados con tonos del brand palette, NO los colors.danger /
 *   warning (eso confundiría — un slice no es "rojo malo").
 * - Animated sweep entrance: cada slice barrene desde 0 a su porcentaje
 *   con stagger pequeño → "los datos llegando" feel (mobile-design.txt
 *   gift framework: anticipation + reveal).
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface AssetDonutProps {
  data: VaultAllocation[];
  /** APY ponderado a mostrar en el centro. Decimal (0.062). */
  weightedApy: number;
  /** Si true (balance hidden mode), oculta el APY label central. */
  hidden?: boolean;
  /** Tamaño total (alto y ancho). Default 200. */
  size?: number;
}

const STROKE_WIDTH = 18;

export const AssetDonut = memo(function AssetDonut({
  data,
  weightedApy,
  hidden = false,
  size = 200,
}: AssetDonutProps) {
  const { colors } = useTheme();
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  // Paleta del slice — derivada del brand palette warm family. NO usamos
  // danger/success/warning para evitar semántica errónea (un slice 50%
  // no debería leerse como "warning"). Stone[400] aporta neutral cálido
  // para diferenciar sin romper la temperatura del sistema (theme.colors.ts
  // doc: *"Ningún gris es frío"*).
  const slicePalette = [palette.terracota[500], palette.clay[500], palette.stone[400]];

  // Normalizar percentages — protege de drift de rounding (62+28+10 = 100,
  // pero si alguien manda 33.34/33.33/33.33 = 100 también ok). Asume input
  // suma cerca de 100; clampa a 100 si está sobre.
  const total = data.reduce((sum, d) => sum + d.allocationPct, 0);
  const normalized = total > 0 ? data.map((d) => ({ ...d, pct: d.allocationPct / total })) : [];

  // Cumulative offsets para que cada slice empiece donde el anterior terminó.
  let runningOffset = 0;
  const slices = normalized.map((d) => {
    const start = runningOffset;
    runningOffset += d.pct;
    return { ...d, start };
  });

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size, position: "relative" }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${cx}, ${cy}`}>
            {/* Track (background) — oscuro tenue, da sensación de "donut" */}
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              stroke={colors.bg.overlay}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            {slices.map((slice, i) => (
              <DonutSlice
                key={slice.name}
                cx={cx}
                cy={cy}
                radius={radius}
                circumference={circumference}
                startFrac={slice.start}
                pctFrac={slice.pct}
                color={slicePalette[i % slicePalette.length] ?? colors.brand.primary}
                delayMs={120 + i * 100}
              />
            ))}
          </G>
        </Svg>

        {/* Center label */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
          pointerEvents="none"
        >
          <Text variant="label" tone="tertiary" style={{ fontSize: 10, marginBottom: 2 }}>
            APY ponderado
          </Text>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 24,
              lineHeight: 28,
              color: colors.value,
              letterSpacing: -0.3,
            }}
            allowFontScaling={false}
          >
            {hidden ? "•••" : `${(weightedApy * 100).toFixed(2)}%`}
          </Text>
        </View>
      </View>

      {/* Leyenda */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 14,
          marginTop: 16,
        }}
      >
        {slices.map((slice, i) => (
          <View key={slice.name} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: slicePalette[i % slicePalette.length] ?? colors.brand.primary,
              }}
            />
            <Text variant="bodySmall" tone="secondary">
              {slice.name}
            </Text>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 12,
                color: colors.text.tertiary,
              }}
              allowFontScaling={false}
            >
              {Math.round(slice.pct * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});

interface DonutSliceProps {
  cx: number;
  cy: number;
  radius: number;
  circumference: number;
  /** Fracción 0..1 donde empieza el slice. */
  startFrac: number;
  /** Fracción 0..1 que ocupa el slice. */
  pctFrac: number;
  color: string;
  delayMs: number;
}

function DonutSlice({
  cx,
  cy,
  radius,
  circumference,
  startFrac,
  pctFrac,
  color,
  delayMs,
}: DonutSliceProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    // Pequeño delay para que los slices barren en cascade (gift moment).
    const timer = setTimeout(() => {
      progress.value = withTiming(1, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [progress, delayMs]);

  // SVG strokeDashoffset: full = hidden, 0 = full visible.
  // strokeDasharray: [length_visible, length_gap] — el length_gap = circumference
  // hace que el resto del círculo no se renderee.
  const animatedProps = useAnimatedProps(() => {
    const visibleLen = circumference * pctFrac * progress.value;
    const offset = circumference * startFrac;
    return {
      strokeDasharray: [visibleLen, circumference],
      strokeDashoffset: -offset,
    };
  });

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={radius}
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      fill="none"
      strokeLinecap="butt"
      animatedProps={animatedProps}
    />
  );
}
