import { forwardRef } from "react";
import { View } from "react-native";

import { Text, type TextTone } from "./Text";

export type AmountSize = "hero" | "primary" | "secondary";
export type AmountCurrency = "USD" | "COP" | "MXN" | "EUR" | "BRL" | "ARS";

export interface AmountDisplayProps {
  /** Monto numérico. Negativo se renderiza con `−` (minus signo, no ascii). */
  amount: number;
  /** Currency suffix. `USD` se renderiza con `$` prefix sin suffix; otros con suffix de 3 letras. */
  currency?: AmountCurrency;
  /** Tamaño semántico. Default `primary` (16pt mono). */
  size?: AmountSize;
  /** Tone para el integer part. Default `primary`. */
  tone?: Extract<TextTone, "primary" | "secondary" | "value" | "success" | "danger">;
  /** Muestra `+` cuando `amount > 0`. Default `false`. */
  showSign?: boolean;
  /** Decimales a renderizar (parte decimal queda visualmente atenuada). Default `2`. */
  decimals?: number;
  /** Override label para a11y (default: monto formateado). */
  accessibilityLabel?: string;
  /** testID para E2E. */
  testID?: string;
}

const VARIANT_MAP = {
  hero: "balanceHero",
  primary: "amountPrimary",
  secondary: "amountSecondary",
} as const;

const SUFFIX_VARIANT_MAP = {
  hero: "amountPrimary",
  primary: "amountSecondary",
  secondary: "amountSecondary",
} as const;

/**
 * Renderiza un monto monetario con jerarquía visual: integer dominante,
 * decimal atenuado, currency suffix tertiary.
 *
 * Usa `JetBrainsMono` (mono variants de `Text`) — la convención del DS es
 * **mono SIEMPRE para amounts/IDs/timestamps**, sans para todo lo demás.
 *
 * @example
 *   <AmountDisplay amount={1234.56} size="hero" />
 *   <AmountDisplay amount={-12.40} size="primary" tone="danger" showSign />
 *   <AmountDisplay amount={5000} currency="COP" decimals={0} />
 */
export const AmountDisplay = forwardRef<View, AmountDisplayProps>(function AmountDisplay(
  {
    amount,
    currency = "USD",
    size = "primary",
    tone = "primary",
    showSign = false,
    decimals = 2,
    accessibilityLabel,
    testID,
  },
  ref,
) {
  const variant = VARIANT_MAP[size];
  const decimalVariant = SUFFIX_VARIANT_MAP[size];

  const sign = showSign && amount > 0 ? "+" : amount < 0 ? "−" : "";
  const absAmount = Math.abs(amount);

  const parts = absAmount.toFixed(decimals).split(".");
  const intPart = parts[0] ?? "0";
  const decPart = decimals > 0 ? parts[1] : undefined;
  const formattedInt = parseInt(intPart, 10).toLocaleString("en-US");

  const a11yLabel =
    accessibilityLabel ??
    `${sign}${currency === "USD" ? "$" : ""}${formattedInt}${decPart ? "." + decPart : ""}${currency !== "USD" ? " " + currency : ""}`;

  return (
    <View
      ref={ref}
      testID={testID}
      accessible
      accessibilityLabel={a11yLabel}
      style={{ flexDirection: "row", alignItems: "baseline" }}
    >
      {sign ? (
        <Text variant={variant} tone={tone}>
          {sign}
        </Text>
      ) : null}
      <Text variant={variant} tone={tone}>
        {currency === "USD" ? "$" : ""}
        {formattedInt}
      </Text>
      {decPart ? (
        <Text
          variant={decimalVariant}
          tone={tone === "primary" ? "secondary" : tone}
          style={{ opacity: 0.6 }}
        >
          .{decPart}
        </Text>
      ) : null}
      {currency !== "USD" ? (
        <Text variant="amountSecondary" tone="tertiary" style={{ marginLeft: 6 }}>
          {currency}
        </Text>
      ) : null}
    </View>
  );
});

AmountDisplay.displayName = "AmountDisplay";
