# @moneto/theme

Design tokens for Moneto. Pure data, no React or platform deps — safe to import from any surface (mobile, web, server).

## Tokens

- **`palette`** — base color scales (ink, cream, terracota, clay, stone, semantic).
- **`darkTheme` / `lightTheme`** — semantic mappings consumed by `useTheme()` in the mobile app.
- **`type`** — typography styles (Fraunces display, Inter UI, JetBrains Mono for amounts).
- **`fonts`** — font family identifiers (`@expo-google-fonts/*`).
- **`space`, `radius`, `hitSlop`** — spacing, border-radius, and tap-target presets.

## Rules

1. **Terracota is the only saturated color in the system.** Everything else is warm-neutral.
2. **JetBrains Mono never leaves amount/numeric use.** Headlines use Fraunces; UI uses Inter.
3. **No black `#000` or white `#FFF`.** Always warm tones (`palette.ink.900`, `palette.cream.50`).
4. **8-pt grid via `space.*` tokens.** Custom values are a smell — extend the scale instead.

## Usage

```typescript
import { darkTheme, type, space } from "@moneto/theme";

const styles = {
  container: { backgroundColor: darkTheme.bg.primary, padding: space[4] },
  title: { ...type.heroDisplay, color: darkTheme.text.primary },
};
```
