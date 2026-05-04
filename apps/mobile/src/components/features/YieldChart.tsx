import { View } from "react-native";
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle } from "react-native-svg";
import { useTheme } from "@moneto/ui";

interface YieldChartProps {
  points: number[]; // valores normalizados
  height?: number;
}

/**
 * Gráfico minimalista del yield acumulado.
 * Bézier smooth + glow sutil debajo. Principio: tactile, orgánico.
 */
export function YieldChart({ points, height = 80 }: YieldChartProps) {
  const { colors } = useTheme();
  const width = 320;

  if (points.length < 2) {
    return <View style={{ height }} />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const xStep = width / (points.length - 1);
  const pathPoints = points.map((p, i) => ({
    x: i * xStep,
    y: height - ((p - min) / range) * (height * 0.85) - height * 0.07,
  }));

  const path = pathPoints.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pathPoints[i - 1]!;
    const cpX = (prev.x + p.x) / 2;
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${p.y}, ${p.x} ${p.y}`;
  }, "");

  const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  const color = colors.value;
  const last = pathPoints[pathPoints.length - 1]!;

  return (
    <View style={{ height, width: "100%", alignItems: "center" }}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgGrad id="yieldFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.25} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </SvgGrad>
        </Defs>
        <Path d={fillPath} fill="url(#yieldFill)" />
        <Path
          d={path}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={last.x} cy={last.y} r={4} fill={color} />
        <Circle
          cx={last.x}
          cy={last.y}
          r={8}
          fill={color}
          opacity={0.25}
        />
      </Svg>
    </View>
  );
}
