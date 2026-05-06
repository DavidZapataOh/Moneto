import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import {
  Badge,
  Button,
  Card,
  Divider,
  IconButton,
  Screen,
  Text,
  haptics,
  useTheme,
} from "@moneto/ui";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";

import { ApiError } from "@/lib/api";
import { useBalance } from "@hooks/useBalance";
import { useCashout, type CashoutLocalCurrency } from "@hooks/useCashout";
import { useAppStore } from "@stores/useAppStore";

/**
 * Cashout screen — Sprint 4.06 STUB.
 *
 * 2-step flow (más corto que P2P porque el destination es fijo):
 * 1. **Amount** — input USD + display de bank account mock + breakdown
 *    preview (rate, fee, amount local).
 * 2. **Confirm** — preview hero card + biometric MANDATORY → execute
 *    via `useCashout` → success screen.
 *
 * **Diseño** (design.txt + colors.txt + mobile-design.txt):
 * - Una sola emphasis por step: amount input (1), "Confirmar retiro"
 *   CTA (2).
 * - Breakdown card en sunken variant — el user ve los detalles fees
 *   sin overwhelming.
 * - Single brand color: el CTA primary terracota. El badge "~10 min"
 *   en neutral, no en marca (es info, no acción).
 *
 * **Biometric mandatory**: cashouts SIEMPRE requieren biometric, sin
 * threshold por amount (el plan: "Biometric mandatory: siempre, no
 * opt-out"). Soft-fail en simulator (no hardware).
 *
 * **Sprint 6** swap-eará:
 * - Mock bank → real bank linking flow.
 * - FX rate hardcoded 4125 → real Pyth FX rate frozen al confirm.
 * - Stub backend → Bold Colombia integration con webhook tracking.
 */

// Mock bank account per country code (Sprint 4.06 stub).
// Sprint 6 reemplaza con real bank linking.
const MOCK_BANK_BY_COUNTRY: Record<
  string,
  { name: string; type: string; last4: string; currency: CashoutLocalCurrency }
> = {
  CO: { name: "Bancolombia", type: "Cuenta de ahorros", last4: "0284", currency: "COP" },
  MX: { name: "BBVA México", type: "Cuenta", last4: "1234", currency: "MXN" },
  BR: { name: "Itaú", type: "Conta corrente", last4: "5678", currency: "BRL" },
  AR: { name: "Santander", type: "Caja de ahorro", last4: "9012", currency: "ARS" },
};

/**
 * FX rates mock — Sprint 4.06 hardcoded. Sprint 6 wirea Pyth FX feeds
 * (USD/COP, USD/MXN, etc.) con frozen-at-confirm pattern.
 */
const MOCK_FX_RATE: Record<CashoutLocalCurrency, number> = {
  COP: 4125,
  MXN: 17.2,
  BRL: 5.05,
  ARS: 1180,
  EUR: 0.92,
  USD: 1,
};

const MONETO_FEE_PCT = 0.0075;
const ETA_MINUTES = 10;

type Step = "amount" | "confirm";

