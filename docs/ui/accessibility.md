# Accessibility (a11y)

> Source of truth para a11y conventions de Moneto. Aplica a `apps/mobile`
> hoy + cualquier `apps/*` futuro consumidor de `@moneto/ui`. WCAG 2.1
> AA es el mínimo non-negotiable.

---

## Principios

1. **a11y desde día 1, no remediation post-launch.** Cada componente
   nace con role + label + state. Retrofit cuesta 5× más y queda mal.
2. **Color is never the only signal.** Estados se acompañan SIEMPRE de
   icon + text + color. Colorblind users (8% de hombres, 0.5% mujeres)
   no se enteran de un dot rojo aislado.
3. **Touch targets ≥ 44pt iOS / 48dp Android.** Si algo es más chico,
   `hitSlop` lo extiende — siempre.
4. **Screen reader speaks español.** VoiceOver/TalkBack están en
   español del device — toda label en español, amounts humanizados.
5. **Reduced motion = OS manda.** `useReducedMotion()` reduce las
   entrance animations a 0ms (ver `docs/ui/motion-and-haptics.md`).

---

## Contrast (WCAG 2.1 AA)

### Ratios mínimos

| Texto                                   | AA        | AAA (aspirational) |
| --------------------------------------- | --------- | ------------------ |
| Normal (<18pt regular o <14pt bold)     | **4.5:1** | 7:1                |
| Large (≥18pt regular o ≥14pt bold)      | **3:1**   | 4.5:1              |
| UI elements + non-text (icons, borders) | 3:1       | —                  |

### Verificación

Toda combinación crítica del theme está cubierta por
`packages/theme/scripts/contrast-check.ts`. Run:

```bash
pnpm --filter @moneto/theme contrast
```

Output: ratio + verdict por combinación, exit 1 si falla. Ejecutar
después de tocar `colors.ts`. Sprint 8 lo promueve a Jest test en CI.

### Fix history

- 2026-05-04: el `palette.success.base` y `palette.warning.base` no
  alcanzaban AA contra `cream[50]` (4.40:1, 2.85:1). Agregué `.dark`
  variants exclusivamente para light theme. `palette.danger.base`
  pasaba (6.30:1) pero también pase a `.dark` por consistencia.

---

## Component conventions

### Button / Pressable

```tsx
<Button
  label="Continuar con Face ID"
  onPress={...}
  // accessibilityLabel deriva del label automáticamente.
  // accessibilityRole="button" automático.
  // accessibilityState={{ disabled, busy: loading }} automático.
  // hitSlop suficiente para llegar a 44pt si el size es < 44.
/>

// Para Pressables custom:
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Cerrar sesión"
  accessibilityHint="Doble tap para cerrar tu sesión"
  hitSlop={8}
/>
```

### Toggle (Switch)

```tsx
<Toggle
  value={frozen}
  onValueChange={setFrozen}
  accessibilityLabel="Congelar tarjeta"
  // accessibilityRole="switch" automático
  // accessibilityState.checked = value automático
/>
```

### Avatar

`Avatar` en Moneto es initials-only (no photo URLs). El componente
genera `accessibilityLabel` por defecto a partir del nombre — los
callers raramente lo override.

### Input

```tsx
<Input
  label="Monto en USD"
  hint="Ingresá el monto que querés enviar"
  keyboardType="decimal-pad" // optimizes screen reader announcement
  // accessibilityLabel deriva del label
  // accessibilityHint deriva del hint
/>
```

### Balance / Amount displays

VoiceOver lee "$1,234.56" como "uno coma dos tres cuatro punto cinco
seis" — desastre. Solución: `formatAmountForA11y()` de `@moneto/utils`.

```tsx
import { formatAmountForA11y } from "@moneto/utils";

<View
  accessible
  accessibilityRole="header"
  accessibilityLabel={
    hidden ? "Saldo total oculto" : `Saldo total, ${formatAmountForA11y(balance, "USD")}`
  }
>
  <Text>${visualFormatted}</Text>
</View>;
```

Producción: `formatAmountForA11y(1234.56)` →
`"mil doscientos treinta y cuatro dólares con cincuenta y seis centavos"`.
Soporta hasta 999.999.999 — más allá retorna fallback numérico.

### Lists (TransactionRow, AssetRow)

Cada row del feed compone su `accessibilityLabel` humanizado:

- TransactionRow: `"Recibiste tres mil dólares de Acme Inc., hace 1 día"`
- AssetRow: `"Bitcoin, 0.042 BTC, mil quinientos doce dólares, subió 3.2% hoy"`

`accessibilityHint`: `"Tocar para ver detalles"`.

### Skeleton

`<Skeleton>` ya trae:

- `accessible: true`
- `accessibilityLabel: "Cargando"`
- `accessibilityState: { busy: true }`
- `accessibilityLiveRegion: "polite"` (screen reader anuncia una vez,
  no spammea).

### Modal screens

`Screen isModal` activa `accessibilityViewIsModal` → VoiceOver/TalkBack
lock-ean el focus dentro del modal, no permiten navigate al fondo.
Aplicado a: `appearance`, `kyc`, `asset-priorities`, `receive`, `send`,
`send-success`, `swap`, `privacy`.

