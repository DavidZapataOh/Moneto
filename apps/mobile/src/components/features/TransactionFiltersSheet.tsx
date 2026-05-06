import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import { Button, Text, haptics, useTheme } from "@moneto/ui";
import { ScrollView, View } from "react-native";

import {
  ASSET_FILTER_OPTIONS,
  COMPOSITE_PRESETS,
  DATE_PRESETS,
  TX_TYPE_OPTIONS,
  type SortBy,
  type SortOrder,
  type TxFilters,
  type TxTypeFilter,
} from "@/lib/tx-filters";
import { useFiltersStore } from "@stores/useFiltersStore";

import { BottomSheet } from "../BottomSheet";

interface TransactionFiltersSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Sheet con filtros de transactions — Sprint 4.09.
 *
 * Sections:
 * - **Presets** (chips row): "Esta semana", "Solo entradas", etc.
 * - **Tipo** (multi-select chips): p2p_in, p2p_out, swap, cashout, ...
 * - **Asset** (multi-select chips): USD, COP, BTC, SOL, ...
 * - **Fecha** (preset radio chips): exclusive selection.
 * - **Ordenar** (radio chips): date desc/asc, amount desc/asc.
 *
 * **Diseño** (design.txt + colors.txt):
 * - Chips secundarios neutral por default, brand-tinted cuando selected.
 * - Single emphasis: el botón "Aplicar" terracota único.
 * - "Limpiar" en text.tertiary header link — discrete, secondary action.
 */