export default function CashoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const balance = useBalance();
  const profile = useAppStore((s) => s.profile);
  const countryCode = profile.countryCode ?? "CO";
  const bank = MOCK_BANK_BY_COUNTRY[countryCode] ?? MOCK_BANK_BY_COUNTRY["CO"]!;
  const fxRate = MOCK_FX_RATE[bank.currency];

  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");

  // Disponible USD = sum balanceUsd de todos los assets stable_usd
  // (USDC, USDG, etc.). Volátiles requieren swap previo en Sprint 6+.
  const availableUsd = useMemo(() => {
    const assets = balance.data?.assets ?? [];
    return assets.filter((a) => a.id === "usd").reduce((sum, a) => sum + a.balanceUsd, 0);
  }, [balance.data]);

  const handleClose = useCallback(() => {
    haptics.tap();
    router.back();
  }, [router]);

  const handleBack = useCallback(() => {
    haptics.tap();
    setStep("amount");
  }, []);

  return (
    <Screen padded edges={["top", "bottom"]} isModal scroll>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        {step === "amount" ? (
          <View style={{ width: 32 }} />
        ) : (
          <IconButton
            icon={<Ionicons name="chevron-back" size={20} color={colors.text.primary} />}
            variant="ghost"
            size="sm"
            onPress={handleBack}
            accessibilityLabel="Atrás"
          />
        )}
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text variant="h3">Retirar</Text>
          <StepIndicator step={step} />
        </View>
        <IconButton
          icon={<Ionicons name="close" size={20} color={colors.text.primary} />}
          variant="ghost"
          size="sm"
          onPress={handleClose}
          accessibilityLabel="Cerrar"
        />
      </View>

      {step === "amount" ? (
        <AmountStep
          amount={amount}
          onAmountChange={setAmount}
          availableUsd={availableUsd}
          bank={bank}
          fxRate={fxRate}
          onContinue={() => {
            haptics.tap();
            setStep("confirm");
          }}
        />
      ) : (
        <ConfirmStep
          amount={amount}
          bank={bank}
          fxRate={fxRate}
          onSent={() => {
            router.replace({
              pathname: "/send-success",
              params: {
                amount,
                to: `${bank.name} •••• ${bank.last4}`,
                mode: "cashout",
              },
            });
          }}
        />
      )}
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const { colors } = useTheme();
  const order: Step[] = ["amount", "confirm"];
  const idx = order.indexOf(step);
  return (
    <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
      {order.map((s, i) => (
        <View
          key={s}
          style={{
            width: i === idx ? 16 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i <= idx ? colors.brand.primary : colors.border.subtle,
          }}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 1: Amount
// ─────────────────────────────────────────────────────────────────────

interface AmountStepProps {
  amount: string;
  onAmountChange: (v: string) => void;
  availableUsd: number;
  bank: (typeof MOCK_BANK_BY_COUNTRY)[string];
  fxRate: number;
  onContinue: () => void;
}

function AmountStep({
  amount,
  onAmountChange,
  availableUsd,
  bank,
  fxRate,
  onContinue,
}: AmountStepProps) {
  const { colors } = useTheme();
  const amountNum = parseFloat(amount);
  const validAmount = Number.isFinite(amountNum) && amountNum > 0;
  const insufficient = validAmount && amountNum > availableUsd;
  const localAmount = validAmount ? amountNum * fxRate : 0;
  const fee = validAmount ? amountNum * MONETO_FEE_PCT : 0;
  const canContinue = validAmount && !insufficient;

  return (
    <View style={{ gap: 20 }}>
      {/* Amount input */}
      <Card variant="elevated" padded radius="lg">
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Text variant="label" tone="tertiary">
            Monto USD
          </Text>
          {availableUsd > 0 ? (
            <Pressable
              onPress={() => {
                haptics.tap();
                onAmountChange(String(Math.floor(availableUsd * 100) / 100));
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Usar saldo total ${availableUsd.toFixed(2)}`}
            >
              <Text
                variant="bodySmall"
                style={{ color: colors.brand.primary, fontFamily: fonts.sansMedium }}
              >
                Usar todo: ${availableUsd.toFixed(2)}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 48,
              lineHeight: 56,
              color: colors.text.tertiary,
              letterSpacing: -1.4,
              includeFontPadding: false,
            }}
            allowFontScaling={false}
          >
            $
          </Text>
          <TextInput
            value={amount}
            onChangeText={(v) => onAmountChange(v.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="decimal-pad"
            allowFontScaling={false}
            autoFocus
            style={{
              flex: 1,
              fontFamily: fonts.monoMedium,
              fontSize: 48,
              lineHeight: 56,
              color: insufficient ? colors.danger : colors.text.primary,
              letterSpacing: -1.4,
              includeFontPadding: false,
              padding: 0,
            }}
          />
        </View>

        <View style={{ minHeight: 18, marginTop: 6 }}>
          {insufficient ? (
            <Text variant="bodySmall" style={{ color: colors.danger }}>
              Saldo insuficiente. Disponible: ${availableUsd.toFixed(2)}
            </Text>
          ) : (
            <Text variant="bodySmall" tone="tertiary">
              Disponible: ${availableUsd.toFixed(2)} USD
            </Text>
          )}
        </View>
      </Card>

      {/* Bank destination */}
      <View>
        <Text variant="label" tone="tertiary" style={{ marginBottom: 8 }}>
          CUENTA DESTINO
        </Text>
        <Card variant="outlined" padded radius="lg">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.bg.overlay,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="business-outline" size={18} color={colors.text.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {bank.name}
              </Text>
              <Text variant="bodySmall" tone="tertiary" numberOfLines={1}>
                {bank.type} · •••• {bank.last4}
              </Text>
            </View>
            <Badge label={`~${ETA_MINUTES} min`} tone="neutral" size="sm" />
          </View>
        </Card>
        <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 8, lineHeight: 18 }}>
          Conversión a {bank.currency} al spot · Fee {(MONETO_FEE_PCT * 100).toFixed(2)}% · Vía
          partner local
        </Text>
      </View>

      {/* Breakdown preview — shows after valid amount */}
      {validAmount && !insufficient ? (
        <Card variant="sunken" padded radius="md">
          <BreakdownRow label="Mandás" value={`$${amount} USD`} />
          <BreakdownRow
            label="Recibís"
            value={`${formatLocal(localAmount, bank.currency)} ${bank.currency}`}
          />
          <Divider style={{ marginVertical: 10 }} />
          <BreakdownRow
            label="Tasa"
            value={`1 USD = ${formatLocal(fxRate, bank.currency)} ${bank.currency}`}
          />
          <BreakdownRow label="Fee Moneto" value={`$${fee.toFixed(2)} (0.75%)`} />
        </Card>
      ) : null}

      <Button
        label="Continuar"
        variant="primary"
        size="lg"
        fullWidth
        disabled={!canContinue}
        onPress={onContinue}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 2: Confirm
// ─────────────────────────────────────────────────────────────────────

interface ConfirmStepProps {
  amount: string;
  bank: (typeof MOCK_BANK_BY_COUNTRY)[string];
  fxRate: number;
  onSent: () => void;
}

function ConfirmStep({ amount, bank, fxRate, onSent }: ConfirmStepProps) {
  const { colors } = useTheme();
  const cashoutMutation = useCashout();
  const amountNum = useMemo(() => parseFloat(amount), [amount]);
  const localAmount = Number.isFinite(amountNum) ? amountNum * fxRate : 0;
  const fee = Number.isFinite(amountNum) ? amountNum * MONETO_FEE_PCT : 0;

  const handleConfirm = useCallback(async () => {
    if (!Number.isFinite(amountNum) || amountNum <= 0) return;
    if (cashoutMutation.isPending) return;

    haptics.medium();

    // Biometric MANDATORY (no threshold). Sprint 1 policy.
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
      if (hasHardware && enrolled) {
        const auth = await LocalAuthentication.authenticateAsync({
          promptMessage: `Confirmá retirar $${amount} a ${bank.name}`,
          cancelLabel: "Cancelar",
          fallbackLabel: "Usar código",
        });
        if (!auth.success) {
          haptics.warning();
          return;
        }
      }
      // Simulator sin biometric — soft-fail.
    } catch {
      // ignored — wallet provider tiene su propia capa de auth.
    }

    cashoutMutation.mutate(
      {
        amount_usd: amountNum,
        exchange_rate: fxRate,
        local_currency: bank.currency,
        amount_local: localAmount,
        destination_label: `${bank.name} •••• ${bank.last4}`,
      },
      {
        onSuccess: () => {
          haptics.success();
          onSent();
        },
        onError: (error) => {
          haptics.error();
          const code = error instanceof ApiError ? error.code : "unknown";
          Alert.alert(errorTitle(code), errorMessage(code), [{ text: "Entendido" }]);
        },
      },
    );
  }, [amountNum, amount, bank, cashoutMutation, fxRate, localAmount, onSent]);

  return (
    <View style={{ gap: 20 }}>
      <Card variant="elevated" padded radius="lg">
        <View style={{ alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.bg.overlay,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="business-outline" size={26} color={colors.text.primary} />
          </View>
          <Text variant="bodyMedium">{bank.name}</Text>
          <Text variant="bodySmall" tone="tertiary">
            {bank.type} · •••• {bank.last4}
          </Text>
        </View>

        <Divider style={{ marginVertical: 16 }} />

        <View style={{ alignItems: "center" }}>
          <Text variant="label" tone="tertiary">
            Mandás
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 36,
                lineHeight: 42,
                color: colors.text.primary,
                letterSpacing: -0.8,
              }}
              allowFontScaling={false}
              numberOfLines={1}
            >
              ${amount}
            </Text>
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 15,
                color: colors.text.tertiary,
              }}
            >
              USD
            </Text>
          </View>
          <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 4 }}>
            Recibís {formatLocal(localAmount, bank.currency)} {bank.currency}
          </Text>
        </View>

        <Divider style={{ marginVertical: 16 }} />

        <View style={{ gap: 8 }}>
          <BreakdownRow
            label="Tasa"
            value={`1 USD = ${formatLocal(fxRate, bank.currency)} ${bank.currency}`}
          />
          <BreakdownRow label="Fee Moneto" value={`$${fee.toFixed(2)} (0.75%)`} />
          <BreakdownRow label="Llegada estimada" value={`~${ETA_MINUTES} minutos`} />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 12,
          }}
        >
          <Ionicons name="finger-print" size={14} color={colors.text.tertiary} />
          <Text variant="bodySmall" tone="tertiary">
            Biometría requerida para confirmar
          </Text>
        </View>
      </Card>

      <Button
        label={cashoutMutation.isPending ? "Procesando…" : "Confirmar retiro"}
        variant="primary"
        size="lg"
        fullWidth
        loading={cashoutMutation.isPending}
        onPress={handleConfirm}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text variant="bodySmall" tone="tertiary">
        {label}
      </Text>
      <Text variant="bodySmall" style={{ fontFamily: fonts.monoMedium }}>
        {value}
      </Text>
    </View>
  );
}

function formatLocal(amount: number, currency: CashoutLocalCurrency): string {
  // COP/ARS sin decimales (locales lo prefieren así). Resto: 2 decimales.
  if (currency === "COP" || currency === "ARS") {
    return amount.toLocaleString("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function errorTitle(code: string): string {
  switch (code) {
    case "profile_not_provisioned":
      return "Cuenta inicializándose";
    case "cashout_insert_failed":
      return "No pudimos procesar el retiro";
    case "rate_limit_exceeded":
      return "Demasiadas solicitudes";
    default:
      return "No pudimos completar el retiro";
  }
}

function errorMessage(code: string): string {
  switch (code) {
    case "profile_not_provisioned":
      return "Tu cuenta aún se está creando. Esperá unos segundos y volvé a intentar.";
    case "cashout_insert_failed":
      return "Hubo un problema al registrar tu retiro. Si tu saldo no se modificó, podés intentar de nuevo.";
    case "rate_limit_exceeded":
      return "Hiciste demasiados retiros muy rápido. Esperá un minuto antes de volver a intentar.";
    default:
      return "Algo salió mal. Si tu saldo no se modificó, podés volver a intentar.";
  }
}
