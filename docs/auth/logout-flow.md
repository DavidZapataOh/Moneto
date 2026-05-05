# Logout flow — zero-residual cleanup

> Cómo cerramos sesión en Moneto mobile. Source of truth para el threat
> model, el orden de stages y los gotchas de device sharing.
>
> Implementación: `apps/mobile/src/lib/auth.ts > performLogoutCleanup`,
> `apps/mobile/src/hooks/useLogout.ts`. Ver también el plan original en
> `plans/sprint-1-auth-wallet/06-logout-cleanup.md`.

---

## Threat model

**Escenario crítico**: device sharing.

> User A loguea en device → User A logout → User B loguea en mismo
> device → User B NO debe ver datos residuales de User A.

Particularmente relevante para el target market LATAM:

- **Familia compartida**: hermanos/parejas que usan el mismo iPhone viejo.
- **Demos**: founder muestra la app a un investor / partner; el demo
  user logout debe dejar el device limpio para el siguiente.
- **Robo de device desbloqueado**: ladrón con device unlocked NO debe
  ver últimos balances/txs cacheados aunque el user no haya logout.

**Lo que un leak comprometería**:

- Balance USD del user previo (privacy core de la value prop).
- Cache de viewing keys (revela qué selective disclosure tenía activo).
- Profile data (handle, country, KYC level).
- Theme preference cruzado (UX bug, no privacy, pero jarring).
- Supabase queries servidas con token viejo (worst case → row-level data del A).

---

## Arquitectura

```
                 user tap "Cerrar sesión"
                          │
                          ▼
              Alert.alert confirmación
                          │ (destructive style)
                          ▼
              useLogout().logout()           ◀──── (también) useAutoLogoutOnExpired
                          │                                       cuando authState → "expired"
                          ▼
            performLogoutCleanup({ privyLogout })
                          │
   ┌──────────────────────┼──────────────────────┐
   │                      │                      │
   ▼                      ▼                      ▼
[1 privy]            [2 stores]            [3 asyncstorage]
  ↓ try/catch          ↓ try/catch           ↓ try/catch
  privyLogout()        useAppStore.reset     scan moneto.* keys
                       useThemeStore         multiRemove
                          │
   ┌──────────────────────┼──────────────────────┐
   ▼                                              ▼
[4 singletons]                              [5 analytics]
  ↓ try/catch                                 ↓ try/catch
  resetApiClient                              resetUser()
  resetSupabaseClient                           ↓
                                              posthog.reset
                                              Sentry.setUser(null)
                          │
                          ▼
              return { ok, failedAt, durationMs, completedStages }
                          │
                          ▼
              router.replace("/(onboarding)")
                          │
                          ▼
              welcome screen renderea limpio
```

---

## Stages

Cada stage es independiente. Una falla NO aborta el resto — preferimos
cleanup parcial a quedar logueado.

### 1. Privy

`privyLogout()` (inyectado por el `useLogout` hook que tiene contexto
React). Revoca el token server-side.

**Fallas esperables**: token ya expirado → Privy responde 401. Es
benign (el server ya no tiene la sesión); seguimos con el cleanup local.

### 2. Stores (Zustand)

- `useAppStore.getState().reset()` → todo a `INITIAL_STATE`, **preserva
  `hasCompletedOnboarding`** (el user ya vió el intro, mostrárselo otra
  vez es UX pésimo).
- `useThemeStore.setState({...})` → `preference: "system"`,
  `syncedToRemote: false`, `lastSyncAt: null`. La preferencia visual se
  resetea para que el próximo user vea el default y elija la suya.

### 3. AsyncStorage

Defensiva contra bugs futuros: `getAllKeys()` filtrando por prefijo
`moneto.`, después `multiRemove` todas. Si Sprint 5 añade
`moneto.tx-cache` y nadie actualiza una constante, este barrido lo
pesca igual.

`STORAGE_PRESERVE: ReadonlySet<string>` (vacío hoy) es el escape para
cosas legítimamente per-device (e.g., un futuro `moneto.onboarding`).

### 4. Singletons

- `resetApiClient()` — invalida la instancia cacheada del `ApiClient`.
- `resetSupabaseClient()` — invalida la instancia cacheada + el JWT
  cacheado de Supabase + cualquier inflight token exchange. Crítico:
  sin esto, una request post-logout reusaría el JWT del user previo y
  serviría datos via RLS al user nuevo cuando re-loguee.

### 5. Analytics

- `posthog.reset()` — disocia el `distinct_id` del device, próximo event
  va como anonymous hasta que el nuevo user llame `identifyUser()`.
- `Sentry.setUser(null)` — limpia el user context, errors post-logout no
  se atribuyen al user previo.

Sin esto, dashboards de PostHog mostrarían que "User A" hizo events que
el user B disparó.

---

## Edge cases

### Logout durante operación pending

Sprint 1 no tiene mutations in-flight (no hay React Query / data layer
real todavía). Cuando Sprint 2 lo agregue, hay que:

1. Añadir un stage `0a` antes de privy: `queryClient.cancelQueries()`
   - `queryClient.clear()`.
