import { Skeleton } from "@moneto/ui";
import { View } from "react-native";

/**
 * Composiciones específicas de Moneto para skeletons. El primitivo
 * `Skeleton` vive en `@moneto/ui` (cross-app); las composiciones acá
 * son matchers de los componentes concretos de mobile (BalanceHero,
 * TransactionRow) y por eso se mantienen al lado de la app.
 *
 * Re-exportamos `Skeleton` para que los call-sites antiguos sigan
 * compilando sin tocar imports.
 */

export { Skeleton };

/**
 * Esqueleto del Balance hero. Match las dimensiones del `BalanceHero`
 * real (eyebrow line + 48pt mono number + yield line) para zero layout
 * shift al transición a `ready`.
 */
export function BalanceSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <Skeleton width={80} height={12} radius={4} />
      <Skeleton width={220} height={52} radius={6} />
      <Skeleton width={180} height={14} radius={4} />
    </View>
  );
}

/**
 * Esqueleto de una row de transaction. Match `TransactionRow` real:
 * 48×48 icon circle + título + subtítulo + amount derecho.
 */
export function TxRowSkeleton() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 12,
      }}
    >
      <Skeleton width={48} height={48} radius={24} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width={"60%"} height={14} radius={4} />
        <Skeleton width={"40%"} height={12} radius={4} />
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Skeleton width={72} height={14} radius={4} />
        <Skeleton width={48} height={10} radius={4} />
      </View>
    </View>
  );
}
