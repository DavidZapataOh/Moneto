import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Altura total que el tab bar ocupa (contenido + home indicator inset).
 * Los screens usan este valor + respiro para que su último elemento no quede tapado.
 */
const TAB_BAR_CONTENT_HEIGHT = 54;

export function useTabBarSpace(extra = 24) {
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom > 0 ? insets.bottom : 12;
  return TAB_BAR_CONTENT_HEIGHT + bottomPad + extra;
}
