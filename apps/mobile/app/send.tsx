import { Ionicons } from "@expo/vector-icons";
import { TransferError, type TransferErrorCode } from "@moneto/solana/transfer";
import { fonts } from "@moneto/theme";
import { formatBalance, getAsset, isAssetId, rawToDisplay, type AssetId } from "@moneto/types";
import {
  Avatar,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Share, TextInput, View } from "react-native";

import { AssetIcon } from "@components/features/AssetIcon";
import { AssetSelectorSheet } from "@components/features/AssetSelectorSheet";
import { useBalance } from "@hooks/useBalance";
import { useSendP2P } from "@hooks/useSendP2P";
import { useUserSearch, useRecentContacts, type SearchUser } from "@hooks/useUserSearch";

/**
 * P2P Send screen — Sprint 4.05 rewrite.
 *
 * 3-step flow (gift framework: anticipation → action → completion):
 * 1. **Recipient** — search por handle (debounced 300ms) o pick from
 *    recent contacts.
 * 2. **Amount** — asset selector (sheet) + amount input + opcional memo.
 * 3. **Confirm** — preview con avatar+amount+memo+fee, biometric ≥$100,
 *    execute via `useSendP2P` → success screen.
 *
 * **Diseño** (design.txt + colors.txt + mobile-design.txt):
 * - Single emphasis por step: search field (1), amount input (2),
 *   "Confirmar envío" CTA (3).
 * - Header con "Atrás" cuando step > recipient — el user puede revisar.
 * - Step indicator sutil (dot trio) para que el user sepa dónde está.
 * - 60/30/10: bg neutro, surfaces sunken, brand solo en CTAs primary.
 *
 * **Biometric ≥$100**: hard requirement por plan. Soft-fail si no
 * hardware (simulator) — coherente con swap.
 */

const BIOMETRIC_THRESHOLD_USD = 100;
const MEMO_MAX_LEN = 200;

type Step = "recipient" | "amount" | "confirm";

export default function SendScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ asset?: string; recipient?: string }>();

  const initialAsset = isAssetId(params.asset) ? params.asset : "usd";

  const [step, setStep] = useState<Step>("recipient");
  const [recipient, setRecipient] = useState<SearchUser | null>(null);
  const [asset, setAsset] = useState<AssetId>(initialAsset);
  const [amount, setAmount] = useState("");
  const [memoRaw, setMemoRaw] = useState("");
  const [showAssetSheet, setShowAssetSheet] = useState(false);

  const handleClose = useCallback(() => {
    haptics.tap();
    router.back();
  }, [router]);

  const handleBack = useCallback(() => {
    haptics.tap();
    if (step === "amount") setStep("recipient");
    else if (step === "confirm") setStep("amount");
  }, [step]);

  return (
    <Screen padded edges={["top", "bottom"]} isModal scroll>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        {step === "recipient" ? (
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
          <Text variant="h3">Enviar</Text>
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

      {step === "recipient" ? (
        <RecipientStep
          onSelect={(user) => {
            haptics.tap();
            setRecipient(user);
            setStep("amount");
          }}
        />
      ) : null}

      {step === "amount" && recipient ? (
        <AmountStep
          recipient={recipient}
          asset={asset}
          amount={amount}
          memoRaw={memoRaw}
          onAmountChange={setAmount}
          onMemoChange={setMemoRaw}
          onAssetPress={() => {
            haptics.tap();
            setShowAssetSheet(true);
          }}
          onContinue={() => {
            haptics.tap();
            setStep("confirm");
          }}
        />
      ) : null}

      {step === "confirm" && recipient ? (
        <ConfirmStep
          recipient={recipient}
          asset={asset}
          amount={amount}
          memo={memoRaw.trim().slice(0, MEMO_MAX_LEN)}
          onSent={(signature) => {
            router.replace({
              pathname: "/send-success",
              params: {
                amount,
                to: recipient.name ?? recipient.handle,
                mode: "p2p",
                signature,
              },
            });
          }}
        />
      ) : null}

      <AssetSelectorSheet
        visible={showAssetSheet}
        side="from"
        excludeAsset={null}
        onSelect={(next) => {
          setAsset(next);
          setShowAssetSheet(false);
        }}
        onDismiss={() => setShowAssetSheet(false)}
      />
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step indicator (sutil)
// ─────────────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const { colors } = useTheme();
  const order: Step[] = ["recipient", "amount", "confirm"];
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
// Step 1: Recipient
// ─────────────────────────────────────────────────────────────────────

function RecipientStep({ onSelect }: { onSelect: (u: SearchUser) => void }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const search = useUserSearch(query);
  const recents = useRecentContacts();

  const showResults = query.trim().length >= 2;

  return (
    <View>
      <Card variant="outlined" padded={false} radius="lg">
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            gap: 10,
          }}
        >
          <Ionicons name="search" size={16} color={colors.text.tertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscá por @handle"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            allowFontScaling={false}
            style={{
              flex: 1,
              paddingVertical: 14,
              fontSize: 15,
              color: colors.text.primary,
            }}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.text.tertiary} />
            </Pressable>
          ) : null}
        </View>
      </Card>

      {showResults ? (
        <View style={{ marginTop: 16 }}>
          {search.isPending ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <ActivityIndicator color={colors.brand.primary} />
            </View>
          ) : search.data && search.data.length > 0 ? (
            search.data.map((u) => <UserRow key={u.id} user={u} onPress={() => onSelect(u)} />)
          ) : (
            <NoResultsCard query={query} />
          )}
        </View>
      ) : (
        <View style={{ marginTop: 24 }}>
          <Text variant="label" tone="tertiary" style={{ marginBottom: 8 }}>
            RECIENTES
          </Text>
          {recents.data && recents.data.length > 0 ? (
            recents.data.map((u) => <UserRow key={u.id} user={u} onPress={() => onSelect(u)} />)
          ) : (
            <Card variant="sunken" padded radius="lg">
              <Text variant="bodySmall" tone="tertiary" style={{ lineHeight: 20 }}>
                Cuando envíes a alguien la primera vez, va a aparecer acá para que sea más rápido la
                próxima.
              </Text>
            </Card>
          )}
        </View>
      )}
    </View>
  );
}

