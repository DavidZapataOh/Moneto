## Resumen

<!-- 1-3 bullets explicando qué hace y por qué. NO repitas el diff. -->

## Plan / sprint

<!-- Linkear al plan: e.g., `plans/sprint-1-mobile/03-onboarding-flow.md` -->

## Tipo de cambio

- [ ] feat — nueva funcionalidad
- [ ] fix — bug fix
- [ ] refactor — sin cambio de comportamiento
- [ ] perf — optimización
- [ ] test
- [ ] docs / chore / ci

## Test plan

<!-- Cómo verificaste que esto funciona. Si es UI mobile: capturas/Loom + escenarios. -->

- [ ] `pnpm typecheck` pasa
- [ ] `pnpm lint` pasa
- [ ] `pnpm test` pasa
- [ ] Probado manualmente en iOS / Android (si aplica)
- [ ] Probado dark mode + light mode (si aplica)

## Checklist privacy / security

<!-- Marcar lo que aplique. Si NADA aplica, también explicarlo brevemente. -->

- [ ] Cambia código que toca PII o secrets — describir aislamiento
- [ ] Cambia código en `packages/solana/` u `apps/programs/` — Solana eng review requerido
- [ ] Cambia compliance bridges — review doble (founder + security)
- [ ] Cambia secrets (no commit, solo `wrangler secret put`)

## Labels útiles

- `preview-build` — dispara EAS preview build automático
