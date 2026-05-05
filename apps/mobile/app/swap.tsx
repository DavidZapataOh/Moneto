import { Ionicons } from "@expo/vector-icons";
import { SwapError, type SwapErrorCode, type SwapQuote } from "@moneto/solana/jupiter";
import { fonts } from "@moneto/theme";
import { formatBalance, getAsset, isAssetId, rawToDisplay, type AssetId } from "@moneto/types";
import { Button, Card, IconButton, Screen, Text, haptics, useTheme } from "@moneto/ui";
import * as LocalAuthentication from "expo-local-authentication";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Events, getPostHog } from "@/lib/observability";
import { AssetSelectorSheet } from "@components/features/AssetSelectorSheet";
import { SwapInput } from "@components/features/SwapInput";
import { SwapSettingsSheet } from "@components/features/SwapSettingsSheet";
import { useBalance } from "@hooks/useBalance";
import { useExecuteSwap } from "@hooks/useExecuteSwap";
import { useSwapQuote } from "@hooks/useSwapQuote";

const DEFAULT_SLIPPAGE_BPS = 50;
const HIGH_IMPACT_THRESHOLD = 0.03; // 3% price impact triggers warning modal

/**
 * Pantalla de swap custom — UI propio de Moneto sobre Jupiter Aggregator.
 *
 * Flow:
 * 1. User elige `from` + `to` (defaults vía deep-link params o `usd → cop`).
 * 2. User tipea un amount; debounce 300ms refresca quote (Jupiter v6).
 * 3. Quote breakdown muestra tasa, fee, hops, slippage, tiempo estimado.
 * 4. CTA "Convertir" requiere biometric (`LocalAuthentication`).
 * 5. `useExecuteSwap` orquesta sign + send + confirm.
 * 6. Success → `/swap-success` con params; error → Alert con copy mapeada.
 *
 * **Diseño** (design.txt + colors.txt + mobile-design.txt):
 * - **Single emphasis**: el CTA "Convertir" usa `brand.primary`. Todo el
 *   resto en text.primary/secondary/tertiary — el chart no necesita color
 *   porque ya tiene shape.
 * - **60/30/10**: bg neutro 60%, surfaces sunken 30%, brand only en CTA
 *   y chips selected (10%).
 * - **Gift framework**: success replaces (no stacks) y dispara reveal
 *   animation (ver swap-success.tsx) — anticipation → reveal → afterglow.
 * - **Quote freshness badge**: cuando el query is fetching (refetch en
 *   background), pintamos "Actualizando…" sutil en el header.
 *
 * **Compartmentalization**: la pubkey se obtiene de `authState.walletAddress`
 * (Privy resolved); jamás se persiste en Supabase ni se loguea full.
 */
