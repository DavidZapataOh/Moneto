import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import { Text, useTheme, haptics } from "@moneto/ui";
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { BottomSheet } from "../BottomSheet";

const PRESETS = [
  { label: "0.25%", bps: 25 },
  { label: "0.5%", bps: 50 },
  { label: "1%", bps: 100 },
  { label: "3%", bps: 300 },
] as const;

const MAX_BPS = 500;
const WARN_BPS = 100;

interface SwapSettingsSheetProps {
  visible: boolean;
  slippageBps: number;
  onSlippageChange: (bps: number) => void;
  onDismiss: () => void;
}

/**
 * Sheet de configuración de slippage. Presets [0.25, 0.5, 1, 3]% + custom
 * con cap a 5% (500 bps). Warning copy ≥1% — el user debería entender
 * que slippage > 1% es agresivo.
 *
 * Diseño coherente con design.txt:
 * - Chips secundarios (`bg.overlay` + border), sin color salvo el seleccionado
 *   (`brand.primary` background).
 * - Custom input minimal, mismo styling que chip pero con TextInput dentro.
 */
export function SwapSettingsSheet({
  visible,
  slippageBps,
  onSlippageChange,
  onDismiss,
}: SwapSettingsSheetProps) {
  const { colors } = useTheme();
  const [customText, setCustomText] = useState<string>("");

  // Sync local custom text si el caller cambia el slippage external (ej.
  // reset). Solo actualizamos si el value externo no coincide con un preset.
  useEffect(() => {
    if (!visible) return;
    const isPreset = PRESETS.some((p) => p.bps === slippageBps);
    if (!isPreset) {
      setCustomText((slippageBps / 100).toString());
    } else {
      setCustomText("");
    }
  }, [visible, slippageBps]);

  const isCustom = !PRESETS.some((p) => p.bps === slippageBps);
  const showWarn = slippageBps >= WARN_BPS;

  const handleCustomChange = (text: string) => {
    setCustomText(text);
    const parsed = parseFloat(text);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const bps = Math.min(Math.round(parsed * 100), MAX_BPS);
    if (bps === 0) return;
    onSlippageChange(bps);
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} maxHeightFraction={0.55}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <Text variant="h3">Slippage</Text>
        <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 4 }}>
          Diferencia máxima aceptada entre el precio mostrado y el final
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        {/* Preset chips */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {PRESETS.map((p) => {
            const selected = !isCustom && slippageBps === p.bps;
            return (
              <Pressable
                key={p.bps}
                onPress={() => {
                  haptics.tap();
                  onSlippageChange(p.bps);
                  setCustomText("");
                }}
                accessibilityRole="button"
                accessibilityLabel={`Slippage ${p.label}`}
                accessibilityState={{ selected }}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected ? colors.brand.primary : colors.bg.overlay,
                  borderWidth: 1,
                  borderColor: selected ? colors.brand.primary : colors.border.subtle,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text
                  variant="bodySmall"
                  style={{
                    fontFamily: fonts.monoMedium,
                    color: selected ? colors.text.inverse : colors.text.primary,
                  }}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom input */}
        <View
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: isCustom ? colors.brand.primary : colors.border.subtle,
            backgroundColor: isCustom
              ? `${colors.brand.primary}14` // ~8% alpha tint
              : colors.bg.overlay,
          }}
        >
          <Text variant="bodySmall" tone="tertiary">
            Custom
          </Text>
          <TextInput
            value={customText}
            onChangeText={handleCustomChange}
            placeholder="0.00"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="decimal-pad"
            allowFontScaling={false}
            accessibilityLabel="Slippage personalizado en porcentaje"
            style={{
              flex: 1,
              fontFamily: fonts.monoMedium,
              fontSize: 15,
              color: colors.text.primary,
              textAlign: "right",
              paddingVertical: 0,
              includeFontPadding: false,
            }}
          />
          <Text variant="bodySmall" tone="tertiary" style={{ fontFamily: fonts.monoMedium }}>
            %
          </Text>
        </View>

        {/* Warning */}
        {showWarn ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              backgroundColor: `${colors.warning}1A`,
            }}
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text variant="bodySmall" style={{ flex: 1, color: colors.warning, lineHeight: 16 }}>
              Slippage alto. La transacción puede ejecutarse con un precio menos favorable que el
              mostrado.
            </Text>
          </View>
        ) : null}

        <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 16, lineHeight: 16 }}>
          Recomendado: 0.5% para stables, 1% para volátiles. Máximo permitido: 5%.
        </Text>
      </View>
    </BottomSheet>
  );
}
