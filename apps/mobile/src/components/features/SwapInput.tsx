import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import { formatBalance, getAsset, type AssetId } from "@moneto/types";
import { Card, Text, useTheme } from "@moneto/ui";
import { Pressable, TextInput, View } from "react-native";

import { AssetIcon } from "./AssetIcon";

interface SwapInputProps {
  /** Label arriba del card. */
  label: string;
  /** Asset id del lado actual. */
  asset: AssetId;
  /** Display amount controlled por el caller. String para preservar leading 0/dot. */
  amount: string;
  /** Llamado en cada change del input. Sólo para el lado editable. */
  onAmountChange?: (value: string) => void;
  /** Tap en el chip de asset abre el selector. */
  onAssetPress: () => void;
  /** Lado readonly (output del quote). El user no puede tipear. */
  readonly?: boolean;
  /** Balance disponible del input. Se muestra como "Tenés X. Usar todo". */
  max?: number;
  /** USD-equivalente del amount actual (para subtitle). */
  usdEquivalent?: number;
  /** Si true, el monto excede el balance disponible — pinta el amount en danger. */
  insufficient?: boolean;
  /** Loading flag — output side mientras quote refetches. */
  loading?: boolean;
}

/**
 * Card de input de swap. Asset chip + amount editable con USD equivalent.
 *
 * **Visual** (design.txt + mobile-design.txt):
 * - Variant `sunken` para diferenciar del background y leer como un campo.
 * - Amount en JetBrains Mono Medium 28pt — single emphasis dentro del card.
 * - USD equivalent debajo en `text.tertiary` 12pt — contexto, no headline.
 * - Asset chip a la izquierda con AssetIcon + symbol + chevron.
 * - "Usar todo" link en `brand.primary` cuando `max` y editable.
 *
 * **Insufficient state**: el amount cambia a `colors.danger` y se muestra
 * un caption "Saldo insuficiente". CTA del screen se deshabilita por separado.
 */
export function SwapInput({
  label,
  asset,
  amount,
  onAmountChange,
  onAssetPress,
  readonly = false,
  max,
  usdEquivalent,
  insufficient = false,
  loading = false,
}: SwapInputProps) {
  const { colors } = useTheme();
  const meta = getAsset(asset);
  const amountColor = insufficient ? colors.danger : colors.text.primary;

  return (
    <Card variant="sunken" padded radius="lg">
      {/* Top row: label + Usar todo */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text variant="label" tone="tertiary">
          {label}
        </Text>
        {max !== undefined && !readonly ? (
          <Pressable
            onPress={() => onAmountChange?.(formatNumberForInput(max))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Usar saldo total de ${formatBalance(max, asset)} ${meta.symbol}`}
          >
            <Text
              variant="bodySmall"
              style={{ color: colors.brand.primary, fontFamily: fonts.sansMedium }}
            >
              Usar todo: {formatBalance(max, asset)}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Main row: chip + amount */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={onAssetPress}
          accessibilityRole="button"
          accessibilityLabel={`Cambiar moneda. Actual: ${meta.symbol}`}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: colors.bg.overlay,
            borderWidth: 1,
            borderColor: colors.border.subtle,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <AssetIcon asset={{ id: asset }} size={26} />
          <Text variant="bodyMedium" style={{ fontFamily: fonts.sansMedium }}>
            {meta.symbol}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.text.tertiary} />
        </Pressable>

        <TextInput
          value={amount}
          onChangeText={onAmountChange}
          editable={!readonly}
          placeholder="0"
          placeholderTextColor={colors.text.tertiary}
          keyboardType="decimal-pad"
          allowFontScaling={false}
          accessibilityLabel={`${label}, monto en ${meta.symbol}`}
          style={{
            flex: 1,
            fontFamily: fonts.monoMedium,
            fontSize: 28,
            lineHeight: 32,
            textAlign: "right",
            color: loading ? colors.text.tertiary : amountColor,
            includeFontPadding: false,
            paddingVertical: 0,
          }}
        />
      </View>

      {/* Subtitle row: USD equivalent / insufficient warning */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          marginTop: 6,
          minHeight: 16,
        }}
      >
        {insufficient ? (
          <Text variant="bodySmall" style={{ color: colors.danger }}>
            Saldo insuficiente
          </Text>
        ) : usdEquivalent !== undefined && usdEquivalent > 0 ? (
          <Text variant="bodySmall" tone="tertiary" style={{ fontFamily: fonts.monoMedium }}>
            ≈ ${formatUsd(usdEquivalent)} USD
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * Convierte un display number → string sin notación exponencial, con
 * decimals razonables. JS `toString()` puede emitir `1e-7` para amounts
 * pequeños, lo que rompería el TextInput. Usamos `toFixed` en exponente
 * negativo y trim de zeros.
 */
function formatNumberForInput(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  // Para amounts > 0.0001 usar toString normal; sino, expandir con toFixed.
  if (abs >= 0.0001) {
    return String(n);
  }
  return n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