function UserRow({ user, onPress }: { user: SearchUser; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Enviar a ${user.name ?? user.handle}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 4,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Avatar
        name={user.name ?? user.handle}
        {...(user.avatar_url ? { src: user.avatar_url } : {})}
        size="md"
      />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {user.name ?? user.handle}
        </Text>
        <Text variant="bodySmall" tone="tertiary" numberOfLines={1}>
          @{user.handle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
    </Pressable>
  );
}

function NoResultsCard({ query }: { query: string }) {
  const { colors } = useTheme();
  const handleInvite = async () => {
    haptics.tap();
    try {
      await Share.share({
        message: `Sumate a Moneto y te puedo mandar plata: https://moneto.xyz`,
        title: "Sumate a Moneto",
      });
    } catch {
      // dismissed.
    }
  };
  return (
    <Card variant="sunken" padded radius="lg">
      <View style={{ alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.bg.overlay,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="search-outline" size={20} color={colors.text.tertiary} />
        </View>
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text variant="bodyMedium">Sin resultados para “{query}”</Text>
          <Text variant="bodySmall" tone="tertiary" style={{ textAlign: "center" }}>
            Verificá el handle o invitá a esta persona a Moneto.
          </Text>
        </View>
        <Pressable
          onPress={handleInvite}
          accessibilityRole="button"
          accessibilityLabel="Invitar a Moneto"
          style={({ pressed }) => ({
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: colors.brand.primary,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text
            variant="bodySmall"
            style={{ color: colors.text.inverse, fontFamily: fonts.sansMedium }}
          >
            Invitar a Moneto
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 2: Amount
// ─────────────────────────────────────────────────────────────────────

interface AmountStepProps {
  recipient: SearchUser;
  asset: AssetId;
  amount: string;
  memoRaw: string;
  onAmountChange: (v: string) => void;
  onMemoChange: (v: string) => void;
  onAssetPress: () => void;
  onContinue: () => void;
}

function AmountStep({
  recipient,
  asset,
  amount,
  memoRaw,
  onAmountChange,
  onMemoChange,
  onAssetPress,
  onContinue,
}: AmountStepProps) {
  const { colors } = useTheme();
  const meta = getAsset(asset);
  const balance = useBalance();
  const assetRow = balance.data?.assets.find((a) => a.id === asset);
  const balanceDisplay = assetRow ? rawToDisplay(assetRow.balance, asset) : 0;
  const spotUsd = assetRow?.spotPriceUsd ?? 0;

  const amountNum = parseFloat(amount);
  const validAmount = Number.isFinite(amountNum) && amountNum > 0;
  const insufficient = validAmount && amountNum > balanceDisplay;
  const usdEquiv = validAmount ? amountNum * spotUsd : 0;
  const memoLen = memoRaw.length;

  const canContinue = validAmount && !insufficient;

  return (
    <View style={{ gap: 20 }}>
      {/* Recipient summary */}
      <Card variant="sunken" padded radius="lg">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar
            name={recipient.name ?? recipient.handle}
            {...(recipient.avatar_url ? { src: recipient.avatar_url } : {})}
            size="md"
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="label" tone="tertiary">
              Enviando a
            </Text>
            <Text variant="bodyMedium" numberOfLines={1}>
              {recipient.name ?? recipient.handle}
            </Text>
            <Text variant="bodySmall" tone="tertiary" numberOfLines={1}>
              @{recipient.handle}
            </Text>
          </View>
        </View>
      </Card>

      {/* Asset chip + amount */}
      <Card variant="elevated" padded radius="lg">
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text variant="label" tone="tertiary">
            Mandás
          </Text>
          {balanceDisplay > 0 ? (
            <Pressable
              onPress={() => {
                onAmountChange(formatNumberForInput(balanceDisplay));
                haptics.tap();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Usar saldo total ${formatBalance(balanceDisplay, asset)}`}
            >
              <Text
                variant="bodySmall"
                style={{ color: colors.brand.primary, fontFamily: fonts.sansMedium }}
              >
                Usar todo: {formatBalance(balanceDisplay, asset)}
              </Text>
            </Pressable>
          ) : null}
        </View>

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
            onChangeText={(v) => onAmountChange(v.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="decimal-pad"
            allowFontScaling={false}
            autoFocus
            style={{
              flex: 1,
              fontFamily: fonts.monoMedium,
              fontSize: 28,
              lineHeight: 32,
              textAlign: "right",
              color: insufficient ? colors.danger : colors.text.primary,
              includeFontPadding: false,
              paddingVertical: 0,
            }}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 6,
            minHeight: 16,
          }}
        >
          {insufficient ? (
            <Text variant="bodySmall" style={{ color: colors.danger }}>
              Saldo insuficiente
            </Text>
          ) : (
            <View />
          )}
          {usdEquiv > 0 ? (
            <Text variant="bodySmall" tone="tertiary" style={{ fontFamily: fonts.monoMedium }}>
              ≈ ${usdEquiv.toLocaleString("en-US", { maximumFractionDigits: 2 })} USD
            </Text>
          ) : null}
        </View>
      </Card>

      {/* Memo opcional */}
      <View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <Text variant="label" tone="tertiary">
            MENSAJE (OPCIONAL)
          </Text>
          <Text variant="bodySmall" tone="tertiary">
            {memoLen}/{MEMO_MAX_LEN}
          </Text>
        </View>
        <Card variant="outlined" padded radius="md">
          <TextInput
            value={memoRaw}
            onChangeText={(v) => onMemoChange(v.slice(0, MEMO_MAX_LEN))}
            placeholder="Café del lunes"
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={2}
            allowFontScaling={false}
            style={{
              fontSize: 15,
              color: colors.text.primary,
              minHeight: 24,
              padding: 0,
              textAlignVertical: "top",
            }}
            accessibilityLabel="Mensaje opcional para el destinatario"
          />
        </Card>
      </View>

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
// Step 3: Confirm
// ─────────────────────────────────────────────────────────────────────

interface ConfirmStepProps {
  recipient: SearchUser;
  asset: AssetId;
  amount: string;
  memo: string;
  onSent: (signature: string) => void;
}

function ConfirmStep({ recipient, asset, amount, memo, onSent }: ConfirmStepProps) {
  const { colors } = useTheme();
  const meta = getAsset(asset);
  const balance = useBalance();
  const sendMutation = useSendP2P();
  const amountNum = useMemo(() => parseFloat(amount), [amount]);
  const spotUsd = balance.data?.assets.find((a) => a.id === asset)?.spotPriceUsd ?? 0;
  const usdEquiv = Number.isFinite(amountNum) ? amountNum * spotUsd : 0;
  const requiresBiometric = usdEquiv >= BIOMETRIC_THRESHOLD_USD;

  const handleConfirm = useCallback(async () => {
    if (!Number.isFinite(amountNum) || amountNum <= 0) return;
    if (sendMutation.isPending) return;

    haptics.medium();

    if (requiresBiometric) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
        if (hasHardware && enrolled) {
          const auth = await LocalAuthentication.authenticateAsync({
            promptMessage: `Confirmá enviar $${amount} a ${recipient.handle}`,
            cancelLabel: "Cancelar",
            fallbackLabel: "Usar código",
          });
          if (!auth.success) {
            haptics.warning();
            return;
          }
        }
      } catch {
        // Simulator sin Touch ID — no bloqueamos.
      }
    }

    sendMutation.mutate(
      {
        asset,
        recipientAddress: recipient.wallet_address,
        displayAmount: amountNum,
        memo,
        amountUsd: usdEquiv,
      },
      {
        onSuccess: ({ signature }) => {
          haptics.success();
          onSent(signature);
        },
        onError: (error) => {
          haptics.error();
          const code: TransferErrorCode = TransferError.is(error) ? error.code : "EXECUTION_FAILED";
          Alert.alert(errorTitle(code), errorMessage(code), [{ text: "Entendido" }]);
        },
      },
    );
  }, [
    amountNum,
    amount,
    asset,
    memo,
    recipient,
    requiresBiometric,
    sendMutation,
    onSent,
    usdEquiv,
  ]);

  return (
    <View style={{ gap: 20 }}>
      <Card variant="elevated" padded radius="lg">
        <View style={{ alignItems: "center", gap: 8 }}>
          <Avatar
            name={recipient.name ?? recipient.handle}
            {...(recipient.avatar_url ? { src: recipient.avatar_url } : {})}
            size="lg"
          />
          <Text variant="bodyMedium">{recipient.name ?? recipient.handle}</Text>
          <Text variant="bodySmall" tone="tertiary">
            @{recipient.handle}
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
              {amount}
            </Text>
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 15,
                color: colors.text.tertiary,
              }}
            >
              {meta.symbol}
            </Text>
          </View>
          {usdEquiv > 0 ? (
            <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 4 }}>
              ≈ ${usdEquiv.toLocaleString("en-US", { maximumFractionDigits: 2 })} USD
            </Text>
          ) : null}
        </View>

        {memo ? (
          <View
            style={{
              marginTop: 16,
              padding: 12,
              backgroundColor: colors.bg.overlay,
              borderRadius: 12,
            }}
          >
            <Text variant="bodySmall" tone="secondary" style={{ lineHeight: 18 }}>
              “{memo}”
            </Text>
          </View>
        ) : null}

        <Divider style={{ marginVertical: 16 }} />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text variant="bodySmall" tone="tertiary">
            Fee
          </Text>
          <Text variant="bodySmall" style={{ fontFamily: fonts.sansMedium }}>
            Gratis · P2P interno
          </Text>
        </View>

        {requiresBiometric ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 10,
            }}
          >
            <Ionicons name="finger-print" size={14} color={colors.text.tertiary} />
            <Text variant="bodySmall" tone="tertiary">
              Biometría requerida (≥${BIOMETRIC_THRESHOLD_USD} USD)
            </Text>
          </View>
        ) : null}
      </Card>

      <Button
        label={sendMutation.isPending ? "Enviando…" : "Confirmar envío"}
        variant="primary"
        size="lg"
        fullWidth
        loading={sendMutation.isPending}
        onPress={handleConfirm}
        accessibilityLabel="Confirmar envío"
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function formatNumberForInput(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (Math.abs(n) >= 0.0001) return String(n);
  return n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

function errorTitle(code: TransferErrorCode): string {
  switch (code) {
    case "INSUFFICIENT_BALANCE":
      return "Saldo insuficiente";
    case "INVALID_RECIPIENT":
      return "Destinatario inválido";
    case "INVALID_AMOUNT":
      return "Monto inválido";
    case "ATA_DERIVATION_FAILED":
      return "No pudimos preparar la cuenta";
    case "SIMULATION_FAILED":
      return "Simulación fallida";
    case "CONFIRMATION_TIMEOUT":
      return "Sin confirmación";
    case "NETWORK_ERROR":
      return "Sin conexión";
    case "SELF_SEND":
      return "No podés enviarte a vos mismo";
    case "EXECUTION_FAILED":
    default:
      return "No pudimos completar el envío";
  }
}

function errorMessage(code: TransferErrorCode): string {
  switch (code) {
    case "INSUFFICIENT_BALANCE":
      return "No tenés saldo suficiente para este envío. Probá con un monto más bajo o cambiá de moneda.";
    case "INVALID_RECIPIENT":
      return "La dirección del destinatario no es válida. Verificá el handle.";
    case "INVALID_AMOUNT":
      return "El monto no es válido. Revisá decimales y vuelve a intentar.";
    case "ATA_DERIVATION_FAILED":
      return "No pudimos preparar la cuenta del destinatario. Intentá de nuevo en unos segundos.";
    case "SIMULATION_FAILED":
      return "La simulación previa al envío falló. Refrescá tu saldo y probá de nuevo.";
    case "CONFIRMATION_TIMEOUT":
      return "El envío se mandó pero aún no fue confirmado. Si tu saldo bajó, los fondos llegarán en minutos.";
    case "NETWORK_ERROR":
      return "No pudimos contactar la red. Revisá tu conexión y volvé a intentar.";
    case "SELF_SEND":
      return "No tiene sentido mandarte a vos mismo — elegí otro destinatario.";
    case "EXECUTION_FAILED":
    default:
      return "Algo salió mal al ejecutar el envío. Si el saldo no se modificó, podés volver a intentar.";
  }
}
