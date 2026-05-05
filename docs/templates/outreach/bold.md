# Bold Colombia — outreach template

> Bold es nuestro **partner crítico para off-ramp Colombia**. Sin Bold (o
> alternativa Littio), no hay rail funcional para retiros a peso colombiano.
>
> Idioma: español. Audiencia: equipo de partnerships LATAM.
> Contacto: `partnerships@bold.co` + LinkedIn co-founder.
> Deadline respuesta: **2026-04-14**.

---

## Subject

```
Solicitud de sandbox API — Moneto, neobanco privado LATAM en Solana
```

---

## Body

```
Hola equipo Bold,

Soy {{FOUNDER_NAME}}, founder de **Moneto** — un neobanco privacy-first
para trabajadores remotos LATAM construido sobre Solana. Estamos
participando en el **Solana Frontier Hackathon 2026** (organizado por
Colosseum) y Bold es nuestro partner crítico para la rail de off-ramp
en Colombia.

**Lo que construimos:**
- Mobile app que recibe USD (USDG/USDC) de empleadores extranjeros.
- Yield 6-8% APY automático mientras el dinero descansa.
- **Cash-out a COP via Bold** → cuenta Bancolombia/Nequi del usuario en <10min.
- Tarjeta Visa virtual + payment via QR local (Bold también).

**Lo que necesitamos de ustedes:**
1. Sandbox access a la API de Bold (off-ramp + QR payments).
2. Documentación de webhooks para confirmar pagos.
3. Una intro call de 30min con su team de partnerships para entender
   pricing, rate limits y compliance requirements.

**Por qué nos importa Bold:**
- Rail más limpio de Colombia para crypto-to-COP que evaluamos.
- API REST + webhooks + settlement rápido.
- Compatible con nuestra arquitectura self-custodial — no requieren custody
  on our side, ni hold de fondos del user.

**Status del proyecto:**
- Stack arquitectural completo (compartmentalization Privy + Supabase,
  Token-2022 confidential balances, Umbra para shielding).
- 6 docs técnicos completos (architecture, compliance stance, system design,
  threat model, observability, security baseline).
- Mobile UI funcional en Expo (Sprint 0 completo).
- Equipo: {{FOUNDER_NAME}}, founder LATAM con 4 años en cripto.

Adjunto pitch deck (10 slides) + link al landing page ({{LANDING_URL}}).
¿Podemos coordinar una call esta semana o la próxima?

Gracias por el tiempo. Bold es el partner que nos permite construir esto
bien hecho desde día 1.

Saludos,
{{FOUNDER_NAME}}
{{FOUNDER_TITLE}} · Moneto
{{FOUNDER_EMAIL}} · {{FOUNDER_LINKEDIN}} · {{FOUNDER_TWITTER}}
{{LANDING_URL}}
```

---

## Adjuntos sugeridos

- Pitch deck PDF (~10 slides).
- Link a landing page (cuando exista) o a `private-neobank-latam.md` en
  Notion público.

---

## Canales paralelos

Si email no responde en 3 días:

1. **LinkedIn DM al co-founder Daniel Lascarro** o al **VP Partnerships**.
   Mensaje breve referenciando el email + CC el rep.
2. **Discord Superteam Colombia** — joinear, presentarse, mencionar Moneto
   - intentar conexión orgánica con devs de Bold (varios participan).
3. **Twitter @bold_colombia** — DM secundario, low-cost intento.

---

## Negociación notes

- **Pricing target**: <1% por transacción off-ramp + flat fee razonable
  (Bold suele cobrar 0.5-0.75% en su producto core).
- **Settlement time**: <10min p95 — el promise visible a users.
- **Rate limits**: necesitamos saber el cap por minuto/día en sandbox y prod.
- **Compliance handoff**: Bold requiere KYC verificado nuestro lado antes
  de procesar — confirmar que Persona output es aceptable formato.
- **Dispute / chargeback flow**: cómo manejan reverso de pagos? Crítico
  para cuando un user dispute un cashout.

---

## Fallback si Bold no responde / dice no

Activar el plan B según `docs/partnerships/alternatives-matrix.md`:

1. **Littio Colombia** — similar API, slightly more setup. Próximo email.
2. **Daviplata API directa** — última opción, más complejo, requiere acuerdo bancario.

---

## CRM update

Después de enviar, actualizar `docs/partnerships/crm-tracker.md`:

```
| Bold Colombia | contacted | founder | YYYY-MM-DD | YYYY-MM-DD | Follow-up D+3 si silencio | Sandbox URL TBD |
```
