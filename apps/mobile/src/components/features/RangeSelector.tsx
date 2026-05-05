import { useTheme, Text, haptics } from "@moneto/ui";
import { Pressable, View } from "react-native";

import type { PriceHistoryRange } from "@hooks/usePriceHistory";

const RANGES: PriceHistoryRange[] = ["1H", "1D", "7D", "30D", "1Y", "ALL"];

/**
 * Time-range chip selector — patrón estándar trading apps.
 *
 * Diseño:
 * - Chips horizontales centrados.
 * - Active chip = `colors.brand.primary` fill + text inverse. Inactive =
 *   transparente + `text.tertiary`. design.txt — color comunica state
 *   (selected), no decoración.
 * - Haptic select per chip — tactile feedback consistente con el resto.
 */
interface RangeSelectorProps {
  value: PriceHistoryRange;
  onChange: (range: PriceHistoryRange) => void;
}

export function RangeSelector({ value, onChange }: RangeSelectorProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 6,
        justifyContent: "center",
        marginTop: 8,
      }}
      accessibilityRole="tablist"
    >
      {RANGES.map((range) => {
        const isActive = value === range;
        return (
          <Pressable
            key={range}
            onPress={() => {
              if (isActive) return;
              haptics.select();
              onChange(range);
            }}
            hitSlop={6}
            accessibilityRole="tab"
            accessibilityLabel={`Rango ${range}`}
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 8,
                backgroundColor: isActive ? colors.brand.primary : "transparent",
                minWidth: 44,
                alignItems: "center",
              }}
            >
              <Text
                variant="bodySmall"
                style={{
                  color: isActive ? colors.text.inverse : colors.text.tertiary,
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                }}
              >
                {range}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
