import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import {
  formatBalance,
  getAsset,
  getAssetBridge,
  isAssetId,
  rawToDisplay,
  type AssetId,
  type BridgeInfo,
} from "@moneto/types";
import { Card, Divider, Screen, SectionHeader, Text, haptics, useTheme } from "@moneto/ui";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { capture, Events, getPostHog } from "@/lib/observability";
import { AssetIcon } from "@components/features/AssetIcon";
import { EmptyTransactions } from "@components/features/EmptyTransactions";
import { PriceChart } from "@components/features/PriceChart";
import { RangeSelector } from "@components/features/RangeSelector";
import { TransactionRow } from "@components/features/TransactionRow";
import { ScreenErrorBoundary } from "@components/ScreenErrorBoundary";
import { useAsset } from "@hooks/useAsset";
import {
  useHasRequestedEarlyAccess,
  useRequestEarlyAccess,
  type EarlyAccessFeature,
} from "@hooks/useEarlyAccess";
import { usePriceHistory, type PriceHistoryRange } from "@hooks/usePriceHistory";
import { useAppStore } from "@stores/useAppStore";

const SECTION_GAP = 24;

/**
 * Asset detail screen — `/activos/:id`. Header + balance hero +
 * chart por categoría (price para volátiles, yield placeholder para
 * stables yielding, nada para stables non-yielding) + actions row +
 * filtered tx list.
 *
 * Filosofía visual aplicada:
 * - **colors.txt 60/30/10**: el chart usa `colors.value` (clay-tinted),
 *   no brand. La emphasis brand-color queda en el balance hero del
 *   tab Saldo y en el botón "Convertir" (CTA primary del flow swap).
 * - **design.txt — single emphasis**: el balance del asset y el chart
 *   son el headline; el resto (24h change, APY, tx list) son contexto.
 * - **mobile-design.txt — gift framework**: el chart entrance con
 *   `strokeDasharray` draw-on (600ms) es un mini-reveal del data; el
 *   user siente que el chart "se dibuja" en lugar de aparecer estático.
 */
export default function AssetDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const balanceHidden = useAppStore((s) => s.balanceHidden);

  // Validar el id como AssetId. Si inválido (deep link malformado),
  // back inmediato con Alert — no crash con `getAsset` throw.
  if (!isAssetId(params.id)) {
    return <InvalidAssetView onBack={() => router.back()} />;
  }
  const id: AssetId = params.id;

  return (
    <Screen padded edges={["top", "bottom"]} scroll>
      <Header id={id} onBack={() => router.back()} />
      <ScreenErrorBoundary feature={`asset-detail.${id}`}>
        <Body id={id} balanceHidden={balanceHidden} />
      </ScreenErrorBoundary>
    </Screen>
  );
}

// ─── Header ──────────────────────────────────────────────────────────

function Header({ id, onBack }: { id: AssetId; onBack: () => void }) {
  const { colors } = useTheme();
  const meta = getAsset(id);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 4,
        marginBottom: 16,
      }}
    >
      <Pressable
        onPress={() => {
          haptics.tap();
          onBack();
        }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <AssetIcon asset={{ id }} size={32} />
        <View>
          <Text variant="bodyMedium">{meta.name}</Text>
          <Text variant="bodySmall" tone="tertiary">
            {meta.symbol}
          </Text>
        </View>
      </View>
      <View style={{ width: 24 }} />
    </View>
  );
}

// ─── Body ─────────────────────────────────────────────────────────────

