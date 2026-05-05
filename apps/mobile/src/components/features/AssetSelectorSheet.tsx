import { fonts } from "@moneto/theme";
import {
  formatBalance,
  getEnabledAssets,
  rawToDisplay,
  type AssetId,
  type SolanaNetwork,
} from "@moneto/types";
import { Text, useTheme, haptics } from "@moneto/ui";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { useBalance } from "@hooks/useBalance";

import { BottomSheet } from "../BottomSheet";

import { AssetIcon } from "./AssetIcon";

const NETWORK: SolanaNetwork =
  process.env["EXPO_PUBLIC_SOLANA_NETWORK"] === "devnet" ? "devnet" : "mainnet-beta";

interface AssetSelectorSheetProps {
  visible: boolean;
  /** Side actualmente activo — null cuando el sheet no está visible. */
  side: "from" | "to" | null;
  /** Asset del otro lado (excluido del listado). */
  excludeAsset: AssetId | null;
  onSelect: (asset: AssetId) => void;
  onDismiss: () => void;
}

/**
 * Sheet que lista assets seleccionables. Filtra por `enabledOn` del
 * network actual y excluye el asset del otro lado para prevenir
 * `same-asset` swaps inválidos.
 *
 * Cuando `side === "from"`, ordena por balance descending (assets con
 * saldo arriba). Cuando `side === "to"`, orden alfabético por symbol.
 *
 * Acceso al balance vía `useBalance()` — si no está cargado todavía,
 * los rows se muestran sin balance pero igual seleccionables.
 */
export function AssetSelectorSheet({
  visible,
  side,
  excludeAsset,
  onSelect,
  onDismiss,
}: AssetSelectorSheetProps) {
  const { colors } = useTheme();
  const balance = useBalance();

  const items = useMemo(() => {
    const enabled = getEnabledAssets(NETWORK);
    const balanceById = new Map<AssetId, { display: number; usd: number }>();
    for (const a of balance.data?.assets ?? []) {
      balanceById.set(a.id, {
        display: rawToDisplay(a.balance, a.id),
        usd: a.balanceUsd,
      });
    }

    const filtered = enabled.filter((a) => a.id !== excludeAsset);

    return filtered
      .map((meta) => ({
        id: meta.id,
        symbol: meta.symbol,
        name: meta.name,
        balance: balanceById.get(meta.id) ?? { display: 0, usd: 0 },
      }))
      .sort((a, b) => {
        if (side === "from") {
          // Side "Pagás" → ordenar por USD descending para que el user vea
          // primero los assets con saldo. Tiebreak alfabético.
          if (a.balance.usd !== b.balance.usd) return b.balance.usd - a.balance.usd;
          return a.symbol.localeCompare(b.symbol);
        }
        // Side "Recibís" → orden alfabético, sin sesgo de balance.
        return a.symbol.localeCompare(b.symbol);
      });
  }, [balance.data, excludeAsset, side]);

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} maxHeightFraction={0.7}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <Text variant="h3">{side === "from" ? "Pagás con" : "Recibís"}</Text>
        <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 4 }}>
          {side === "from"
            ? "Elegí la moneda que querés enviar"
            : "Elegí la moneda que querés recibir"}
        </Text>
      </View>

      <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ paddingBottom: 8 }}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              haptics.tap();
              onSelect(item.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Seleccionar ${item.name}`}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 12,
              backgroundColor: pressed ? colors.bg.overlay : "transparent",
            })}
          >
            <AssetIcon asset={{ id: item.id }} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyMedium" style={{ fontFamily: fonts.sansMedium }}>
                {item.symbol}
              </Text>
              <Text variant="bodySmall" tone="tertiary">
                {item.name}
              </Text>
            </View>
            {item.balance.display > 0 ? (
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text
                  variant="bodySmall"
                  style={{
                    fontFamily: fonts.monoMedium,
                    color: colors.text.primary,
                  }}
                >
                  {formatBalance(item.balance.display, item.id)}
                </Text>
                {item.balance.usd >= 0.01 ? (
                  <Text
                    variant="bodySmall"
                    tone="tertiary"
                    style={{ fontFamily: fonts.monoMedium }}
                  >
                    ${item.balance.usd.toFixed(2)}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