2. En el button del profile: `disabled={isLoggingOut || hasMutations}`
   con un escape (5x tap) para force logout.

Hoy: el `isLoggingOut` ref evita double-tap concurrencia, suficiente.

### Token expirado al hacer logout

`privyLogout()` puede fallar con 401. El stage 1 captura y continúa.
El cleanup local sigue siendo correcto.

### User logout en device A, sigue logueado en device B

Privy.logout es **per-device** — solo afecta el actual. User en device B
sigue con sesión válida hasta que su token expire o haga logout manual.
Esto es comportamiento esperado, no un bug.

**Post-MVP**: feature "Cerrar sesión en todos los devices" via Privy
admin API (`POST /v1/users/{id}/sessions/revoke`). Sprint 8+.

### Logout durante cold start

Si Privy detecta token vencido + refresh fail durante el primer mount,
el `authState` debería transicionar a `"expired"`. El hook
`useAutoLogoutOnExpired` (montado en `_layout.tsx > Shell`) detecta y
dispara `logout()` silencioso → navigate a `/(onboarding)` sin user
interaction.

**State actual**: el wiring del `expired` desde el lado del API (401 →
intentar refresh → si falla, `setAuthState({ status: "expired" })`)
queda para Sprint 1.07+ (wireup completo del refresh). Por ahora, el
hook está listo para cuando alguien le ponga el trigger.

### Race: user tap logout 2× rápido

`useLogout` mantiene un `inflight` ref. La segunda call retorna la
misma promesa. Cero double cleanup, cero double navigation.

### Cleanup parcial → user ve un error

Si el stage 3 (AsyncStorage) falla pero los demás OK:

- Navigation a `/(onboarding)` igual sucede (escape route es prioritario).
- `Alert.alert` informa "Sesión cerrada parcialmente" + sugerencia de
  cerrar la app manualmente.
- Sentry recibe `captureMessage` con tag `logout_failed_stage` para que
  veamos el incidente.

---

## Por qué pure function + hook split

`performLogoutCleanup` no usa `useState`, `usePrivy`, `useRouter`, etc.
Toma `privyLogout` como dependency injected.

**Ventajas**:

1. **Testeable** — Sprint 8 cuando agreguemos Jest podemos testar
   las 5 stages sin mock de PrivyProvider/Router.
2. **Reusable desde non-React contexts** — el `useAutoLogoutOnExpired`
   y un futuro background refresh handler pueden reusar el mismo flow.
3. **Sin contexto React capturado en closures globales** — evita memory
   leaks típicos de logout-handlers que sostienen referencias al store.

`useLogout` es la cara React-friendly que inyecta lo de Privy +
navigation + el coalesce de calls concurrentes.

---

## Performance

Gate del plan: **logout completo en <1s**.

Tamaños esperados (medido en RN bridge en simulator):

| Stage        | Esperado                         |
| ------------ | -------------------------------- |
| privy        | 100–500ms (network roundtrip)    |
| stores       | <5ms                             |
| asyncstorage | 20–80ms (depende del nº de keys) |
| singletons   | <1ms                             |
| analytics    | <10ms                            |

Total típico: 200–600ms. El `LogoutResult.durationMs` lo trackea, y
está logueado para que veamos drift en Axiom.

Si subimos de 1s sostenido, habría que paralelizar stages independientes
(stores + asyncstorage + singletons no dependen entre sí). Por ahora
sequential keeps el código simple y debuggable.

---

## Smoke checklist (founder, post `eas build`)

1. **Login user A** (cuenta de demo). Navegar todos los tabs, abrir
   `appearance.tsx`, cambiar a "Oscuro". Validar que el theme persiste.
2. **Tap "Cerrar sesión"** en `/yo`. Validar el `Alert.alert` aparece
   con texto en español + botón destructive rojo.
3. **Confirmar.** Validar:
   - Loading state ("Cerrando sesión…") dura <1s.
   - Navigation a welcome screen sin flash de authenticated state.
4. **AsyncStorage limpio** — usar React DevTools / Flipper para
   inspeccionar `AsyncStorage.getAllKeys()`. No debe haber keys
   `moneto.*` con datos del user A.
5. **Login user B** (otra cuenta). Validar que NO se ve nada de A:
   - Balance default (mock placeholder).
   - Theme = "system" (no quedó "Oscuro" del A).
   - Profile name vacío / mock.
   - Tab tx history vacío.
6. **5× logout cycle** — login A → logout → login B → logout → login A
   sin crashes.
7. **Modo avión + logout** → debería funcionar (Privy stage falla, los
   demás corren OK). Resultado: navigate a onboarding, Alert
   "Sesión cerrada parcialmente" si aplicable.

---

## TODO post-MVP

- [ ] Añadir stage `0a` cuando exista React Query (Sprint 2+).
- [ ] Disable button durante mutations pending (Sprint 2+).
- [ ] Wirear `setAuthState({ status: "expired" })` desde el `ApiClient`
      en respuesta a 401 + refresh fail (Sprint 1.07).
- [ ] Feature "Logout en todos los devices" via Privy admin API
      (Sprint 8+).
- [ ] Tests Jest unitarios para `performLogoutCleanup` (Sprint 8).
