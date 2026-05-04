# @moneto/ui

Design system component library. React Native primitives, cross-compatible
arquitectura, theme-aware via context.

## Arquitectura

- **`<ThemeProvider mode>`** — wrap el root del app. Recibe el `mode`
  resuelto desde el store del app + OS scheme. Decoupled del state
  management de cualquier app específica.
- **`useTheme()`** — lee `{ mode, colors, isDark }` desde el contexto.
- **`useHaptics()` / `haptics`** — feedback haptic centralizado.

```tsx
import { ThemeProvider, useTheme, Button, Card, Text } from "@moneto/ui";
import { useColorScheme } from "react-native";

function App() {
  const scheme = useColorScheme();
  const mode = scheme === "light" ? "light" : "dark";

  return (
    <ThemeProvider mode={mode}>
      <YourApp />
    </ThemeProvider>
  );
}
```

## Componentes

| Categoría  | Componentes                                                              |
| ---------- | ------------------------------------------------------------------------ |
| Primitives | `PressableScale`                                                         |
| Display    | `Text`, `Avatar`, `Badge`, `Logo`, `AmountDisplay`                       |
| Layout     | `Screen`, `Card`, `Divider`, `ScreenHeader`, `SectionHeader`, `ListItem` |
| Forms      | `Button`, `IconButton`, `Input` (+ `ClearButton`), `Toggle`              |

Sprint 2 amplía con: `AnimatedTabIcon`, `Skeleton`, `EmptyState`,
`ErrorState`, `ErrorBoundary`, `AnimatedNumber`, `BottomSheet`,
`AmountInput` (hero variant para Send/Swap).

## Convenciones (quality bar Sprint 0.02)

- **`forwardRef`** donde el componente es composable.
- **`displayName`** siempre — útil para devtools / error boundaries.
- **`testID`** prop en componentes interactivos — para Maestro/Detox.
- **JSDoc con `@example`** en cada componente — el "test de los 6 segundos".
- **Variants y sizes exportados como types** — para composición downstream.
- **Cero colors hardcoded** — todo via `useTheme()` o tokens del theme.
- **a11y**: `accessibilityRole` + `accessibilityLabel` cuando aplica;
  touch targets ≥44pt vía `hitSlop` cuando el visual es menor.

## Anti-patterns (no hacer)

- ❌ Hardcodear colores `#FFF` o `rgba(...)` literales — agregar al theme.
- ❌ Importar `react-native` directamente en apps para wrapping styling
  custom — crear un primitive nuevo en este package.
- ❌ Inline animations sin `react-native-reanimated`.
- ❌ Componentes con N booleanos (`isLoading + isDisabled + isCompact`)
  cuando un `variant` o `size` enum lo expresa mejor.

## Theme tokens consumidos

```ts
import {
  // colors
  palette,
  lightTheme,
  darkTheme,
  type ThemeColors,
  type ThemeMode,
  // typography
  fonts,
  type, // (variant map: heroDisplay, body, balanceHero, etc.)
  // layout
  space,
  hitSlop,
  radius,
  // motion
  durations,
  easings,
  springs,
  // elevation
  shadows,
  getShadow,
} from "@moneto/theme";
```

## Brand asset

`packages/ui/assets/images/moneto-logo.png` se bundlea con el package.
Apps no necesitan duplicarlo. Si una app quiere co-branding, pasar
`<Logo source={customAsset} />`.