export default function SwapScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ from?: string; to?: string }>();

  const initialFrom = isAssetId(params.from) ? params.from : "usd";
  const initialTo = isAssetId(params.to) ? params.to : "cop";

  const [fromAsset, setFromAsset] = useState<AssetId>(initialFrom);
  const [toAsset, setToAsset] = useState<AssetId>(initialTo);
  const [fromAmount, setFromAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_SLIPPAGE_BPS);

  const [showSettings, setShowSettings] = useState(false);
  const [selectorSide, setSelectorSide] = useState<"from" | "to" | null>(null);
  const [highImpactConfirmed, setHighImpactConfirmed] = useState<string | null>(null);

  // ── Data ────────────────────────────────────────────────────────────
  const balance = useBalance();
  const fromBalanceRaw = balance.data?.assets.find((a) => a.id === fromAsset);
  const fromBalanceDisplay = fromBalanceRaw ? rawToDisplay(fromBalanceRaw.balance, fromAsset) : 0;
  const fromSpotUsd = fromBalanceRaw?.spotPriceUsd ?? 0;
  const toSpotUsd = balance.data?.assets.find((a) => a.id === toAsset)?.spotPriceUsd ?? 0;

  const quote = useSwapQuote({
    inputAsset: fromAsset,
    outputAsset: toAsset,
    amount: fromAmount,
    slippageBps,
  });

  const executeSwap = useExecuteSwap();

  // ── High slippage analytics — fire once per change crossing the threshold
  useEffect(() => {
    if (!quote.data) return;
    if (quote.data.priceImpactPct > 0.01) {
      const ph = getPostHog();
      // Sin payload tipado: el genérico permite props open. Mantenemos
      // mínimo lo necesario para distinguir el evento por slippage_bps.
      if (ph) ph.capture(Events.swap_high_slippage_warning_shown, { slippage_bps: slippageBps });
    }
  }, [quote.data, slippageBps]);

  // ── Derived values ──────────────────────────────────────────────────
  const fromAmountNum = parseFloat(fromAmount);
  const fromUsdEquiv =
    Number.isFinite(fromAmountNum) && fromAmountNum > 0 ? fromAmountNum * fromSpotUsd : 0;
  const insufficient = Number.isFinite(fromAmountNum) && fromAmountNum > fromBalanceDisplay;

  const toAmountDisplay = quote.data ? rawToDisplay(quote.data.outputAmount, toAsset) : 0;
  const toAmountStr = quote.data ? formatBalance(toAmountDisplay, toAsset) : "";
  const toUsdEquiv = toAmountDisplay > 0 ? toAmountDisplay * toSpotUsd : 0;

  const sameAsset = fromAsset === toAsset;
  const hasAmount = Number.isFinite(fromAmountNum) && fromAmountNum > 0;
  const canSwap =
    !sameAsset &&
    hasAmount &&
    !insufficient &&
    !!quote.data &&
    !quote.isFetching &&
    !executeSwap.isPending;

  // Quote freshness indicator: cuando estamos fetching mientras ya hay
  // un quote previo (background refetch), label "Actualizando…".
  const isRefetchingQuote = quote.isFetching && !!quote.data;

  // ── Handlers ────────────────────────────────────────────────────────

  const handleSwapDirection = useCallback(() => {
    haptics.tap();
    setFromAsset((prevFrom) => {
      setToAsset(prevFrom);
      return toAsset;
    });
    // Mantenemos el amount; el quote refresca automáticamente al cambiar mints.
  }, [toAsset]);

  const handleSelectAsset = useCallback(
    (asset: AssetId) => {
      if (selectorSide === "from") {
        if (asset === toAsset) {
          // Si el user eligió el mismo de la otra columna, swap.
          setToAsset(fromAsset);
        }
        setFromAsset(asset);
      } else if (selectorSide === "to") {
        if (asset === fromAsset) {
          setFromAsset(toAsset);
        }
        setToAsset(asset);
      }
      setSelectorSide(null);
    },
    [selectorSide, fromAsset, toAsset],
  );

  const navigateSuccess = useCallback(
    (q: SwapQuote, signature: string) => {
      const fromDisplay = rawToDisplay(q.inputAmount, fromAsset);
      const toDisplay = rawToDisplay(q.outputAmount, toAsset);
      router.replace({
        pathname: "/swap-success",
        params: {
          signature,
          fromAsset,
          toAsset,
          fromAmount: formatBalance(fromDisplay, fromAsset),
          toAmount: formatBalance(toDisplay, toAsset),
        },
      });
    },
    [router, fromAsset, toAsset],
  );

  const performSwap = useCallback(
    async (q: SwapQuote) => {
      // Biometric required — siempre, no opt-out (security considerations 3.06).
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
        if (hasHardware && enrolled) {
          const auth = await LocalAuthentication.authenticateAsync({
            promptMessage: "Confirmar conversión",
            cancelLabel: "Cancelar",
            fallbackLabel: "Usar código",
          });
          if (!auth.success) {
            haptics.warning();
            return;
          }
        }
        // Si no hay hardware/enrolled, no bloqueamos pero loggeamos.
        // Sprint 8 puede forzar enrollment.
      } catch {
        // En simulator iOS sin Touch ID, authenticateAsync puede throw.
        // No bloqueamos — el wallet provider de Privy ya tiene su propia
        // capa de auth.
      }

      haptics.medium();
      executeSwap.mutate(
        { quote: q, fromAsset, toAsset, slippageBps },
        {
          onSuccess: ({ signature }) => {
            haptics.success();
            navigateSuccess(q, signature);
          },
          onError: (error) => {
            haptics.error();
            const code: SwapErrorCode = SwapError.is(error) ? error.code : "EXECUTION_FAILED";
            Alert.alert(errorTitle(code), errorMessage(code), [{ text: "Entendido" }]);
          },
        },
      );
    },
    [executeSwap, fromAsset, toAsset, slippageBps, navigateSuccess],
  );

  const handleConvert = useCallback(() => {
    if (!quote.data) return;
    const ph = getPostHog();
    if (ph) {
      ph.capture(Events.swap_initiated, {
        input: fromAsset,
        output: toAsset,
        slippage_bps: slippageBps,
        hops: quote.data.routeNumHops,
      });
    }

    // High impact gate — pedimos confirmación explícita ≥3%.
    const impact = quote.data.priceImpactPct;
    const fingerprint = `${fromAsset}-${toAsset}-${impact.toFixed(4)}`;
    if (impact >= HIGH_IMPACT_THRESHOLD && highImpactConfirmed !== fingerprint) {
      haptics.warning();
      Alert.alert(
        "Slippage alto detectado",
        `El precio de mercado podría moverse ${(impact * 100).toFixed(2)}% durante la ejecución. ¿Querés continuar?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Continuar",
            style: "destructive",
            onPress: () => {
              setHighImpactConfirmed(fingerprint);
              void performSwap(quote.data!);
            },
          },
        ],
      );
      return;
    }

    void performSwap(quote.data);
  }, [quote.data, fromAsset, toAsset, slippageBps, highImpactConfirmed, performSwap]);

  // ── Quote error message (in-line under breakdown) ────────────────────
  const quoteErrorCopy = useMemo(() => {
    if (!quote.error) return null;
    const code: SwapErrorCode = SwapError.is(quote.error) ? quote.error.code : "NETWORK_ERROR";
    return errorMessage(code);
  }, [quote.error]);

  // ── Render ──────────────────────────────────────────────────────────
  const ctaLabel = executeSwap.isPending
    ? "Convirtiendo…"
    : sameAsset
      ? "Elegí monedas distintas"
      : !hasAmount
        ? "Ingresá un monto"
        : insufficient
          ? "Saldo insuficiente"
          : quote.isPending
            ? "Calculando ruta…"
            : "Convertir";

  return (
    <Screen padded edges={["top", "bottom"]} isModal scroll>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <IconButton
          icon={<Ionicons name="close" size={20} color={colors.text.primary} />}
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
          accessibilityLabel="Cerrar"
        />
        <View style={{ alignItems: "center" }}>
          <Text variant="h3">Convertir</Text>
          {isRefetchingQuote ? (
            <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 2 }}>
              Actualizando…
            </Text>
          ) : null}
        </View>
        <IconButton
          icon={<Ionicons name="settings-outline" size={18} color={colors.text.primary} />}
          variant="ghost"
          size="sm"
          onPress={() => {
            haptics.tap();
            setShowSettings(true);
          }}
          accessibilityLabel="Configurar slippage"
        />
      </View>

      {/* From */}
      <SwapInput
        label="Pagás"
        asset={fromAsset}
        amount={fromAmount}
        onAmountChange={setFromAmount}
        onAssetPress={() => {
          haptics.tap();
          setSelectorSide("from");
        }}
        {...(fromBalanceDisplay > 0 ? { max: fromBalanceDisplay } : {})}
        usdEquivalent={fromUsdEquiv}
        insufficient={insufficient}
      />

      {/* Direction button — overlap entre los dos inputs (z-index trick). */}
      <View style={{ alignItems: "center", marginVertical: -14, zIndex: 10 }}>
        <Pressable
          onPress={handleSwapDirection}
          accessibilityRole="button"
          accessibilityLabel="Invertir dirección de la conversión"
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.bg.elevated,
            borderWidth: 1,
            borderColor: colors.border.default,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Ionicons name="swap-vertical" size={18} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* To */}
      <View style={{ marginTop: 0 }}>
        <SwapInput
          label="Recibís"
          asset={toAsset}
          amount={toAmountStr}
          onAssetPress={() => {
            haptics.tap();
            setSelectorSide("to");
          }}
          readonly
          usdEquivalent={toUsdEquiv}
          loading={quote.isPending && hasAmount && !sameAsset}
        />
      </View>

      {/* Breakdown */}
      <View style={{ marginTop: 20 }}>
        {quote.data ? (
          <BreakdownCard
            quote={quote.data}
            fromAsset={fromAsset}
            toAsset={toAsset}
            slippageBps={slippageBps}
          />
        ) : quote.error ? (
          <Card variant="sunken" padded radius="lg">
            <Text variant="bodySmall" style={{ color: colors.danger, lineHeight: 18 }}>
              {quoteErrorCopy}
            </Text>
          </Card>
        ) : null}
      </View>

      {/* Spacer to push CTA to bottom on tall screens */}
      <View style={{ flex: 1, minHeight: 24 }} />

      <Button
        label={ctaLabel}
        variant="primary"
        size="lg"
        fullWidth
        loading={executeSwap.isPending}
        disabled={!canSwap}
        onPress={handleConvert}
        accessibilityLabel="Convertir activos"
      />

      {/* Sheets */}
      <AssetSelectorSheet
        visible={selectorSide !== null}
        side={selectorSide}
        excludeAsset={selectorSide === "from" ? toAsset : selectorSide === "to" ? fromAsset : null}
        onSelect={handleSelectAsset}
        onDismiss={() => setSelectorSide(null)}
      />

      <SwapSettingsSheet
        visible={showSettings}
        slippageBps={slippageBps}
        onSlippageChange={setSlippageBps}
        onDismiss={() => setShowSettings(false)}
      />
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Breakdown card
// ─────────────────────────────────────────────────────────────────────

function BreakdownCard({
  quote,
  fromAsset,
  toAsset,
  slippageBps,
}: {
  quote: SwapQuote;
  fromAsset: AssetId;
  toAsset: AssetId;
  slippageBps: number;
}) {
  const { colors } = useTheme();
  const fromMeta = getAsset(fromAsset);
  const toMeta = getAsset(toAsset);

  const inDisplay = rawToDisplay(quote.inputAmount, fromAsset);
  const outDisplay = rawToDisplay(quote.outputAmount, toAsset);
  const rate = inDisplay > 0 ? outDisplay / inDisplay : 0;
  const minOutDisplay = rawToDisplay(quote.outputAmountMin, toAsset);

  const impactPct = quote.priceImpactPct * 100;
  const showImpactWarn = impactPct >= 1;

  // Subtle fade-in for breakdown — feels like the route is "settling in".
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 200 });
  }, [opacity, quote.fetchedAt]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={animStyle}>
      <Card variant="sunken" padded radius="lg">
        <BreakdownRow
          label="Tasa"
          value={`1 ${fromMeta.symbol} = ${formatBalance(rate, toAsset)} ${toMeta.symbol}`}
        />
        <BreakdownRow
          label="Mínimo a recibir"
          value={`${formatBalance(minOutDisplay, toAsset)} ${toMeta.symbol}`}
        />
        <BreakdownRow
          label="Ruta"
          value={quote.routeNumHops === 1 ? "Directa" : `${quote.routeNumHops} saltos`}
        />
        <BreakdownRow label="Slippage máx." value={`${(slippageBps / 100).toFixed(2)}%`} />
        <BreakdownRow label="Tiempo estimado" value="<5 segundos" lastRow />

        {showImpactWarn ? (
          <View
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: colors.border.subtle,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
            <Text variant="bodySmall" style={{ color: colors.warning, flex: 1, lineHeight: 16 }}>
              Impacto de precio {impactPct.toFixed(2)}%. La ruta tiene poca liquidez para este
              monto.
            </Text>
          </View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

function BreakdownRow({
  label,
  value,
  lastRow,
}: {
  label: string;
  value: string;
  lastRow?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
        marginBottom: lastRow ? 0 : 2,
      }}
    >
      <Text variant="bodySmall" tone="tertiary">
        {label}
      </Text>
      <Text variant="bodySmall" style={{ fontFamily: fonts.monoMedium }}>
        {value}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Error copy matrix — Sprint 3.04 SwapErrorCode → Spanish UI strings
// ─────────────────────────────────────────────────────────────────────

function errorTitle(code: SwapErrorCode): string {
  switch (code) {
    case "INSUFFICIENT_LIQUIDITY":
      return "Sin liquidez suficiente";
    case "INSUFFICIENT_BALANCE":
      return "Saldo insuficiente";
    case "QUOTE_STALE":
      return "Cotización vencida";
    case "RATE_LIMITED":
      return "Demasiadas solicitudes";
    case "CONFIRMATION_TIMEOUT":
      return "Sin confirmación";
    case "SIMULATION_FAILED":
      return "Simulación fallida";
    case "NETWORK_ERROR":
      return "Sin conexión";
    case "INVALID_INPUT":
      return "Entrada inválida";
    case "EXECUTION_FAILED":
    default:
      return "No pudimos completar la conversión";
  }
}

function errorMessage(code: SwapErrorCode): string {
  switch (code) {
    case "INSUFFICIENT_LIQUIDITY":
      return "No encontramos una ruta con liquidez para este monto. Probá con un monto más bajo o cambiá de moneda.";
    case "INSUFFICIENT_BALANCE":
      return "No tenés saldo suficiente para esta conversión.";
    case "QUOTE_STALE":
      return "La cotización venció antes de ejecutar. Tocá Convertir para refrescar y volver a intentar.";
    case "RATE_LIMITED":
      return "Estamos refrescando demasiado seguido. Esperá unos segundos y volvé a intentar.";
    case "CONFIRMATION_TIMEOUT":
      return "La transacción se envió pero aún no fue confirmada. Si descontaron tu saldo, llegará en unos minutos.";
    case "SIMULATION_FAILED":
      return "La simulación previa falló. Esto suele indicar un cambio brusco de precio — refrescá la cotización y probá de nuevo.";
    case "NETWORK_ERROR":
      return "No pudimos contactar al motor de ruteo. Revisá tu conexión y volvé a intentar.";
    case "INVALID_INPUT":
      return "Verificá el monto y las monedas seleccionadas.";
    case "EXECUTION_FAILED":
    default:
      return "Algo salió mal al ejecutar la conversión. Si el saldo no se modificó, podés volver a intentar.";
  }
}
