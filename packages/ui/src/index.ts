/**
 * @moneto/ui — design system components.
 *
 * Cross-platform (React Native) primitives. Theming via `<ThemeProvider>` +
 * `useTheme()`. Haptics via `useHaptics()` o `haptics` namespace.
 *
 * Quality bar (sprint 0.02):
 * - `forwardRef` donde el componente es composable.
 * - `displayName` siempre — útil para devtools.
 * - JSDoc con `@example` siempre — el "test de los 6 segundos".
 * - `testID` prop en componentes interactivos — para Maestro/Detox.
 * - `accessibilityRole`/`accessibilityLabel` siempre que aplica.
 * - Cero colors hardcoded — todo via `useTheme()` o tokens del theme.
 *
 * Sprint 2 amplía esto con: AnimatedTabIcon, Skeleton, EmptyState, ErrorState,
 * ErrorBoundary, AnimatedNumber, BottomSheet.
 */

// Providers + hooks
export { ThemeProvider, ThemeContext, type ThemeContextValue } from "./providers/ThemeProvider";
export { useTheme } from "./hooks/useTheme";
export { useHaptics, haptics, type HapticPattern } from "./hooks/useHaptics";

// Primitives
export { PressableScale, type PressableScaleProps } from "./components/PressableScale";

// Display
export { Text, type TextProps, type TextVariant, type TextTone } from "./components/Text";
export { Avatar, type AvatarProps, type AvatarSize, type AvatarTone } from "./components/Avatar";
export { Badge, type BadgeProps, type BadgeTone, type BadgeSize } from "./components/Badge";
export { Logo, type LogoProps, type LogoVariant, type LogoTone } from "./components/Logo";
export {
  AmountDisplay,
  type AmountDisplayProps,
  type AmountSize,
  type AmountCurrency,
} from "./components/AmountDisplay";

// Layout
export { Screen, type ScreenProps, type ScreenBg } from "./components/Screen";
export { Card, type CardProps, type CardVariant } from "./components/Card";
export { Divider, type DividerProps } from "./components/Divider";
export {
  ScreenHeader,
  type ScreenHeaderProps,
  SectionHeader,
  type SectionHeaderProps,
} from "./components/ScreenHeader";
export { ListItem, type ListItemProps } from "./components/ListItem";

// Forms
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./components/Button";
export {
  IconButton,
  type IconButtonProps,
  type IconButtonVariant,
  type IconButtonSize,
} from "./components/IconButton";
export {
  Input,
  ClearButton,
  type InputProps,
  type InputVariant,
  type InputSize,
} from "./components/Input";
export { Toggle, type ToggleProps, type ToggleSize } from "./components/Toggle";
