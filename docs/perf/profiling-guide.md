# Performance — profiling guide

> Source of truth para perf budget, profiling tools, optimization
> patterns. La diferencia entre "OK app" y "feels premium" es 60fps
> consistente en device baseline (Pixel 4a / iPhone 11).

---

## Perf budget

| Metric                 | Target           | Cómo medir                                                  |
| ---------------------- | ---------------- | ----------------------------------------------------------- |
| Cold start (iPhone 13) | < 1.5s           | Stopwatch desde tap del icon hasta first frame interactive. |
| Cold start (Pixel 6)   | < 2.0s           | Idem.                                                       |
| Tab switch             | < 300ms          | Tap → next tab fully rendered.                              |
| List scroll fps        | 60fps consistent | Reactotron Perf Monitor en list largas.                     |
| Animation fps          | 60fps consistent | UI thread fps en Hermes profiler.                           |
| API p99                | < 500ms          | Hono backend logs (Axiom dashboard).                        |
| Bundle size mobile     | < 8MB            | `pnpm --filter @moneto/mobile bundle:size` (export iOS).    |
| Memory peak            | < 200MB          | Xcode Instruments / Android Studio Profiler.                |
| Memory leak rate       | 0MB/min idle     | Idem (5min observation).                                    |
| Time to interactive    | < 2.5s           | Cold start + auth restore + first screen.                   |

---

## Patterns aplicados (Sprint 2)

### 1. Memoization de rows en lists

`TransactionRow` y `AssetRow` usan `React.memo` con custom equality:

```ts
export const TransactionRow = memo(TransactionRowImpl, (prev, next) => {
  return (
    prev.tx.id === next.tx.id &&
    prev.tx.status === next.tx.status &&
    prev.tx.amount === next.tx.amount &&
    prev.showDate === next.showDate &&
    prev.onPress === next.onPress
  );
});
```

**Por qué**: lista de 5 txs con parent que re-render por refresh / nav
→ sin memo, las 5 rows re-rendean. Con memo, sólo la row que cambió.

### 2. `useMemo` en derived data

`activos.tsx` filtra `assets` por `isEarning` cada render →
referencias nuevas → memoized rows pierden cache. Memoizamos:

```ts
const earning = useMemo(() => assets.filter((a) => a.isEarning), [assets]);
const holdings = useMemo(() => assets.filter((a) => !a.isEarning), [assets]);
```

Mismo pattern en `card.tsx` (filter por `t.type === "card"`) y
`AssetStrip` (sort + slice).

### 3. Deferred non-critical init

`bootObservability` mantiene **Sentry sync** (necesita capturar errors
desde mount) pero **defiere PostHog 1000ms**. Construir el cliente
PostHog cuesta ~50ms en devices baseline; analytics no es crítica para
TTI. Eventos pre-init quedan no-op vía `getPostHog() ?? null` patrón.

### 4. React Query keys + stale times factory

`apps/mobile/src/lib/query-keys.ts` + `query-stale-times.ts` —
skeleton listo para Sprint 3. Centralizar prevents duplicate fetches.

`STALE_TIMES`:

- `prices: 5s` (volatile)
- `balance: 30s` / `cardSpending: 30s`
- `txs: 1min` / `card: 1min`
- `assets: 30s` / `vaults: 5min`
- `profile: 5min` / `preferences: 10min`

### 5. Animation cleanup

`PressableScale` cancela `scale`/`opacity` shared values en unmount via
`cancelAnimation` — evita leaks cuando el componente se desmonta
mid-animation (Sprint 2.07).

---

## Profiling tools

### Hermes (default Expo SDK 50+)

Hermes está enabled por default. Verificar:

```js
console.log(typeof HermesInternal); // "object" si Hermes activo
```

Activar perf monitor: shake device → "Show Perf Monitor". Watch:

- **JS thread fps** — debe quedar 60fps. < 50fps = hay trabajo pesado
  bloqueando el thread. Profile con Hermes profiler.
- **UI thread fps** — debe quedar 60fps. Reanimated worklets corren
  acá; janks indican worklet con `runOnJS` excesivo.
- **Heap** — crece estable. Si crece monotonic → leak.

### Reactotron (development only)

```bash
brew install reactotron
```

Conectar al app via dev menu. Ver:

- **Excessive re-renders** (warnings).
- **Async storage state**.
- **Network requests log**.
- **React Query cache** (Sprint 3+).

Production builds DEBEN excluir Reactotron — `if (__DEV__) require(...)` pattern.

### Xcode Instruments (iOS)

Open Xcode → Open Developer Tool → Instruments → Time Profiler.

1. Connect device (no simulator — perf engaña).
2. Build app en Release config (no dev — Hermes vs JSC matter).
3. Record, navegar el flow crítico (cold start, send flow), stop.
4. Analyze hot paths. Foco: anything > 16ms en main thread = jank.

Otros instruments útiles:

- **Allocations** — detecta leaks.
- **Animation Hitches** — flags concretos por dropped frame.

### Android Studio Profiler

Open Android Studio → Profiler → Connect device + select process.

