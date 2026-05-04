# @moneto/ui

Design system component library. React Native primitives + cross-compatible architecture.

## Architecture

- **`<ThemeProvider mode>`** — wrap your app root. Receives the resolved theme mode from your app's preference store + OS scheme.
- **`useTheme()`** — reads `{ mode, colors, isDark }` from context.
- **`useHaptics()` / `haptics`** — centralized haptic feedback.

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

## Components

Layout: `Screen`, `Card`, `Divider`, `ScreenHeader`, `SectionHeader`
Forms: `Button`, `IconButton`
Display: `Text`, `Avatar`, `Badge`, `Logo`, `AmountDisplay`, `ListItem`

Sprint 2 expands with: `AnimatedTabIcon`, `Skeleton`, `EmptyState`, `ErrorState`,
`ErrorBoundary`, `PressableScale`, `AnimatedNumber`.

## Conventions

- Every component is `forwardRef` where it could be composed.
- Every interactive component accepts `testID` prop for E2E.
- Every variant/size is exported as a type for downstream composition.
- No hardcoded colors — all via `useTheme()`.
