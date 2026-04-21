import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Altura del contenido del tab bar (sin home indicator).
 * - iOS 56pt: alineado con fintech apps top (Revolut, Nubank, Robinhood).
 *   Apple UIKit default es 49pt — subimos 7pt para que el label con fontSize 11 respire.
 * - Android 64dp: Material 3 Expressive default (reducido desde 80dp original).
 *
 * Insets.bottom (manejado por el sistema):
 * - iPhone notched/Dynamic Island: 34pt
 * - iPhone SE / iPhones con home button: 0pt
 * - iPad con home indicator: 20pt · iPad home button: 0pt
 * - Android gesture nav: ~24dp · 3 botones: ~48dp · ninguna: 0
 *
 * Cuando insets.bottom === 0 (dispositivos flat-bottom), damos 8pt de respiro
 * visual para que el tab bar no pegue al borde físico.
 */
export const TAB_BAR_CONTENT_HEIGHT = Platform.select({
  ios: 56,
  android: 64,
  default: 56,
})!;

export const TAB_BAR_FALLBACK_PAD = 8;

export function useTabBarSpace(extra = 24) {
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom > 0 ? insets.bottom : TAB_BAR_FALLBACK_PAD;
  return TAB_BAR_CONTENT_HEIGHT + bottomPad + extra;
}

export function useTabBarBottomPad() {
  const insets = useSafeAreaInsets();
  return insets.bottom > 0 ? insets.bottom : TAB_BAR_FALLBACK_PAD;
}
