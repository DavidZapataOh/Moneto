import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import { getAsset, getEnabledAssets, type AssetId, type SolanaNetwork } from "@moneto/types";
import { Card, Screen, Text, Toggle, useTheme, haptics } from "@moneto/ui";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { ApiError } from "@/lib/api";
import { capture, Events, getPostHog } from "@/lib/observability";
import { AssetIcon } from "@components/features/AssetIcon";
import {
  useAssetPreferences,
  useUpdateAssetPreferences,
  DEFAULT_ASSET_PRIORITY_ORDER,
  DEFAULT_SEND_ASSET,
  type AssetPrefs,
} from "@hooks/useAssetPreferences";

const ROW_HEIGHT = 72;
const ROW_GAP = 8;
const SLOT_HEIGHT = ROW_HEIGHT + ROW_GAP;
const NETWORK: SolanaNetwork =
  process.env["EXPO_PUBLIC_SOLANA_NETWORK"] === "devnet" ? "devnet" : "mainnet-beta";

/**
 * Modal "Prioridades de activos" — Sprint 3.07.
 *
 * Tres ejes de configuración wireados a `user_preferences` (Supabase):
 *
 * 1. **Order** — drag-to-reorder con long-press 220ms. El payment router
 *    (Sprint 6) consume saldo en este orden para pagos / cashout.
 * 2. **Visibility** — toggle per asset. Hidden assets no se renderean en
 *    Asset Strip / lista de holdings, pero los funds **siguen on-chain**.
 *    Default visible para todos los enabled del network.
 * 3. **Default send asset** — pre-selección del Send screen. No puede
 *    coincidir con hidden_assets (server enforce + client guard).
 *
 * **Diseño** (design.txt + colors.txt + mobile-design.txt):
 * - Una sola emphasis: ninguna realmente — esta screen es config, no
 *   showpiece. Texto en `text.primary/secondary`, con `text.tertiary`
 *   para descripciones.
 * - Drag handle como icon `reorder-three` en `text.tertiary` — solo
 *   se "calienta" (color brand) cuando el row está active (lifted).
 * - Active row eleva con shadow + scale 1.02 (gentle spring) — el user
 *   "siente" el peso del item levantado. Coherente con gift framework
 *   (anticipation → action → settle).
 *
 * **Persistencia**: optimistic update en el cache + PUT al server. Si el
 * server falla, rollback automático y Alert con copy en español.
 */