- **CPU Profiler** — record 30s scroll de list, ver hot paths.
- **Memory Profiler** — heap dump pre/post navegación, diff.
- **Energy Profiler** — useful para detectar sensores activos en idle.

### Bundle inspection

```bash
# Export bundle iOS y ver size
pnpm --filter @moneto/mobile bundle:size

# Detail breakdown por module (cuando esté wired)
# pnpm --filter @moneto/mobile exec npx react-native-bundle-visualizer
```

Target: **< 8MB total**.

Top suspects históricos:

- `@solana/web3.js` ~2MB → considerar `@solana/web3.js@2` (smaller).
- Imágenes PNG no comprimidas → `imagemin` pre-build.
- Lodash full → `lodash/<fn>` específico imports.

---

## Optimization patterns (cuando profiler indique)

### 1. Avoid setState during render

Worklet `runOnJS` excesivo causa janks porque cruza el bridge JS
thread. Usar `useSharedValue` + `useDerivedValue` cuando sea posible.

### 2. List virtualization

Para listas > 20 items, usar `@shopify/flash-list`:

```bash
pnpm --filter @moneto/mobile add @shopify/flash-list
```

Patrón:

```tsx
<FlashList
  data={transactions}
  estimatedItemSize={80}
  keyExtractor={(tx) => tx.id}
  renderItem={({ item }) => <TransactionRow tx={item} />}
  ItemSeparatorComponent={() => <Divider />}
  drawDistance={400}
  removeClippedSubviews
/>
```

**Sprint 2**: NO instalado todavía — current lists < 10 items, no
amortiza la dep. Sprint 4 transactions full screen lo justificará.

### 3. Image optimization

Para avatars / asset logos remotos, `expo-image` (no `Image`):

```tsx
import { Image } from "expo-image";

<Image
  source={{ uri: avatarUrl }}
  placeholder={{ blurhash }}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk"
  recyclingKey={user.id}
/>;
```

**Sprint 2**: no remote images yet (Avatar es initials-only). Sprint 5
cuando hayan asset logos remotos.

### 4. Network batching

```ts
// ❌ BAD: waterfall
const balance = await fetchBalance();
const txs = await fetchTxs();

// ✅ GOOD: parallel
const [balance, txs] = await Promise.all([fetchBalance(), fetchTxs()]);
```

Aplicado en `useDashboardData.refresh()` (Sprint 2.02 + Sprint 3 cuando
queries reales).

### 5. Cleanup memory

Para cualquier `useEffect` con subscription / timer / animation:

```ts
useEffect(() => {
  const sub = supabase.channel("balance").subscribe(...);
  return () => sub.unsubscribe();
}, []);
```

`PressableScale` ya hace cleanup; `useCardPanReveal` también
(timer + screenshot listener); `useThemePreferenceSync` también
(AbortController).

---

## Smoke checklist (post `eas build`)

- [ ] Cold start medido: stopwatch desde tap → balance hero visible.
      iPhone 13: target < 1.5s. Pixel 6: < 2s.
- [ ] Tab switch: tap → next tab balance visible < 300ms perceived.
- [ ] Pull-to-refresh: spinner aparece inmediato, smooth release.
- [ ] Asset strip horizontal scroll: 60fps (Reactotron Perf Monitor).
- [ ] Balance toggle on/off: instant respuesta, sin lag.
- [ ] Settings rows scroll: 60fps.
- [ ] Memory después 10min navegación intensa: < 200MB peak, no
      monotonic growth.
- [ ] Bundle size: `pnpm bundle:size` < 8MB.

---

## Sentry performance monitoring

Sprint 0/1 wireó `Sentry.init` con tracing. Las routes son
auto-instrumentadas vía `@sentry/react-native` integration. Ver
dashboard Sentry → Performance:

- p50 / p95 / p99 por route.
- Slow transactions identificadas.
- Custom metrics: `dashboard_refresh` duration.

Si una route excede su budget, Sentry alertará (configurar threshold
post-Sprint 8).

---

## Lo que NO está cubierto en Sprint 2

- **FlashList** — install + apply en Sprint 4 con transactions full screen.
- **expo-image** — install + apply en Sprint 5 con remote asset logos.
- **Reactotron config** — Sprint 8 cuando el equipo lo necesite.
- **React Compiler** — Sprint 8 cuando SDK lo soporte estable.
- **Detox perf tests automatizados** — Sprint 8.
- **Cold start measurements documentados** — manual smoke por device.

---

## Quality bar por screen nueva (DOD)

- [ ] Heavy lists (>20 items) usan FlashList.
- [ ] Rows en lists usan `React.memo` con custom equality.
- [ ] `useMemo` en derived data que se passa a memoized rows.
- [ ] `useCallback` en handlers passed children que son memoized.
- [ ] React Query staleTime configurado por data type (Sprint 3+).
- [ ] `useEffect` cleanups verificados (subs, timers, animations).
- [ ] No `console.log` en render path (uses `createLogger` que es a level-gated).
- [ ] Imágenes via `expo-image` con `cachePolicy: "memory-disk"`.
- [ ] No anonymous functions inline en `renderItem` (recreates por scroll).
