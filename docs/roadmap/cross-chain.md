# Cross-chain bridges — Roadmap

> **Status (mayo 2026)**: stub UI. Real bridge integration es post-MVP /
> post-seed. Esta doc es la architecture target para que el equipo
> referencie cuando arranque la implementación real.

---

## Por qué importa

Moneto se posiciona como un _neobank privado para LATAM_ sobre Solana.
USD + locales + crypto es el value prop core; "crypto" en mercado LATAM
significa principalmente **Bitcoin y Ether**. Sin bridges, esos dos
quedan teóricamente en el registry pero el user no los puede adquirir
in-app — frustrante.

La estrategia hackathon (`estrategia-frontier-hackathon-2026.md`) prioriza
demo completo > ingeniería completa. Bridges live no se pueden mostrar
en una demo de 5 minutos porque tx Bitcoin tarda 10-60 min en confirmar.
Por eso Sprint 3.08 deja un placeholder UI **honesto**: "BTC viene vía
Zeus Network, sumate al waitlist".

---

## Architecture target

```
┌────────────┐     ┌─────────────┐     ┌────────────┐
│ Bitcoin    │────▶│ Zeus Bridge │────▶│ zBTC en    │
│ Mainnet    │     │   (Apollo)  │     │ Solana     │
└────────────┘     └─────────────┘     └────────────┘
                                              │
                                              ▼
                                        ┌────────────┐
                                        │ Moneto     │
                                        │ (USD-route │
                                        │  + zBTC)   │
                                        └────────────┘

┌────────────┐     ┌─────────────┐     ┌────────────┐
│ Ethereum   │────▶│ Wormhole    │────▶│ wETH en    │
│ Mainnet    │     │ Token Bridge│     │ Solana     │
└────────────┘     └─────────────┘     └────────────┘
```

### ADRs

- **Zeus Network (zBTC) sobre Wormhole para BTC** — Solana-native, simpler
  integration, Apollo SDK público + audit trail, lower fees vs alternativas.
- **Wormhole sobre LI.FI para ETH** — mature, audited, hackathon sponsor
  potencial. LI.FI es aggregator (más complejo + razón doble de bridge
  risk) — Q1 2027 evaluamos LI.FI como capa unificada.
- **Stub UI con waitlist real** (Sprint 3.08) — demo honesto vs mock que
  dispara crash. La data acumulada (`early_access_requests`) sirve para:
  1. Proof-of-demand para el round seed.
  2. Marketing list cuando lance la integración.
  3. Priorizar BTC vs ETH según conteo.

### Risk analysis

| Riesgo                                   | Mitigación                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Bridge contract hack (Wormhole 2022)     | Feature flag kill-switch via PostHog; degradación a "no bridges available".                               |
| Stuck transfer (Bitcoin lag, RPC issues) | Polling + ETA UI; ops playbook para refund manual desde Zeus dashboard.                                   |
| Wrapped token de-peg                     | Monitoring Pyth de zBTC/wETH vs spot — alerta Sentry si spread >0.5%.                                     |
| Phishing fake-wETH airdrop               | Mint allowlist hardcoded en `MAINNET_MINTS` (registry); UI ignora otros mints aunque aparezcan en wallet. |

---

## Phasing (post-MVP)

### Phase 1 — zBTC integration (target Q3 2026)

- [ ] Zeus Network SDK integrado; setup en `packages/solana`.
- [ ] Bridge UI mobile: 2-step flow (connect Bitcoin sender wallet,
      confirm Solana receiver = embedded wallet user).
- [ ] Atomicity: monitor Bitcoin confirmations (mempool.space) +
      Solana mint event (logs Helius webhook).
- [ ] Failure recovery: Zeus expone refund flow si la mint falla.
- [ ] E2E test con $100 BTC en Zeus testnet.
- [ ] Sentry alerts: stuck >1h, mint event mismatch.
- [ ] PostHog: `bridge_initiated` (asset, source_chain), `bridge_completed`,
      `bridge_failed` (error_code).

### Phase 2 — wETH integration (target Q3 2026)

- [ ] Wormhole SDK; multi-step UX (sign EVM tx, attest, redeem en Solana).
- [ ] Connect Ethereum wallet via WalletConnect v2 modal.
- [ ] Reuse mismo PostHog taxonomy de Phase 1.
- [ ] E2E sepolia → solana devnet smoke.

### Phase 3 — Multi-chain stables (Q4 2026)

- USDC bridges (parcial vía Wormhole — Circle CCTP cuando expand a Solana).
- Stables locales cross-chain: COPm desde Celo, MXNB desde Arbitrum.
- Reuse Wormhole + Wormhole-compatible portals (Circle, LayerZero futuro).

### Phase 4 — Bridge aggregation (2027)

- LI.FI integrado para ruta unificada multi-bridge.
- Ranking por: fee, ETA, audit score, kill-switch status.
- "Best route" suggestion en UI.

---

## Stub MVP (Sprint 3.08)

Ya implementado:

- **Asset detail screen (`/activos/btc`, `/activos/eth`)** muestra banner
  "Bridge en camino · Solicitar acceso early" cuando el balance del user
  es 0. Si el user ya tiene zBTC/wETH (bridged externally), el banner
  queda en una posición secundaria (chart sigue visible).
- **Backend `/api/early-access`** registra la solicitud (Supabase). Slug
  whitelist: `bridge:btc`, `bridge:eth`.
- **Mobile hooks `useEarlyAccessRequests` + `useRequestEarlyAccess`** —
  optimistic update del cache; rollback en error.
- **PostHog**: `bridge_placeholder_shown`, `bridge_early_access_requested`.

Lo que **no** está implementado (deliberado):

- ❌ Bridge real (Zeus / Wormhole SDK calls).
- ❌ Connect-Bitcoin / connect-Ethereum wallets (WalletConnect, etc.).
- ❌ Tx tracking, retry, refund logic.
- ❌ Admin dashboard de waitlist requests.
- ❌ Email follow-up automation.

---

## Sources

- Zeus Network docs — https://zeus-network.com/docs (verificar antes de
  arrancar integration; Apollo SDK puede haber cambiado.)
- Wormhole docs — https://docs.wormhole.com/wormhole/quick-start
- Circle CCTP — https://developers.circle.com/stablecoins/docs/cctp-getting-started
- Pyth feeds para monitoring de zBTC/wETH peg — `pyth.network/price-feeds`