function Body({ id, balanceHidden }: { id: AssetId; balanceHidden: boolean }) {
  const router = useRouter();
  const meta = getAsset(id);
  const [range, setRange] = useState<PriceHistoryRange>("7D");

  const { asset } = useAsset(id);
  const txs = useAppStore((s) => s.transactions.filter((tx) => tx.assetUsed === id));
  const history = usePriceHistory(id, range);

  // Track la primera vez que el screen se ve (evento de funnel).
  useFireOnce(() => {
    const ph = getPostHog();
    if (ph) capture(ph, Events.asset_detail_viewed, { asset_id: id });
  });

  const handleRangeChange = useCallback(
    (next: PriceHistoryRange) => {
      setRange(next);
      const ph = getPostHog();
      if (ph) capture(ph, Events.asset_chart_range_changed, { asset_id: id, range: next });
    },
    [id],
  );

  const balanceDisplay = asset ? formatBalance(rawToDisplay(asset.balance, id), id) : "0";
  const balanceUsd = asset?.balanceUsd ?? 0;
  const change24h = asset?.change24h;
  const apy = asset?.apy ?? meta.defaultApy;

  // Sprint 3.08: bridge stub — para BTC/ETH mostramos un banner "Coming
  // soon" con CTA al waitlist. Si el user ya tiene balance (bridged
  // externally) el banner queda secundario debajo del chart; sino
  // reemplaza el chart por la empty-state version completa.
  const bridge = getAssetBridge(id);
  const hasOnChainBalance = !!asset && asset.balance > 0n;

  return (
    <View>
      <BalanceHeroCard
        symbol={meta.symbol}
        balanceDisplay={balanceDisplay}
        balanceUsd={balanceUsd}
        category={meta.category}
        hidden={balanceHidden}
        {...(change24h !== undefined ? { change24h } : {})}
        {...(apy !== undefined ? { apy } : {})}
      />

      {/* Bridge stub (Sprint 3.08): banner above chart when user has no
          on-chain balance — replaces chart with full empty-state CTA. */}
      {bridge && !hasOnChainBalance ? (
        <BridgePlaceholder assetId={id} assetName={meta.name} bridge={bridge} variant="full" />
      ) : null}

      {/* Chart por categoría — solo cuando no estamos full-empty del bridge stub. */}
      {!(bridge && !hasOnChainBalance) ? (
        meta.category === "volatile" ? (
          <ChartCard
            range={range}
            onRangeChange={handleRangeChange}
            history={history.data}
            isPending={history.isPending}
          />
        ) : meta.apySource ? (
          <YieldPlaceholderCard apyDecimal={apy ?? 0} />
        ) : null
      ) : null}

      {/* Bridge mini-banner cuando el user SI tiene balance externo. */}
      {bridge && hasOnChainBalance ? (
        <BridgePlaceholder assetId={id} assetName={meta.name} bridge={bridge} variant="compact" />
      ) : null}

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: SECTION_GAP }}>
        <ActionButton
          icon="arrow-down"
          label="Recibir"
          onPress={() => {
            haptics.tap();
            router.push(`/receive?asset=${id}` as Href);
          }}
        />
        <ActionButton
          icon="arrow-up"
          label="Enviar"
          onPress={() => {
            haptics.tap();
            router.push(`/send?asset=${id}` as Href);
          }}
        />
        <ActionButton
          icon="swap-horizontal"
          label="Convertir"
          primary
          onPress={() => {
            haptics.medium();
            router.push(`/swap?from=${id}` as Href);
          }}
        />
      </View>

      {/* Transactions filtered */}
      <View style={{ marginTop: SECTION_GAP * 1.5 }}>
        <SectionHeader title="Movimientos" />
        {txs.length === 0 ? (
          <Card variant="elevated" padded={false} radius="lg">
            <EmptyTransactions />
          </Card>
        ) : (
          <Card variant="elevated" padded={false} radius="lg">
            {txs.slice(0, 10).map((tx, i) => (
              <View key={tx.id}>
                <TransactionRow tx={tx} onPress={() => haptics.tap()} />
                {i < Math.min(txs.length, 10) - 1 ? (
                  <View style={{ paddingHorizontal: 16 }}>
                    <Divider />
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        )}
      </View>
    </View>
  );
}

// ─── Balance hero card ────────────────────────────────────────────────

function BalanceHeroCard({
  symbol,
  balanceDisplay,
  balanceUsd,
  change24h,
  apy,
  category,
  hidden,
}: {
  symbol: string;
  balanceDisplay: string;
  balanceUsd: number;
  change24h?: number;
  apy?: number;
  category: ReturnType<typeof getAsset>["category"];
  hidden: boolean;
}) {
  const { colors } = useTheme();
  const isVolatile = category === "volatile";

  return (
    <Card variant="elevated" padded radius="lg">
      <Text variant="label" tone="tertiary">
        Tu balance
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: 32,
            lineHeight: 36,
            letterSpacing: -0.6,
            color: colors.text.primary,
          }}
          allowFontScaling={false}
          numberOfLines={1}
        >
          {hidden ? "•••" : balanceDisplay}
        </Text>
        <Text
          style={{
            fontFamily: fonts.sansMedium,
            fontSize: 16,
            color: colors.text.tertiary,
          }}
        >
          {symbol}
        </Text>
      </View>
      {!hidden ? (
        <Text variant="bodyMedium" tone="secondary" style={{ marginTop: 4 }}>
          ${balanceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })} USD
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        {isVolatile && change24h !== undefined ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons
              name={change24h >= 0 ? "trending-up" : "trending-down"}
              size={14}
              color={change24h >= 0 ? colors.success : colors.danger}
            />
            <Text
              variant="bodySmall"
              style={{
                color: change24h >= 0 ? colors.success : colors.danger,
                fontFamily: fonts.monoMedium,
              }}
            >
              {change24h >= 0 ? "+" : ""}
              {(change24h * 100).toFixed(2)}% 24h
            </Text>
          </View>
        ) : null}
        {!isVolatile && apy ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="leaf-outline" size={14} color={colors.value} />
            <Text variant="bodySmall" style={{ color: colors.value }}>
              {(apy * 100).toFixed(2)}% APY
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

// ─── Chart card ──────────────────────────────────────────────────────

function ChartCard({
  range,
  onRangeChange,
  history,
  isPending,
}: {
  range: PriceHistoryRange;
  onRangeChange: (r: PriceHistoryRange) => void;
  history: ReturnType<typeof usePriceHistory>["data"];
  isPending: boolean;
}) {
  // Tone basado en trend del primer al último candle.
  const tone: "success" | "danger" | "value" = (() => {
    if (!history || history.points.length < 2) return "value";
    const first = history.points[0]!.price;
    const last = history.points[history.points.length - 1]!.price;
    if (last > first) return "success";
    if (last < first) return "danger";
    return "value";
  })();

  return (
    <Card variant="elevated" padded radius="lg" style={{ marginTop: SECTION_GAP }}>
      {isPending && !history ? (
        <View style={{ height: 180, alignItems: "center", justifyContent: "center" }}>
          <Text variant="bodySmall" tone="tertiary">
            Cargando histórico…
          </Text>
        </View>
      ) : history ? (
        <PriceChart history={history} toneOverride={tone} />
      ) : (
        <View style={{ height: 180, alignItems: "center", justifyContent: "center" }}>
          <Text variant="bodySmall" tone="tertiary">
            Sin historial disponible
          </Text>
        </View>
      )}
      <RangeSelector value={range} onChange={onRangeChange} />
    </Card>
  );
}

// ─── Yield placeholder (stables yielding) ────────────────────────────

function YieldPlaceholderCard({ apyDecimal }: { apyDecimal: number }) {
  const { colors } = useTheme();
  return (
    <Card variant="sunken" padded radius="lg" style={{ marginTop: SECTION_GAP }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: "rgba(200, 148, 80, 0.18)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="leaf" size={22} color={colors.value} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium">Rinde {(apyDecimal * 100).toFixed(2)}% anual</Text>
          <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 2 }}>
            Histórico de yield disponible cuando wireemos Reflect (Sprint 5).
          </Text>
        </View>
      </View>
    </Card>
  );
}

// ─── Action button ───────────────────────────────────────────────────

function ActionButton({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 14,
        backgroundColor: primary ? colors.brand.primary : colors.bg.elevated,
        alignItems: "center",
        gap: 6,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={primary ? colors.text.inverse : colors.text.primary} />
      <Text
        variant="bodySmall"
        style={{
          color: primary ? colors.text.inverse : colors.text.primary,
          fontFamily: "Inter_500Medium",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Bridge placeholder (Sprint 3.08 stub) ───────────────────────────

interface BridgePlaceholderProps {
  assetId: AssetId;
  assetName: string;
  bridge: BridgeInfo;
  /**
   * `full` — empty-state grande que reemplaza el chart cuando el user
   * no tiene balance todavía. `compact` — banner una línea cuando el
   * user ya bridged externally y mostramos el chart.
   */
  variant: "full" | "compact";
}

function BridgePlaceholder({ assetId, assetName, bridge, variant }: BridgePlaceholderProps) {
  const { colors } = useTheme();
  const feature = `bridge:${assetId}` as EarlyAccessFeature;
  const alreadyRequested = useHasRequestedEarlyAccess(feature);
  const requestAccess = useRequestEarlyAccess();

  // Track impression — funnel input para entender cuántos users ven
  // este placeholder. Una vez por mount.
  useFireOnce(() => {
    const ph = getPostHog();
    if (ph) {
      capture(ph, Events.bridge_placeholder_shown, {
        asset: assetId as "btc" | "eth",
        has_external_balance: variant === "compact",
      });
    }
  });

  const handlePress = useCallback(() => {
    if (alreadyRequested || requestAccess.isPending) return;
    haptics.medium();
    requestAccess.mutate(
      { feature, provider: bridge.provider },
      {
        onSuccess: () => {
          haptics.success();
          Alert.alert(
            "Estás en la lista",
            `Te avisamos cuando puedas mover ${assetName} a Moneto.`,
            [{ text: "Listo" }],
          );
        },
        onError: () => {
          haptics.error();
          Alert.alert(
            "No pudimos registrar tu solicitud",
            "Revisá tu conexión y volvé a intentar.",
            [{ text: "Entendido" }],
          );
        },
      },
    );
    const ph = getPostHog();
    if (ph) {
      capture(ph, Events.bridge_early_access_requested, {
        asset: assetId as "btc" | "eth",
        provider:
          bridge.provider === "zeus" || bridge.provider === "wormhole" ? bridge.provider : "other",
      });
    }
  }, [alreadyRequested, requestAccess, feature, bridge.provider, assetId, assetName]);

  if (variant === "compact") {
    return (
      <Card variant="outlined" padded radius="lg" style={{ marginTop: SECTION_GAP }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: `${colors.brand.primary}1F`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="git-branch-outline" size={16} color={colors.brand.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text variant="bodyMedium" numberOfLines={1}>
              Bridge in-app en camino
            </Text>
            <Text variant="bodySmall" tone="tertiary" numberOfLines={2}>
              {bridgeProviderLabel(bridge)} integration próximamente. Solicitá acceso early.
            </Text>
          </View>
          <Pressable
            onPress={handlePress}
            disabled={alreadyRequested || requestAccess.isPending}
            accessibilityRole="button"
            accessibilityLabel={
              alreadyRequested ? "Ya estás en la lista de acceso early" : "Solicitar acceso early"
            }
            accessibilityState={{ disabled: alreadyRequested }}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: alreadyRequested ? colors.bg.overlay : colors.brand.primary,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              variant="bodySmall"
              style={{
                color: alreadyRequested ? colors.text.tertiary : colors.text.inverse,
                fontFamily: fonts.sansMedium,
              }}
            >
              {alreadyRequested ? "Listo" : requestAccess.isPending ? "..." : "Sumarme"}
            </Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  // Full variant — replaces chart when no balance.
  return (
    <Card variant="elevated" padded radius="lg" style={{ marginTop: SECTION_GAP }}>
      <View style={{ alignItems: "center", gap: 16, paddingVertical: 16 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: `${colors.brand.primary}1F`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="git-branch-outline" size={28} color={colors.brand.primary} />
        </View>
        <View style={{ alignItems: "center", gap: 6, paddingHorizontal: 8 }}>
          <Text variant="h3" style={{ textAlign: "center" }}>
            {assetName} en Moneto · próximamente
          </Text>
          <Text
            variant="bodySmall"
            tone="secondary"
            style={{ textAlign: "center", lineHeight: 20, maxWidth: 320 }}
          >
            Estamos integrando {bridgeProviderLabel(bridge)} para que puedas tener {assetName}{" "}
            shielded en tu cuenta sin salir de Moneto. Sumate al waitlist y te avisamos primero
            cuando lance.
          </Text>
        </View>
        <Pressable
          onPress={handlePress}
          disabled={alreadyRequested || requestAccess.isPending}
          accessibilityRole="button"
          accessibilityLabel={
            alreadyRequested ? "Ya estás en la lista de acceso early" : "Solicitar acceso early"
          }
          accessibilityState={{ disabled: alreadyRequested }}
          style={({ pressed }) => ({
            paddingHorizontal: 22,
            paddingVertical: 14,
            borderRadius: 999,
            backgroundColor: alreadyRequested ? colors.bg.overlay : colors.brand.primary,
            opacity: pressed ? 0.7 : 1,
            minWidth: 220,
            alignItems: "center",
          })}
        >
          <Text
            variant="bodyMedium"
            style={{
              color: alreadyRequested ? colors.text.tertiary : colors.text.inverse,
              fontFamily: fonts.sansMedium,
            }}
          >
            {alreadyRequested
              ? "Estás en la lista ✓"
              : requestAccess.isPending
                ? "Registrando…"
                : "Solicitar acceso early"}
          </Text>
        </Pressable>
        <Text variant="bodySmall" tone="tertiary" style={{ textAlign: "center", maxWidth: 280 }}>
          Sin compromisos. Datos solo para avisarte del lanzamiento.
        </Text>
      </View>
    </Card>
  );
}

function bridgeProviderLabel(bridge: BridgeInfo): string {
  switch (bridge.provider) {
    case "zeus":
      return "Zeus Network";
    case "wormhole":
      return "Wormhole";
    case "celo-portal":
      return "Celo Portal";
    case "tron-bridge":
      return "Tron Bridge";
    default:
      return "el bridge";
  }
}

// ─── Invalid asset fallback ──────────────────────────────────────────

function InvalidAssetView({ onBack }: { onBack: () => void }) {
  return (
    <Screen padded edges={["top", "bottom"]}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Text variant="h3">Asset desconocido</Text>
        <Text variant="body" tone="secondary" style={{ textAlign: "center", maxWidth: 280 }}>
          El link que abriste no apunta a un asset soportado por Moneto.
        </Text>
        <Pressable
          onPress={() => {
            haptics.tap();
            onBack();
          }}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text variant="bodyMedium" tone="secondary">
            Volver
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Run callback exactly once per screen lifetime. */
function useFireOnce(fn: () => void) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once intentional
  }, []);
}
