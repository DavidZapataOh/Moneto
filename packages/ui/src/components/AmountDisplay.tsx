import { View } from "react-native";
import { Text } from "./Text";

interface AmountDisplayProps {
  amount: number;
  currency?: "USD" | "COP" | "MXN";
  size?: "hero" | "primary" | "secondary";
  tone?: "primary" | "secondary" | "value" | "success" | "danger";
  showSign?: boolean;
  decimals?: number;
}

export function AmountDisplay({
  amount,
  currency = "USD",
  size = "primary",
  tone = "primary",
  showSign = false,
  decimals = 2,
}: AmountDisplayProps) {
  const variant =
    size === "hero"
      ? "balanceHero"
      : size === "primary"
        ? "amountPrimary"
        : "amountSecondary";

  const sign = showSign && amount > 0 ? "+" : amount < 0 ? "−" : "";
  const absAmount = Math.abs(amount);

  const parts = absAmount.toFixed(decimals).split(".");
  const intPart = parts[0] ?? "0";
  const decPart = parts[1];
  const formattedInt = parseInt(intPart, 10).toLocaleString("en-US");

  return (
    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
      {sign && (
        <Text variant={variant} tone={tone}>
          {sign}
        </Text>
      )}
      <Text variant={variant} tone={tone}>
        {currency === "USD" ? "$" : ""}
        {formattedInt}
      </Text>
      {decPart && decimals > 0 && (
        <Text
          variant={size === "hero" ? "amountPrimary" : "amountSecondary"}
          tone={tone === "primary" ? "secondary" : tone}
          style={{ opacity: 0.6 }}
        >
          .{decPart}
        </Text>
      )}
      {currency !== "USD" && (
        <Text
          variant="amountSecondary"
          tone="tertiary"
          style={{ marginLeft: 6 }}
        >
          {currency}
        </Text>
      )}
    </View>
  );
}
