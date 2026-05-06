import { Ionicons } from "@expo/vector-icons";
import { EmptyState, ErrorState, Screen, Text, haptics, useTheme } from "@moneto/ui";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, Pressable, RefreshControl, View } from "react-native";

import { TransactionRow } from "@components/features/TransactionRow";
import { Skeleton } from "@components/Skeleton";
import { adaptDecryptedTx, useTxHistory, type DecryptedTx } from "@hooks/useTxHistory";

const ROW_HEIGHT = 72;

/**
 * Transactions list — Sprint 4.07.
 *
 * Diseño (design.txt + colors.txt + mobile-design.txt):
 * - Header con back button + título "Movimientos" + (futuro Sprint 4.09)
 *   search/filter chip.
 * - FlashList virtualization para 1000+ items sin lag.
 * - Pull-to-refresh con haptic success al complete.
 * - Loading: skeleton rows (cinco) por consistencia con Saldo.
 * - Empty: copy honesto "Aún no tenés movimientos · Pedí tu primer
 *   pago compartiendo tu link".
 * - Error: ErrorState con CTA reintentar.
 *
 * **Sprint 4.09** agrega header search/filter (input arriba + chips
 * por type). Por ahora el render es lineal sin filtros.
 */
export default function TransactionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const query = useTxHistory();

  const items = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const all: DecryptedTx[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
      for (const tx of page.items) {
        // Dedupe por signature — pagination overlap se maneja transparente.
        if (seen.has(tx.id)) continue;
        seen.add(tx.id);
        all.push(tx);
      }
    }
    return all;
  }, [query.data]);

  const handleRefresh = useCallback(async () => {
    haptics.tap();
    await query.refetch();
    haptics.success();
  }, [query]);

  const handleEndReached = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  const handleBack = useCallback(() => {
    haptics.tap();
    router.back();
  }, [router]);

  const renderItem = useCallback(({ item }: { item: DecryptedTx }) => {
    return <TransactionRow tx={adaptDecryptedTx(item)} onPress={() => haptics.tap()} />;
  }, []);

  const keyExtractor = useCallback((item: DecryptedTx) => item.id, []);

  return (
    <Screen padded={false} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 12,
          gap: 8,
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
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text variant="h3">Movimientos</Text>
          {query.isFetching && !query.isPending ? (
            <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 2 }}>
              Actualizando…
            </Text>
          ) : null}
        </View>
        {/* Reservado para Sprint 4.09 — search/filter button. */}
        <View style={{ width: 24 }} />
      </View>

      <View style={{ flex: 1 }}>
        {query.isPending ? (
          <LoadingSkeleton />
        ) : query.isError ? (
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <ErrorState
              title="No pudimos cargar tu historial"
              description="Verificá tu conexión y volvé a intentar."
              onRetry={() => void query.refetch()}
            />
          </View>
        ) : items.length === 0 ? (
          <View style={{ paddingHorizontal: 16, marginTop: 32 }}>
            <EmptyState
              icon="receipt-outline"
              title="Aún no tenés movimientos"
              description="Cuando recibas o envíes plata, va a aparecer acá ordenado por fecha."
              cta={{
                label: "Pedir un pago",
                leftIcon: "share-outline",
                onPress: () => {
                  haptics.tap();
                  router.push("/receive");
                },
              }}
            />
          </View>
        ) : (
          <FlashList<DecryptedTx>
            data={items}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            estimatedItemSize={ROW_HEIGHT}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={query.isRefetching && !query.isFetchingNextPage}
                onRefresh={handleRefresh}
                tintColor={colors.brand.primary}
                colors={[colors.brand.primary]}
                progressBackgroundColor={colors.bg.elevated}
              />
            }
            ListFooterComponent={
              query.isFetchingNextPage ? (
                <View style={{ paddingVertical: 24, alignItems: "center" }}>
                  <ActivityIndicator color={colors.brand.primary} />
                </View>
              ) : !query.hasNextPage && items.length > 5 ? (
                <View style={{ paddingVertical: 32, alignItems: "center" }}>
                  <Text variant="bodySmall" tone="tertiary">
                    Llegaste al inicio
                  </Text>
                </View>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>
    </Screen>
  );
}

function LoadingSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, gap: 12, paddingTop: 8 }}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={12} />
          </View>
          <Skeleton width={70} height={16} />
        </View>
      ))}
    </View>
  );
}
