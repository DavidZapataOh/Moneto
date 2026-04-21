# Moneto — MVP mobile app

> Money, privately. El neobanco para quienes prefieren no ser vistos.
>
> Expo + React Native + TypeScript · Solana Frontier Hackathon 2026

## Stack

- **Expo SDK 52** con React Native 0.76 y New Architecture
- **TypeScript** estricto, paths aliases
- **NativeWind v4** (Tailwind CSS para RN)
- **expo-router** (file-based routing con typed routes)
- **Reanimated 3** para microinteracciones
- **Zustand** para state
- **Privy** (planned) para embedded wallets
- **Umbra SDK** (planned) para privacy layer on-chain

## Setup

```bash
# Install deps
pnpm install   # o npm / yarn / bun

# Iniciar en dev (escanea QR con Expo Go)
pnpm start

# iOS simulator
pnpm ios

# Android emulator
pnpm android
```

## Estructura

```
app/                     # Rutas (expo-router)
  (onboarding)/          # Flow inicial — splash, intro, auth
  (tabs)/                # Bottom tabs autenticadas
    index.tsx            # Home / saldo
    card.tsx             # Tarjeta Visa
    yield.tsx            # Rendimiento
    profile.tsx          # Cuenta + privacidad
  receive.tsx            # Modal — recibir USD via payroll link
  send.tsx               # Modal — enviar P2P o cash-out
  send-success.tsx       # Reveal ceremonial del envío
  privacy.tsx            # Modal — viewing keys + compliance

src/
  theme/                 # Colors, typography, spacing tokens
  components/
    ui/                  # Button, Card, Text, Avatar, Badge, ...
    features/            # BalanceHero, VirtualCard, TransactionRow, YieldChart
  hooks/                 # useTheme, useHaptics
  stores/                # Zustand — useAppStore
  data/                  # Mock data (reemplaza post-MVP)
  lib/                   # format helpers, clsx
```

## Design principles

Todas las decisiones visuales defienden la estrategia de marca (ver `/brand-strategy.md`):

1. **Terracota es el único color saturado.** Todo lo demás es neutral cálido.
2. **Dark mode es la versión primaria** (alineado con tesis de privacidad).
3. **Negro puro `#000` y blanco puro `#FFF` están prohibidos** — temperatura cálida consistente.
4. **JetBrains Mono solo para números.** Fraunces solo para display. Inter para UI.
5. **Haptics en cada interacción meaningful.**
6. **60/30/10**: backgrounds neutros (60%), elevaciones (30%), acento terracota (10%).
7. **Squircles + bordes redondeados generosos** (Apple-style continuous curves).
8. **Ceremony para money-in moments** (anticipation → reveal → afterglow).

## Screens implementadas

- ✅ Splash / welcome con glow ambiental
- ✅ Intro carousel 3 slides
- ✅ Auth con Face ID + social login
- ✅ Home dashboard: balance hero, yield ticker live, quick actions, mini chart, movimientos
- ✅ Virtual card con tilt 3D sutil + flip para detalles
- ✅ Yield screen con vaults allocation
- ✅ Profile con viewing keys + KYC status
- ✅ Receive — QR + payroll link + share
- ✅ Send — P2P y cashout con mode switcher
- ✅ Send success con reveal ceremony 3 stages
- ✅ Privacy — gestión de viewing keys + ZK proofs

## Por hacer (post-MVP hackathon)

- [ ] Privy integration real (embedded wallets)
- [ ] Umbra SDK on-chain shield/unshield flows
- [ ] Bold Colombia API sandbox para cashout real
- [ ] Rain card issuer sandbox
- [ ] Chart interactivo (drag con finger, tactile feel estilo Revolut)
- [ ] Social recovery con guardianes
- [ ] Notificaciones push reales
- [ ] Tests con Maestro

## License

Propietary — Moneto 2026