export default function AssetPrioritiesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const prefsQuery = useAssetPreferences();
  const update = useUpdateAssetPreferences();

  const enabledIds = useMemo<AssetId[]>(() => getEnabledAssets(NETWORK).map((a) => a.id), []);
  const enabledSet = useMemo(() => new Set<AssetId>(enabledIds), [enabledIds]);

  // ── Local working state ──────────────────────────────────────────────
  // Editamos en local + diff contra el server al "Guardar". Razón: drag
  // en vivo dispararía 1 PUT por movimiento — ruidoso y propenso a races.
  // El user puede arrepentirse antes de confirmar.
  const [order, setOrder] = useState<AssetId[]>([...DEFAULT_ASSET_PRIORITY_ORDER]);
  const [hidden, setHidden] = useState<Set<AssetId>>(new Set());
  const [defaultSend, setDefaultSend] = useState<AssetId>(DEFAULT_SEND_ASSET);
  const [showDefaultPicker, setShowDefaultPicker] = useState(false);

  // Sync local con remote on initial load + on subsequent fetches.
  // `loadedRef` evita rehydratar cuando el user ya empezó a editar.
  const loadedRef = useRef(false);
  useEffect(() => {
    const data = prefsQuery.data;
    if (!data || loadedRef.current) return;
    const reconciled = reconcileWithEnabled(data, enabledSet);
    setOrder(reconciled.order);
    setHidden(new Set(reconciled.hidden));
    setDefaultSend(reconciled.defaultSend);
    loadedRef.current = true;
  }, [prefsQuery.data, enabledSet]);

  // Filtro: el screen solo lista assets enabled del network actual.
  const visibleOrder = useMemo(() => order.filter((id) => enabledSet.has(id)), [order, enabledSet]);

  const visibleCount = visibleOrder.filter((id) => !hidden.has(id)).length;
  const allHidden = visibleCount === 0;
  const dirty = useMemo(() => {
    const remote = prefsQuery.data;
    if (!remote) return false;
    if (remote.default_send_asset !== defaultSend) return true;
    if (!arrayEq(remote.asset_priority_order, order)) return true;
    if (!setEq(remote.hidden_assets, Array.from(hidden))) return true;
    return false;
  }, [prefsQuery.data, order, hidden, defaultSend]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleReorder = useCallback((from: number, to: number) => {
    if (from === to) return;
    haptics.select();
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      if (!moved) return prev;
      next.splice(to, 0, moved);
      const ph = getPostHog();
      // El evento existente (`assets_priorities_changed`) está tipado
      // como `direction: -1 | 1`. Si el user dragga >1 paso, igual lo
      // reportamos con el signed sign más cercano para mantener parity.
      if (ph) {
        capture(ph, Events.assets_priorities_changed, {
          asset: moved as "usd" | "cop" | "sol" | "btc",
          direction: to > from ? 1 : -1,
        });
      }
      return next;
    });
  }, []);

  const handleToggleHidden = useCallback(
    (assetId: AssetId) => {
      haptics.tap();
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(assetId)) {
          next.delete(assetId);
          return next;
        }
        // Guard: no permitir ocultar el último visible.
        const wouldHideAll = [...next, assetId].length >= visibleOrder.length;
        if (wouldHideAll) {
          haptics.warning();
          Alert.alert(
            "Necesitás un activo visible",
            "Mantené al menos un activo visible para que Moneto pueda mostrar tu saldo.",
            [{ text: "Entendido" }],
          );
          return prev;
        }
        // Si ocultamos el default_send_asset, switch al primer visible.
        next.add(assetId);
        if (assetId === defaultSend) {
          const firstVisible = visibleOrder.find((id) => !next.has(id));
          if (firstVisible) setDefaultSend(firstVisible);
        }
        return next;
      });
    },
    [visibleOrder, defaultSend],
  );

  const handleChangeDefault = useCallback((assetId: AssetId) => {
    haptics.tap();
    setDefaultSend(assetId);
    setShowDefaultPicker(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!dirty || update.isPending) return;
    haptics.medium();

    update.mutate(
      {
        asset_priority_order: order,
        hidden_assets: Array.from(hidden),
        default_send_asset: defaultSend,
      },
      {
        onSuccess: () => {
          haptics.success();
          router.back();
        },
        onError: (err) => {
          haptics.error();
          const code = err instanceof ApiError ? err.code : null;
          const message =
            code === "asset_prefs_invariant_violation"
              ? "Revisá tus preferencias: el activo por defecto no puede estar oculto."
              : code === "profile_not_provisioned"
                ? "Tu perfil aún se está creando. Esperá unos segundos y volvé a intentar."
                : "No pudimos guardar tus preferencias. Verificá tu conexión y volvé a intentar.";
          Alert.alert("No se pudo guardar", message, [{ text: "Entendido" }]);
        },
      },
    );
  }, [dirty, update, order, hidden, defaultSend, router]);

  const handleClose = useCallback(() => {
    if (dirty) {
      haptics.warning();
      Alert.alert("Cambios sin guardar", "Si cerrás ahora, tus cambios se descartarán.", [
        { text: "Seguir editando", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: () => {
            haptics.tap();
            router.back();
          },
        },
      ]);
      return;
    }
    haptics.tap();
    router.back();
  }, [dirty, router]);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <Screen padded edges={["top", "bottom"]} isModal>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 4,
          marginBottom: 16,
        }}
      >
        <Text variant="h2">Activos</Text>
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      <Text variant="body" tone="secondary" style={{ marginBottom: 20, lineHeight: 22 }}>
        Mantené presionado y arrastrá para reordenar. Cuando hacés un pago, Moneto usa tus activos
        en este orden.
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <DraggableList
          order={visibleOrder}
          hidden={hidden}
          defaultSend={defaultSend}
          onReorder={handleReorder}
          onToggleHidden={handleToggleHidden}
        />

        {/* Default send asset row */}
        <View style={{ marginTop: 28 }}>
          <Text variant="label" tone="tertiary" style={{ marginBottom: 8 }}>
            ACTIVO POR DEFECTO PARA ENVÍOS
          </Text>
          <Card variant="elevated" padded={false} radius="lg">
            <Pressable
              onPress={() => {
                haptics.tap();
                setShowDefaultPicker((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityLabel="Cambiar activo por defecto para envíos"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 14,
                gap: 12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <AssetIcon asset={{ id: defaultSend }} size={36} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text variant="bodyMedium">{getAsset(defaultSend).name}</Text>
                <Text variant="bodySmall" tone="tertiary">
                  Pre-seleccionado al abrir el screen Enviar
                </Text>
              </View>
              <Ionicons
                name={showDefaultPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.text.tertiary}
              />
            </Pressable>
          </Card>
          {showDefaultPicker ? (
            <View style={{ marginTop: 8 }}>
              <Card variant="outlined" padded={false} radius="lg">
                {visibleOrder.map((id) => {
                  const isHidden = hidden.has(id);
                  const isCurrent = id === defaultSend;
                  if (isHidden) return null;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => handleChangeDefault(id)}
                      accessibilityRole="radio"
                      accessibilityLabel={`Activo por defecto: ${getAsset(id).name}`}
                      accessibilityState={{ selected: isCurrent }}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        gap: 12,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <AssetIcon asset={{ id }} size={28} />
                      <Text variant="bodyMedium" style={{ flex: 1 }}>
                        {getAsset(id).name}
                      </Text>
                      {isCurrent ? (
                        <Ionicons name="checkmark-circle" size={18} color={colors.brand.primary} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          ) : null}
        </View>

        {/* Info note */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
            marginTop: 20,
          }}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.text.tertiary}
            style={{ marginTop: 2 }}
          />
          <Text variant="bodySmall" tone="tertiary" style={{ flex: 1, lineHeight: 18 }}>
            Ocultar un activo solo lo retira de la UI — los fondos siguen seguros on-chain y podés
            volver a mostrarlo cuando quieras.
          </Text>
        </View>
      </ScrollView>

      {/* Save bar */}
      <View
        style={{
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border.subtle,
          gap: 8,
        }}
      >
        {allHidden ? (
          <Text variant="bodySmall" style={{ color: colors.danger, textAlign: "center" }}>
            Necesitás al menos un activo visible para guardar
          </Text>
        ) : null}
        <Pressable
          onPress={handleSave}
          disabled={!dirty || allHidden || update.isPending}
          accessibilityRole="button"
          accessibilityLabel="Guardar preferencias"
          accessibilityState={{ disabled: !dirty || allHidden }}
          style={({ pressed }) => ({
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: !dirty || allHidden ? colors.bg.overlay : colors.brand.primary,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text
            variant="bodyMedium"
            style={{
              fontFamily: fonts.sansMedium,
              color: !dirty || allHidden ? colors.text.tertiary : colors.text.inverse,
            }}
          >
            {update.isPending ? "Guardando…" : "Guardar"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DraggableList — long-press + pan to reorder
// ─────────────────────────────────────────────────────────────────────

interface DraggableListProps {
  order: AssetId[];
  hidden: Set<AssetId>;
  defaultSend: AssetId;
  onReorder: (from: number, to: number) => void;
  onToggleHidden: (id: AssetId) => void;
}

/**
 * Lista reordenable. Para mantener el bundle lean (sin
 * `react-native-draggable-flatlist`), implementamos drag custom:
 *
 * - Long-press 220ms levanta el row activo (`activeIndex` shared value).
 * - Pan vertical mueve el row con translateY.
 * - Cada slot calcula su `displayIndex` reactiva basado en el
 *   `dragY` actual del row activo + index local. Items se acomodan con
 *   spring sin que el array se modifique hasta el release.
 * - Release commitea el reorder en JS via `runOnJS(onReorder)`.
 *
 * Trade-off: el algoritmo es O(N) por frame del drag. Para 9 assets es
 * trivial. Si en el futuro el registry crece >50, swap a la dep.
 */
function DraggableList({
  order,
  hidden,
  defaultSend,
  onReorder,
  onToggleHidden,
}: DraggableListProps) {
  const activeIndex = useSharedValue<number>(-1);
  const dragY = useSharedValue(0);

  return (
    <View style={{ minHeight: order.length * SLOT_HEIGHT }}>
      {order.map((id, index) => (
        <DraggableRow
          key={id}
          id={id}
          index={index}
          totalCount={order.length}
          isHidden={hidden.has(id)}
          isDefault={id === defaultSend}
          activeIndex={activeIndex}
          dragY={dragY}
          onReorder={onReorder}
          onToggleHidden={onToggleHidden}
        />
      ))}
    </View>
  );
}

interface DraggableRowProps {
  id: AssetId;
  index: number;
  totalCount: number;
  isHidden: boolean;
  isDefault: boolean;
  activeIndex: ReturnType<typeof useSharedValue<number>>;
  dragY: ReturnType<typeof useSharedValue<number>>;
  onReorder: (from: number, to: number) => void;
  onToggleHidden: (id: AssetId) => void;
}

function DraggableRow({
  id,
  index,
  totalCount,
  isHidden,
  isDefault,
  activeIndex,
  dragY,
  onReorder,
  onToggleHidden,
}: DraggableRowProps) {
  const { colors } = useTheme();
  const meta = getAsset(id);

  // displayIndex shifts visually based on dragY mientras hay otro row activo.
  const displayIndex = useSharedValue(index);
  // Lift state mientras este row está active (long-press disparado).
  const lifted = useSharedValue(0);

  // Reseteo cuando el index cambia (post-reorder commit).
  useEffect(() => {
    displayIndex.value = index;
  }, [index, displayIndex]);

  // Recompute displayIndex of every row durante el drag.
  useAnimatedReaction(
    () => ({ active: activeIndex.value, drag: dragY.value }),
    (curr) => {
      if (curr.active < 0) {
        // Sin drag activo: cada row vuelve a su slot natural.
        displayIndex.value = withSpring(index, {
          damping: 20,
          stiffness: 200,
          mass: 0.8,
        });
        return;
      }
      if (curr.active === index) {
        // El row activo ignora — su translation lo dicta dragY directo.
        return;
      }
      // Calcula la posición del row activo en slots.
      const activeSlot = curr.active + curr.drag / SLOT_HEIGHT;
      // Si el active "pasó" arriba de este row, este se shift abajo.
      let target = index;
      if (curr.active < index && activeSlot > index - 0.5) target = index - 1;
      else if (curr.active > index && activeSlot < index + 0.5) target = index + 1;
      displayIndex.value = withSpring(target, {
        damping: 22,
        stiffness: 220,
        mass: 0.7,
      });
    },
    [index],
  );

  const longPress = Gesture.LongPress()
    .minDuration(220)
    .onStart(() => {
      activeIndex.value = index;
      dragY.value = 0;
      lifted.value = withSpring(1, { damping: 16, stiffness: 220 });
      runOnJS(haptics.medium)();
    });

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onUpdate((e) => {
      if (activeIndex.value !== index) return;
      // Clamp dragY al rango razonable (no salir de la lista).
      const minY = -index * SLOT_HEIGHT;
      const maxY = (totalCount - 1 - index) * SLOT_HEIGHT;
      dragY.value = Math.max(minY, Math.min(maxY, e.translationY));
    })
    .onEnd(() => {
      if (activeIndex.value !== index) return;
      const slotsMoved = Math.round(dragY.value / SLOT_HEIGHT);
      const target = Math.max(0, Math.min(totalCount - 1, index + slotsMoved));
      lifted.value = withSpring(0, { damping: 18, stiffness: 220 });
      dragY.value = withTiming(0, { duration: 160 }, () => {
        activeIndex.value = -1;
      });
      if (target !== index) {
        runOnJS(onReorder)(index, target);
      }
    });

  const composed = Gesture.Simultaneous(longPress, pan);

  const animStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === index;
    const baseY = displayIndex.value * SLOT_HEIGHT;
    const translateY = isActive ? index * SLOT_HEIGHT + dragY.value : baseY;
    const scale = 1 + lifted.value * 0.02;
    const elevation = isActive ? 12 : 0;
    return {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      transform: [{ translateY }, { scale }],
      zIndex: isActive ? 100 : 1,
      shadowColor: "#000",
      shadowOpacity: 0.18 * lifted.value,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation,
    };
  });

  return (
    <Animated.View style={animStyle}>
      <Card
        variant="elevated"
        padded={false}
        radius="lg"
        style={{
          height: ROW_HEIGHT,
          marginBottom: ROW_GAP,
          opacity: isHidden ? 0.55 : 1,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            gap: 12,
          }}
        >
          <GestureDetector gesture={composed}>
            <View
              style={{
                width: 32,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={`Reordenar ${meta.name}, posición ${index + 1} de ${totalCount}`}
              accessibilityHint="Mantené presionado y arrastrá para mover"
            >
              <Ionicons name="reorder-three-outline" size={20} color={colors.text.tertiary} />
            </View>
          </GestureDetector>

          <AssetIcon asset={{ id }} size={36} />

          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {meta.name}
              </Text>
              {isDefault ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: `${colors.brand.primary}1F`,
                  }}
                >
                  <Text
                    variant="bodySmall"
                    style={{
                      fontSize: 10,
                      color: colors.brand.primary,
                      fontFamily: fonts.sansMedium,
                    }}
                  >
                    PRINCIPAL
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="bodySmall" tone="tertiary" numberOfLines={1}>
              {meta.symbol}
              {isHidden ? " · oculto" : ""}
            </Text>
          </View>

          <Toggle
            value={!isHidden}
            onValueChange={() => onToggleHidden(id)}
            size="sm"
            accessibilityLabel={`${isHidden ? "Mostrar" : "Ocultar"} ${meta.name}`}
          />
        </View>
      </Card>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

interface ReconciledPrefs {
  order: AssetId[];
  hidden: AssetId[];
  defaultSend: AssetId;
}

/**
 * Reconcilia un `AssetPrefs` server-side con el set canónico de assets
 * enabled del network. Útil cuando:
 * - El server tiene un asset que no está en el registry actual (rollback).
 * - El registry crece y el user no tiene el nuevo en su order.
 *
 * El hook `useAssetPreferences` ya hace `normalizeAssetPrefs`, esto es
 * solo el filtro adicional de "enabled en este network".
 */
function reconcileWithEnabled(prefs: AssetPrefs, enabled: Set<AssetId>): ReconciledPrefs {
  const seen = new Set<AssetId>();
  const order: AssetId[] = [];
  for (const id of prefs.asset_priority_order) {
    if (enabled.has(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of enabled) {
    if (!seen.has(id)) order.push(id);
  }
  const hidden = prefs.hidden_assets.filter((id) => enabled.has(id));
  const defaultSend: AssetId = enabled.has(prefs.default_send_asset)
    ? prefs.default_send_asset
    : (order[0] ?? DEFAULT_SEND_ASSET);
  return { order, hidden, defaultSend };
}

function arrayEq<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function setEq<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const x of b) if (!setA.has(x)) return false;
  return true;
}
