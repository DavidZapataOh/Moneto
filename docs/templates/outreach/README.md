# Outreach templates

> Templates de email + DM para partnerships. Founder copy/paste/personaliza.
>
> **Reglas**:
>
> - **Personalizar siempre**. Cero copy-paste literal — los partners reciben
>   100 mensajes genéricos por semana. Mostrar que conocemos su producto.
> - **Specific ask**. Cada email termina con UNA acción clara
>   (call/sandbox key/intro/etc), no con "let me know thoughts".
> - **Status update en CRM** apenas se manda — `docs/partnerships/crm-tracker.md`.
> - **Follow-up scheduled** al mismo tiempo que se manda el primero
>   (3 días si silencio, después 7 días, después dead).

---

## Index

| Partner           | Template                         | Channel primario         | Owner del contacto    |
| ----------------- | -------------------------------- | ------------------------ | --------------------- |
| Bold Colombia     | [`bold.md`](./bold.md)           | partnerships@bold.co     | partnerships@bold.co  |
| Rain Cards        | [`rain.md`](./rain.md)           | sandbox@raincards.xyz    | sandbox@raincards.xyz |
| Umbra Privacy     | [`umbra.md`](./umbra.md)         | Discord (TG @umbra-team) | Umbra Discord         |
| Privy             | [`privy.md`](./privy.md)         | sales@privy.io + Discord | sales@privy.io        |
| Persona KYC       | [`persona.md`](./persona.md)     | sales@withpersona.com    | Persona sales         |
| Helius            | [`helius.md`](./helius.md)       | Hackathon discount form  | Helius support        |
| Generic follow-up | [`follow-up.md`](./follow-up.md) | reuse para cualquiera    | n/a                   |

---

## Placeholder convention

Cada template usa `{{PLACEHOLDER}}` style. Antes de enviar, reemplazar
TODOS los placeholders. Si dejás un `{{...}}` en producción, perdés
credibilidad inmediata.

| Placeholder            | Valor                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `{{FOUNDER_NAME}}`     | David Zapata                                                                             |
| `{{FOUNDER_TITLE}}`    | Founder                                                                                  |
| `{{FOUNDER_EMAIL}}`    | TBD (founder@moneto.xyz una vez creado)                                                  |
| `{{FOUNDER_LINKEDIN}}` | TBD                                                                                      |
| `{{FOUNDER_TWITTER}}`  | TBD                                                                                      |
| `{{LANDING_URL}}`      | https://moneto.xyz (post-launch web) o `null`                                            |
| `{{PITCH_DECK_URL}}`   | TBD (Notion/Pitch deck link)                                                             |
| `{{ANCHOR_DOC_URL}}`   | link a `private-neobank-latam.md` o `moneto-analysis.md` (compartido vía Notion público) |

---

## Tone guidelines

- **Concise**. Si el email tarda >90s en leer, lo descartan. Target: 200-350 palabras.
- **Specific**. Mencionar producto del partner por nombre + por qué los elegimos vs. alternativas.
- **Honest about stage**. Hackathon participant — no exagerar (no sirve "we have 50K users").
- **Show technical depth**. Linkear a doc técnico real (compartmentalization, threat model) — separa de los pitches genéricos.
- **No emoji en email formal**. Discord/Twitter sí.
- **Spanish para partners LATAM** (Bold), **English para US/global** (Rain, Privy, Persona, Helius).

---

## Cadencia de follow-up

| Día    | Acción si sin respuesta                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------- |
| Día 0  | Send. Update CRM `last_touch_date`. Schedule follow-up para D+3.                                          |
| Día 3  | Soft follow-up (template `follow-up.md`, "bumping in case missed").                                       |
| Día 7  | Final follow-up. Si critical partner: escalar via canal alterno (LinkedIn co-founder, Twitter DM al CTO). |
| Día 10 | Mark `dead` en CRM. Activar fallback (ver `docs/partnerships/alternatives-matrix.md`).                    |

---

## Pitch deck reference

Cuando el template menciona "adjunto pitch deck", el founder debe tener:

- 10 slides max.
- Problema (1-2 slides) → solución (1-2) → tracción/equipo (1) → arquitectura técnica (2-3) → ask específico (1).
- PDF + link Notion público (no Google Drive — algunos partners no abren).
- Versión inglés + español preparadas.

Status: TBD — sprint paralelo del founder.