### Tab change announcement

`(tabs)/_layout.tsx > onTabPress` llama
`AccessibilityInfo.announceForAccessibility("${TAB_LABEL[next]}, pestaña seleccionada")`
porque TalkBack (Android) no anuncia cambios de tab consistentemente.

---

## Dynamic Type

iOS: `Settings → Accessibility → Display & Text Size → Larger Text`.
Android: `Settings → Display → Font size`.

Tests must pass at **200%**:

- Layouts no se rompen: usar flex, `minHeight` no `height`.
- Buttons crecen vertical, nunca truncan label.
- Long text wrappea o se permite scroll.
- Mono numbers (balance hero) usan `allowFontScaling={false}` por
  diseño — el 48pt mono se rompería en layouts si crece a 200%. El
  trade-off: VoiceOver compensa con la `accessibilityLabel` humanizada
  - el user con vision baja puede usar Zoom (separate accessibility
    feature).

---

## Reduced motion

Cubierto en `docs/ui/motion-and-haptics.md`. TLDR:

- `useEntrances()` retorna duration 0 cuando `useReducedMotion()` true.
- `useMotionConfig().duration(ms)` retorna 0 cuando reduced.
- Spring presses (PressableScale) siguen activos — son contextual
  feedback, no entrance choreography.

---

## Smoke testing

### iOS

1. **Xcode Accessibility Inspector** (Xcode → Open Developer Tool →
   Accessibility Inspector):
   - Audit cada screen.
   - Check labels, hints, traits.
   - Navigate via VoiceOver simulation.

2. **Simulator → Settings → Accessibility**:
   - VoiceOver ON: navegar via swipe gestures.
   - Larger Text → max 200%.
   - Reduce Motion ON.
   - Increase Contrast ON.

3. **Real device** (mandatory antes de demo):
   - VoiceOver navigation completa.
   - Voice Control: "Tocar Enviar", "Tocar pestaña Tarjeta".
   - Switch Control simulation.

### Android

1. **Accessibility Scanner** app (Play Store) → run en cada screen,
   detect contrast/touch target/missing labels.
2. **TalkBack**: Settings → Accessibility → TalkBack ON.
3. Bold Text + Font size: Largest.

### Smoke checklist por screen

#### Saldo

- [ ] Avatar → "MJ, brand background" o similar.
- [ ] Top bar buttons → "Escanear QR, botón", "Notificaciones, botón"
      (con badge count si > 0).
- [ ] Balance hero → header role + saldo humanizado o "Saldo oculto".
- [ ] Quick Actions → cada button con label + hint claro.
- [ ] Asset chips → "USD, ocho mil doscientos cuarenta dólares".
- [ ] Transaction rows → full description per row.

#### Tarjeta

- [ ] Card visual → "Tu tarjeta Visa, terminada en 4829".
- [ ] Card frozen state respetado en label.
- [ ] Settings toggles → checked state announced.
- [ ] PAN reveal → biometric prompt habla, NO leakea PAN tras reveal.

#### Activos

- [ ] Patrimony total → header role.
- [ ] Section headers anunciados como heading.
- [ ] Asset rows → full description (asset, balance, change/APY).
- [ ] Donut chart → leyenda anunciable; future: alt text "Distribución:
      Reflect 62%, Huma 28%, Kamino 10%".

#### Yo

- [ ] Profile hero → name + KYC status anunciado.
- [ ] Section headers como heading.
- [ ] Setting rows → label + value + hint chevron.
- [ ] Logout → destructive action announced.

---

## Quality bar (Definition of Done por screen nueva)

- [ ] Cada interactive element tiene `accessibilityRole` + `accessibilityLabel`.
- [ ] `hitSlop` adecuado en cualquier tap-target < 44pt.
- [ ] Estado (success/warning/danger) usa icon + text, no solo color.
- [ ] Amounts wrapped con `formatAmountForA11y` en label.
- [ ] Modal screens usan `<Screen isModal>`.
- [ ] Dynamic Type 200% no rompe layout.
- [ ] Reduce Motion respetado (via `useEntrances`).
- [ ] Increase Contrast — UI sigue funcional.
- [ ] Theme contrast tests passing (`pnpm --filter @moneto/theme contrast`).
- [ ] VoiceOver flow completo testeado en device.
- [ ] TalkBack flow completo testeado en device.

---

## Lo que NO está cubierto (Sprint 8 final audit)

- **Voice Control real-device test**: requiere device con setup.
- **Switch Control simulation**: idem.
- **Lighthouse audit web**: cuando exista `apps/web` (Sprint 8).
- **Automated CI tests** para a11y: contrast script promovido a Jest
  test (Sprint 8). Eslint plugin `react-native-a11y` opcional.
- **Color blindness simulation**: Daltonism filters (deuteranopia,
  protanopia) no testeados.
- **Cognitive load audit**: copy review con un copywriter dedicado
  para verificar tone, language complexity (Sprint 8).
