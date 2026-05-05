import { useEffect, useRef, useState } from "react";

/**
 * Mantiene `loading=true` por al menos `minMs` después de que la fuente
 * (`isPending`) lo haya activado, para evitar flicker cuando los datos
 * llegan ultra-rápido (e.g., cache hit de React Query con staleTime fresco).
 *
 * **Por qué importa**: skeletons que duran <100ms se sienten como un bug
 * (algo flashea). El user no sabe leer ese frame; solo recibe noise visual.
 * Linear y Vercel doc: 300ms es el sweet spot — el cerebro registra el
 * skeleton como un beat de "estamos cargando" deliberado.
 *
 * Comportamiento:
 * - `isPending: false → true`: el hook expone `true` inmediato.
 * - `isPending: true → false`: si pasaron <minMs desde el último flip a true,
 *   el hook mantiene `true` hasta cumplir el minMs.
 *
 * @example
 *   const { isPending } = useQuery(...);
 *   const showSkeleton = useDeferredLoading(isPending);
 *   return showSkeleton ? <Skeleton /> : <Content />;
 */
export function useDeferredLoading(isPending: boolean, minMs: number = 300): boolean {
  const [deferred, setDeferred] = useState(isPending);
  const startedAt = useRef<number | null>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPending) {
      // Empieza el run de loading. Cancela cualquier release pending.
      if (releaseTimer.current) {
        clearTimeout(releaseTimer.current);
        releaseTimer.current = null;
      }
      if (startedAt.current === null) {
        startedAt.current = Date.now();
      }
      setDeferred(true);
      return;
    }

    // isPending = false: si nunca corrió un loading, refleja immediate.
    if (startedAt.current === null) {
      setDeferred(false);
      return;
    }

    const elapsed = Date.now() - startedAt.current;
    if (elapsed >= minMs) {
      startedAt.current = null;
      setDeferred(false);
      return;
    }

    // Esperamos el tiempo restante antes de soltar el loading.
    const remaining = minMs - elapsed;
    releaseTimer.current = setTimeout(() => {
      startedAt.current = null;
      releaseTimer.current = null;
      setDeferred(false);
    }, remaining);

    return () => {
      if (releaseTimer.current) {
        clearTimeout(releaseTimer.current);
        releaseTimer.current = null;
      }
    };
  }, [isPending, minMs]);

  return deferred;
}
