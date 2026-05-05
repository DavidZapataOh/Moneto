import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import { Text, useTheme, haptics } from "@moneto/ui";
import { useRouter, type Href } from "expo-router";
import { useMemo } from "react";
import { ScrollView, View, Pressable } from "react-native";

import { AssetIcon } from "./AssetIcon";

import type { Asset } from "@data/mock";

interface AssetStripProps {
  assets: Asset[];
  /**
   * Los N assets top por USD equivalente (pero USD siempre pinned primero).
   * Si hay más que maxVisible, se agrega un chip "Ver todos".
   */
  maxVisible?: number;
}

/**
 * Horizontal scroll strip de assets en Saldo.
 * Reglas:
 * - USD siempre pinned primero (aunque no sea el más grande)
 * - Resto ordenado por USD equivalente descendente
 * - Chip "Ver todos" al final si hay más de maxVisible
 */
export function AssetStrip({ assets, maxVisible = 4 }: AssetStripProps) {
  const router = useRouter();

  // Memoizamos sort + slice — recreaba un array nuevo en cada render
  // del parent (e.g., refresh, tab change). Con memo, identidad
  // estable mientras `assets` no cambie.
  const { visible, hasMore } = useMemo(() => {
    const sorted = [...assets].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.balanceUsd - a.balanceUsd;
    });
    return {
      visible: sorted.slice(0, maxVisible),
      hasMore: sorted.length > maxVisible,
    };
  }, [assets, maxVisible]);

  const handleAssetPress = (assetId: string) => {
    haptics.tap();
    // Sprint 3.05: navega al detalle del asset (push de stack outside tabs).
    router.push(`/activos/${assetId}` as Href);
  };

  const handleSeeAll = () => {
    haptics.tap();
    router.push("/(tabs)/activos" as Href);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingRight: 4 }}
      // Snap suave a cada chip — premium feel típico de Phantom/Robinhood.
      // 130 = 120pt chip + 10pt gap. `decelerationRate="fast"` hace que el
      // momentum termine cerca de un snap point en lugar de correr libre.
      snapToInterval={130}
      decelerationRate="fast"
      snapToAlignment="start"
    >
      {visible.map((asset) => (
        <AssetChip key={asset.id} asset={asset} onPress={() => handleAssetPress(asset.id)} />
      ))}
      {hasMore && <SeeAllChip onPress={handleSeeAll} />}
    </ScrollView>
  );
}

function AssetChip({ asset, onPress }: { asset: Asset; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
      <View
        style={{
          width: 120,
          padding: 12,
          borderRadius: 16,
          backgroundColor: colors.bg.elevated,
          gap: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <AssetIcon asset={asset} size={32} />
          {asset.isEarning && asset.apy ? (
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 10,
                color: colors.value,
                letterSpacing: 0.2,
              }}
            >
              {(asset.apy * 100).toFixed(1)}%
            </Text>
          ) : asset.change24h !== undefined ? (
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 10,
                color: asset.change24h >= 0 ? colors.success : colors.danger,
                letterSpacing: 0.2,
              }}
            >
              {asset.change24h >= 0 ? "↑" : "↓"}
              {Math.abs(asset.change24h * 100).toFixed(1)}%
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 2 }}>
          <Text variant="label" tone="tertiary" style={{ fontSize: 10 }}>
            {asset.shortName}
          </Text>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 14,
              lineHeight: 18,
              color: colors.text.primary,
              letterSpacing: -0.2,
            }}
            allowFontScaling={false}
            numberOfLines={1}
          >
            $
            {asset.balanceUsd >= 1000
              ? `${(asset.balanceUsd / 1000).toFixed(1)}K`
              : asset.balanceUsd.toFixed(0)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function SeeAllChip({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
      {/* Mismo layout interno que AssetChip para que las alturas coincidan */}
      <View
        style={{
          width: 88,
          padding: 12,
          borderRadius: 16,
          backgroundColor: colors.bg.elevated,
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Row 1 — mismo height que icono 32 de AssetChip */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.bg.overlay,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.text.primary} />
        </View>

        {/* Row 2 — mismo height que label+value de AssetChip (~34) */}
        <View style={{ alignItems: "center", justifyContent: "center", height: 34 }}>
          <Text variant="label" tone="tertiary" style={{ fontSize: 10 }}>
            VER TODOS
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
