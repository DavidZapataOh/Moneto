import { useTheme, Text } from "@moneto/ui";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, { useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
// eslint-disable-next-line import/no-named-as-default -- react-native-svg expone Svg como default + named.
import Svg, { Path } from "react-native-svg";

import type { PriceHistoryResponse } from "@hooks/usePriceHistory";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Línea de precio custom — SVG-based, sin Skia heavy. Diseño guiado
 * por design.txt:
 *
 * - **Stroke fino (2pt)** — subtle, no agresivo. El balance hero es
 *   la emphasis; el chart es contexto.
 * - **Color = `colors.value`** (clay-tinted yield accent) por default.
 *   Override a `colors.success/danger` cuando el caller passe `tone`
 *   por trend (price subió/bajó del primer candle al último).
 * - **Sin axis verbose** — solo low/high implícitos por la curva. Sprint
 *   8 polish puede agregar tooltip-on-touch.
 *
 * Animation: `strokeDasharray` "draw on" entrance (0 → full length) en
 * 600ms `Easing.out(cubic)` — gift framework reveal moment para el
 * chart aterrizar.
 *
 * Cuando `points.length < 2` rendea empty state (no curva con 1 punto).
 */
interface PriceChartProps {
  history: PriceHistoryResponse;
  height?: number;
  /** Color de la curva. Default `colors.value`. */
  toneOverride?: "value" | "success" | "danger";
}

const DEFAULT_HEIGHT = 180;
const PADDING = { top: 12, right: 8, bottom: 12, left: 8 };

export function PriceChart({ history, height = DEFAULT_HEIGHT, toneOverride }: PriceChartProps) {
  const { colors } = useTheme();
  const points = history.points;

  const { width, pathD, hasData } = useMemo(() => {
    if (points.length < 2) {
      return { width: 0, pathD: "", hasData: false };
    }

    // Calculamos el path en coords normalizadas 0..1 y luego escalamos
    // al render. Esto desacopla el draw del width concrete (que toma de
    // layout via onLayout — pero por simplicidad usamos un width fijo
    // virtual y SVG con `viewBox` lo escala al container).
    const w = 1000;
    const h = height - PADDING.top - PADDING.bottom;

    const tMin = points[0]!.t;
    const tMax = points[points.length - 1]!.t;
    const tRange = Math.max(1, tMax - tMin);

    let pMin = Infinity;
    let pMax = -Infinity;
    for (const p of points) {
      if (p.price < pMin) pMin = p.price;
      if (p.price > pMax) pMax = p.price;
    }
    const pRange = pMax - pMin || 1;

    let d = "";
    points.forEach((p, i) => {
      const x = PADDING.left + ((p.t - tMin) / tRange) * (w - PADDING.left - PADDING.right);
      const y = PADDING.top + (1 - (p.price - pMin) / pRange) * h;
      d += `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)} `;
    });

    return { width: w, pathD: d.trim(), hasData: true };
  }, [points, height]);

  const stroke =
    toneOverride === "success"
      ? colors.success
      : toneOverride === "danger"
        ? colors.danger
        : colors.value;

  // Draw-on animation — strokeDashoffset desde length completo a 0.
  const dashOffset = useSharedValue(1000);
  useEffect(() => {
    if (!hasData) return;
    dashOffset.value = 1000;
    dashOffset.value = withTiming(0, { duration: 600 });
  }, [hasData, pathD, dashOffset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  if (!hasData) {
    return (
      <View
        style={{
          height,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text variant="bodySmall" tone="tertiary">
          Sin historial disponible
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height, width: "100%" }}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <AnimatedPath
          d={pathD}
          stroke={stroke}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          // Length 1000 = mismo que viewBox width — strokeDasharray
          // truco para entrance animation. Si la curva es más larga
          // (multi-trip de up/down), el effect sigue funcionando, solo
          // que la "draw" no es perfectly synchronous con la length real.
          strokeDasharray="1000"
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}
