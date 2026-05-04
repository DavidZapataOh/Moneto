/**
 * @moneto/ui — design system components.
 *
 * All components are React Native primitives + cross-compatible.
 * Theming via <ThemeProvider> + useTheme(). Haptics via useHaptics().
 *
 * Sprint 2 expands this with: AnimatedTabIcon, Skeleton, EmptyState,
 * ErrorState, ErrorBoundary, PressableScale, AnimatedNumber.
 */

// Providers + hooks
export { ThemeProvider, ThemeContext, type ThemeContextValue } from "./providers/ThemeProvider";
export { useTheme } from "./hooks/useTheme";
export { useHaptics, haptics } from "./hooks/useHaptics";

// Components
export { Text } from "./components/Text";
export { Button } from "./components/Button";
export { Card } from "./components/Card";
export { Avatar } from "./components/Avatar";
export { Badge } from "./components/Badge";
export { Logo } from "./components/Logo";
export { Screen } from "./components/Screen";
export { ScreenHeader, SectionHeader } from "./components/ScreenHeader";
export { Divider } from "./components/Divider";
export { IconButton } from "./components/IconButton";
export { ListItem } from "./components/ListItem";
export { AmountDisplay } from "./components/AmountDisplay";
