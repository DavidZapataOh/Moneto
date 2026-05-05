import { useEffect, useState } from "react";

/**
 * Debouncer genérico — retorna `value` después de `delayMs` sin
 * cambios. Útil para inputs que disparan queries (swap amount,
 * search box) — evita spamear la API mientras el user tipea.
 *
 * @example
 *   const [amount, setAmount] = useState("");
 *   const debounced = useDebouncedValue(amount, 300);
 *   const { data } = useQuery({ queryKey: ["quote", debounced], ... });
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
