import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import {
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Screen,
  Text,
  haptics,
  useTheme,
} from "@moneto/ui";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, View } from "react-native";

import { ApiError } from "@/lib/api";
import { exportReceiptPDF, shareReceiptImage } from "@/lib/receipt-share";
import { useTx } from "@hooks/useTx";

import type { DecryptedTx } from "@hooks/useTxHistory";

/**
 * Tx detail screen — Sprint 4.08.
 *
 * Layout (design.txt + colors.txt + mobile-design.txt):
 * - **Receipt-style** card central: status pill + amount hero + details
 *   rows. Pixel-perfect en light + dark.
 * - **Single emphasis**: el amount es el headline (mono 36pt).
 * - **Status icon** color-coded:
 *   - completed → success (clay-tinted bubble + checkmark).
 *   - pending → warning (terracota-tinted + clock).
 *   - failed → danger (red-tinted + alert).
 * - **Actions row** secundarios: Compartir + PDF + Solscan link.
 * - **Privacy**: el `viewRef` captura SOLO el card (no full screen),
 *   así si el user tiene `balanceHidden` activo, el screenshot no
 *   leakea el balance del tab Saldo.
 */
export default function TxDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signature } = useLocalSearchParams<{ signature: string }>();

  const sig = typeof signature === "string" ? signature : "";
  const txQuery = useTx(sig);

  const cardRef = useRef<View>(null);

  const handleBack = useCallback(() => {
    haptics.tap();
    router.back();
  }, [router]);

  const handleCopySignature = useCallback(async () => {
    if (!sig) return;
    haptics.tap();
    try {
      await Clipboard.setStringAsync(sig);
      // Sprint 8: surface a toast en lugar de alert.
      Alert.alert("Copiado", "Hash de la transacción copiado al portapapeles.", [{ text: "OK" }]);
    } catch {
      // best-effort
    }
  }, [sig]);

  const handleShare = useCallback(async () => {
    if (!txQuery.data) return;
    haptics.tap();
    await shareReceiptImage(cardRef as React.RefObject<View>);
  }, [txQuery.data]);

  const handlePdf = useCallback(async () => {
    if (!txQuery.data) return;
    haptics.tap();
    const ok = await exportReceiptPDF(txQuery.data);
    if (!ok) {
      Alert.alert("No pudimos generar el PDF", "Volvé a intentar en unos segundos.", [
        { text: "Entendido" },
      ]);
    }
  }, [txQuery.data]);

  const handleSolscan = useCallback(async () => {
    if (!sig) return;
    haptics.tap();
    const url = `https://solscan.io/tx/${sig}`;
    try {
      await Linking.openURL(url);
    } catch {
      // user OS may not handle https — silent fallback.
    }
  }, [sig]);

  return (
    <Screen padded edges={["top", "bottom"]} scroll>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text variant="h3">Detalle</Text>
        <View style={{ width: 24 }} />
      </View>

      {!sig || sig.length < 40 ? (
        <View style={{ marginTop: 24 }}>
          <EmptyState
            icon="alert-circle-outline"
            title="ID de transacción inválido"
            description="El link que abriste no apunta a una transacción válida."
            cta={{ label: "Volver", leftIcon: "arrow-back", onPress: handleBack }}
          />
        </View>
      ) : txQuery.isPending ? (
        <View style={{ paddingVertical: 64, alignItems: "center" }}>
          <ActivityIndicator color={colors.brand.primary} />
        </View>
      ) : txQuery.isError ? (
        txQuery.error instanceof ApiError && txQuery.error.status === 404 ? (
          <View style={{ marginTop: 24 }}>
            <EmptyState
              icon="document-outline"
              title="Tx no encontrada"
              description="Puede que aún no esté confirmada o no involucre tu cuenta."
              cta={{ label: "Reintentar", onPress: () => void txQuery.refetch() }}
            />
          </View>
        ) : (
          <View style={{ marginTop: 24 }}>
            <ErrorState
              title="No pudimos cargar la transacción"
              description="Verificá tu conexión y volvé a intentar."
              onRetry={() => void txQuery.refetch()}
            />
          </View>
        )
      ) : (
        <>
          {/* Receipt card — captured for share */}
          <ReceiptCard ref={cardRef} tx={txQuery.data} sig={sig} onCopySig={handleCopySignature} />

          {/* Actions row */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Compartir"
                variant="secondary"
                fullWidth
                onPress={handleShare}
                leftIcon={<Ionicons name="share-outline" size={16} color={colors.text.primary} />}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="PDF"
                variant="secondary"
                fullWidth
                onPress={handlePdf}
                leftIcon={
                  <Ionicons name="document-outline" size={16} color={colors.text.primary} />
                }
              />
            </View>
          </View>

          {/* Solscan link — power user secondary */}
          <Pressable
            onPress={handleSolscan}
            hitSlop={8}
            accessibilityRole="link"
            accessibilityLabel="Ver transacción en Solscan"
            style={({ pressed }) => ({
              marginTop: 16,
              alignSelf: "center",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              variant="bodySmall"
              style={{ color: colors.brand.primary, fontFamily: fonts.sansMedium }}
            >
              Ver en Solscan
            </Text>
            <Ionicons name="open-outline" size={12} color={colors.brand.primary} />
          </Pressable>
        </>
      )}
    </Screen>
  );
}

// ─── Receipt card ────────────────────────────────────────────────────

interface ReceiptCardProps {
  tx: DecryptedTx;
  sig: string;
  onCopySig: () => void;
}

const ReceiptCard = ({ tx, sig, onCopySig, ref }: ReceiptCardProps & { ref?: React.Ref<View> }) => {
  const { colors } = useTheme();
  const isIncoming = tx.amount > 0;
  const sign = isIncoming ? "+" : tx.amount < 0 ? "−" : "";
  const abs = Math.abs(tx.amount);
  const amountColor = isIncoming
    ? colors.success
    : tx.status === "failed"
      ? colors.danger
      : colors.text.primary;

  const statusConfig = (() => {
    if (tx.status === "completed") {
      return {
        bg: `${colors.success}29`,
        fg: colors.success,
        icon: "checkmark" as const,
        label: "Completado",
      };
    }
    if (tx.status === "failed") {
      return {
        bg: `${colors.danger}29`,
        fg: colors.danger,
        icon: "close" as const,
        label: "Fallido",
      };
    }
    return {
      bg: `${colors.warning}29`,
      fg: colors.warning,
      icon: "time-outline" as const,
      label: "Pendiente",
    };
  })();

  const dateLabel = new Date(tx.timestamp).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const sigShort = `${sig.slice(0, 8)}…${sig.slice(-6)}`;
  const counterparty = tx.counterpartyName ?? tx.counterpartyHandle;

  return (
    <View ref={ref} collapsable={false}>
      <Card variant="elevated" padded radius="lg">
        {/* Status hero */}
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: statusConfig.bg,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            <Ionicons name={statusConfig.icon} size={28} color={statusConfig.fg} />
          </View>
          <Text variant="label" style={{ color: statusConfig.fg }}>
            {statusConfig.label}
          </Text>
        </View>

        {/* Amount */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 36,
              lineHeight: 42,
              letterSpacing: -0.8,
              color: amountColor,
              includeFontPadding: false,
            }}
            allowFontScaling={false}
            numberOfLines={1}
          >
            {sign}
            {formatAmount(abs, tx.currency)}
          </Text>
          <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 4 }}>
            {tx.currency}
          </Text>
        </View>

        <Divider />

        {/* Details */}
        <View style={{ gap: 0, marginTop: 14 }}>
          <DetailRow label="Tipo" value={typeLabel(tx.type)} />
          {counterparty ? <DetailRow label={isIncoming ? "De" : "A"} value={counterparty} /> : null}
          {tx.description ? <DetailRow label="Mensaje" value={tx.description} /> : null}
          <DetailRow label="Fecha" value={dateLabel} />
          <DetailRow label="ID" value={sigShort} mono onPress={onCopySig} />
        </View>
      </Card>
    </View>
  );
};
ReceiptCard.displayName = "ReceiptCard";