export function TransactionFiltersSheet({ visible, onDismiss }: TransactionFiltersSheetProps) {
  const { colors } = useTheme();
  const filters = useFiltersStore((s) => s.filters);
  const setFilters = useFiltersStore((s) => s.setFilters);
  const replaceFilters = useFiltersStore((s) => s.replaceFilters);
  const reset = useFiltersStore((s) => s.reset);

  const handleClear = () => {
    haptics.tap();
    reset();
  };

  const handleApply = () => {
    haptics.tap();
    onDismiss();
  };

  const handleTogglePreset = (preset: (typeof COMPOSITE_PRESETS)[number]) => {
    haptics.tap();
    // Replace en lugar de merge — los presets son "intent" exclusive
    // (e.g., "Solo entradas" no debería compose con "Solo retiros"
    // previo).
    replaceFilters({ ...filters, ...preset.apply() });
  };

  const handleToggleType = (type: TxTypeFilter) => {
    haptics.tap();
    const current = filters.types ?? [];
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    setFilters({ types: next.length > 0 ? next : undefined });
  };

  const handleToggleAsset = (asset: string) => {
    haptics.tap();
    const current = filters.assets ?? [];
    const next = current.includes(asset) ? current.filter((a) => a !== asset) : [...current, asset];
    setFilters({ assets: next.length > 0 ? next : undefined });
  };

  const handleSelectDatePreset = (preset: (typeof DATE_PRESETS)[number]) => {
    haptics.tap();
    setFilters({ dateRange: preset.range() });
  };

  const handleClearDate = () => {
    haptics.tap();
    setFilters({ dateRange: undefined });
  };

  const handleSelectSort = (sortBy: SortBy, sortOrder: SortOrder) => {
    haptics.tap();
    setFilters({ sortBy, sortOrder });
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} maxHeightFraction={0.9}>
      <View
        style={{
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <Text variant="h3">Filtros</Text>
        <Text
          variant="bodySmall"
          tone="tertiary"
          style={{ paddingVertical: 4, paddingHorizontal: 4 }}
          onPress={handleClear}
          accessibilityRole="button"
          accessibilityLabel="Limpiar todos los filtros"
        >
          Limpiar
        </Text>
      </View>

      <ScrollView
        style={{ marginTop: 12 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Presets */}
        <SectionLabel>PRESETS</SectionLabel>
        <ChipRow>
          {COMPOSITE_PRESETS.map((p) => (
            <SelectableChip
              key={p.id}
              label={p.label}
              selected={false}
              onPress={() => handleTogglePreset(p)}
            />
          ))}
        </ChipRow>

        {/* Tipo */}
        <SectionLabel style={{ marginTop: 24 }}>TIPO</SectionLabel>
        <ChipRow>
          {TX_TYPE_OPTIONS.map((opt) => (
            <SelectableChip
              key={opt.value}
              label={opt.label}
              selected={(filters.types ?? []).includes(opt.value)}
              onPress={() => handleToggleType(opt.value)}
            />
          ))}
        </ChipRow>

        {/* Asset */}
        <SectionLabel style={{ marginTop: 24 }}>MONEDA</SectionLabel>
        <ChipRow>
          {ASSET_FILTER_OPTIONS.map((asset) => (
            <SelectableChip
              key={asset}
              label={asset}
              selected={(filters.assets ?? []).includes(asset)}
              onPress={() => handleToggleAsset(asset)}
            />
          ))}
        </ChipRow>

        {/* Fecha */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 24,
          }}
        >
          <SectionLabel>FECHA</SectionLabel>
          {filters.dateRange ? (
            <Text
              variant="bodySmall"
              tone="tertiary"
              onPress={handleClearDate}
              accessibilityRole="button"
              accessibilityLabel="Limpiar rango de fechas"
              style={{ paddingHorizontal: 4, paddingVertical: 2 }}
            >
              Limpiar
            </Text>
          ) : null}
        </View>
        <ChipRow>
          {DATE_PRESETS.map((p) => {
            const isSelected = isCurrentDatePreset(filters, p.id);
            return (
              <SelectableChip
                key={p.id}
                label={p.label}
                selected={isSelected}
                onPress={() => handleSelectDatePreset(p)}
              />
            );
          })}
        </ChipRow>

        {/* Sort */}
        <SectionLabel style={{ marginTop: 24 }}>ORDENAR POR</SectionLabel>
        <ChipRow>
          <SortChip
            label="Más recientes"
            selected={
              (filters.sortBy ?? "date") === "date" && (filters.sortOrder ?? "desc") === "desc"
            }
            onPress={() => handleSelectSort("date", "desc")}
          />
          <SortChip
            label="Más antiguos"
            selected={filters.sortBy === "date" && filters.sortOrder === "asc"}
            onPress={() => handleSelectSort("date", "asc")}
          />
          <SortChip
            label="Mayor monto"
            selected={filters.sortBy === "amount" && filters.sortOrder === "desc"}
            onPress={() => handleSelectSort("amount", "desc")}
          />
          <SortChip
            label="Menor monto"
            selected={filters.sortBy === "amount" && filters.sortOrder === "asc"}
            onPress={() => handleSelectSort("amount", "asc")}
          />
        </ChipRow>

        {/* Apply CTA */}
        <View style={{ marginTop: 28 }}>
          <Button
            label="Aplicar filtros"
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleApply}
            leftIcon={<Ionicons name="checkmark" size={18} color={colors.text.inverse} />}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Internal building blocks
// ─────────────────────────────────────────────────────────────────────

function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: { marginTop?: number };
}) {
  return (
    <Text variant="label" tone="tertiary" style={{ marginBottom: 10, ...(style ?? {}) }}>
      {children}
    </Text>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;
}

function SelectableChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Text
      variant="bodySmall"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Filtro ${label}${selected ? ", activo" : ""}`}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: selected ? colors.brand.primary : colors.bg.overlay,
        borderWidth: 1,
        borderColor: selected ? colors.brand.primary : colors.border.subtle,
        color: selected ? colors.text.inverse : colors.text.primary,
        fontFamily: fonts.sansMedium,
        overflow: "hidden",
      }}
    >
      {label}
    </Text>
  );
}

function SortChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return <SelectableChip label={label} selected={selected} onPress={onPress} />;
}

/**
 * Determina si el `dateRange` actual del store coincide con un preset
 * conocido. Si el user setea un preset, ambos timestamps coinciden con
 * `range()` recomputed (acceptable bias — same preset id resolves a
 * timestamps cercanos within ms del primer compute).
 */
function isCurrentDatePreset(filters: TxFilters, presetId: string): boolean {
  if (!filters.dateRange) return false;
  const preset = DATE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return false;
  const candidate = preset.range();
  // Tolerance 5 minutes — el `to` siempre va a now() del compute time,
  // pero presets distintos tienen `from` muy distintos.
  const fromMatches = Math.abs(filters.dateRange.from - candidate.from) < 5 * 60 * 1000;
  return fromMatches;
}