function DetailRow({
  label,
  value,
  mono,
  onPress,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const inner = (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
      }}
    >
      <Text variant="bodySmall" tone="tertiary">
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          maxWidth: "70%",
        }}
      >
        <Text
          style={{
            fontFamily: mono ? fonts.monoMedium : fonts.sansMedium,
            fontSize: 13,
            color: colors.text.primary,
            textAlign: "right",
          }}
          numberOfLines={2}
        >
          {value}
        </Text>
        {onPress ? <Ionicons name="copy-outline" size={12} color={colors.text.tertiary} /> : null}
      </View>
    </View>
  );

  if (!onPress) return inner;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`Copiar ${label.toLowerCase()}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {inner}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function typeLabel(type: DecryptedTx["type"]): string {
  switch (type) {
    case "p2p_in":
      return "Recibido";
    case "p2p_out":
      return "Enviado";
    case "swap":
      return "Conversión";
    case "cashout":
      return "Retiro";
    case "card":
      return "Tarjeta";
    case "yield":
      return "Rendimiento";
    case "payroll":
      return "Pago recibido";
    case "credit":
      return "Crédito";
    case "qr_pay":
      return "Pago QR";
    case "unknown":
    default:
      return "Movimiento";
  }
}

function formatAmount(amount: number, currency: string): string {
  if (currency === "BTC") return amount.toFixed(8);
  if (currency === "SOL" || currency === "ETH") {
    return amount < 1 ? amount.toFixed(4) : amount.toFixed(2);
  }
  if (currency === "COP" || currency === "ARS") {
    return amount.toLocaleString("es-CO", { maximumFractionDigits: 0 });
  }
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
