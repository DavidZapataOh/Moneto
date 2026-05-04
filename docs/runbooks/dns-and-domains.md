# DNS & domains

> Configuración de `moneto.xyz` en Cloudflare. Single source of truth para
> DNS records, DNSSEC, HSTS preload, y propagación cuando agregamos
> environments nuevos.

---

## Domains matrix

| Domain                   | Apunta a                        | Provider | Purpose            |
| ------------------------ | ------------------------------- | -------- | ------------------ |
| `moneto.xyz`             | Vercel (production)             | CF DNS   | Landing page       |
| `www.moneto.xyz`         | Vercel (production)             | CF DNS   | Redirect a apex    |
| `staging.moneto.xyz`     | Vercel (preview)                | CF DNS   | Web staging        |
| `api.moneto.xyz`         | Cloudflare Workers (production) | CF DNS   | API production     |
| `api-staging.moneto.xyz` | Cloudflare Workers (staging)    | CF DNS   | API staging        |
| `app.moneto.xyz`         | Universal links iOS/Android     | CF DNS   | Deep linking       |
| `mail.moneto.xyz`        | (TXT/MX records)                | CF DNS   | SPF / DKIM / DMARC |

---

## Cloudflare zone setup

1. **Crear zone** en CF dashboard → Add Site → `moneto.xyz`.
2. **Cambiar nameservers** en el registrar (Namecheap, GoDaddy, etc.) a los que CF te dé. Propagación ~24h.
3. **Verificar activación**: `dig NS moneto.xyz` debe mostrar los CF NS.

---

## DNS records

### A / AAAA / CNAME

```
# Apex → Vercel
moneto.xyz                A      76.76.21.21          (proxied: ON)
moneto.xyz                AAAA   2606:4700:8d40::a4f  (proxied: ON)

# www redirect → vercel
www.moneto.xyz            CNAME  cname.vercel-dns.com (proxied: ON)

# Staging web
staging.moneto.xyz        CNAME  cname.vercel-dns.com (proxied: ON)

# Workers — bound vía workers.dev no necesitan DNS record explícito
# si el route en wrangler.toml tiene `zone_name`. Cloudflare crea el
# binding internamente.
api.moneto.xyz            (gestionado por wrangler routes)
api-staging.moneto.xyz    (gestionado por wrangler routes)

# Universal links
app.moneto.xyz            CNAME  app-cname-target  (TBD, depende del provider de DL)

# Email auth (post-launch — Resend / SES configuration)
moneto.xyz                TXT    "v=spf1 include:_spf.resend.com ~all"
resend._domainkey.moneto.xyz CNAME resend._domainkey.resend.com
_dmarc.moneto.xyz         TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc@moneto.xyz"
```

`(proxied: ON)` activa el orange cloud — CF actúa como reverse proxy + DDoS shield.

### Wrangler routes (set en `apps/api/wrangler.toml`)

Descomentar las líneas `routes = [...]` cuando la zone esté lista:

```toml
[env.staging]
routes = [{ pattern = "api-staging.moneto.xyz/*", zone_name = "moneto.xyz" }]

[env.production]
routes = [{ pattern = "api.moneto.xyz/*", zone_name = "moneto.xyz" }]
```

`pnpm --filter @moneto/api exec wrangler deploy --env production` registra
el route automáticamente.

---

## DNSSEC

1. CF dashboard → DNS → Settings → DNSSEC → Enable.
2. CF te da un DS record que tenés que setear en el **registrar** (no en CF).
3. Verificá: `dig +dnssec moneto.xyz | grep RRSIG` — debe mostrar firmas.

DNSSEC previene cache poisoning attacks. **Habilitarlo SIEMPRE en producción.**

---

## TLS / SSL

CF maneja certs automáticamente:

- **Production**: SSL/TLS mode = **Full (strict)**. Edge ↔ origin cifrado, cert validado.
- **Workers/Pages**: certs auto-renewed por CF, no acción manual.

**HSTS** — habilitar después de validar HTTPS funciona en todos los subs:

```
SSL/TLS → Edge Certificates → HSTS Settings:
  Enable HSTS:        ON
  Max-Age:            6 months (luego subir a 12)
  Apply HSTS to subdomains: ON
  Preload:            ON  (después de submit a hstspreload.org)
  No-Sniff Header:    ON
```

**Submit a HSTS preload list** (post-launch, cuando estamos confident):

- https://hstspreload.org/?domain=moneto.xyz
- One-way: una vez en la preload list, **revertir es difícil** (1+ año). Solo cuando estás 100% seguro de no necesitar HTTP plain en ningún sub-domain.

---

## Cloudflare WAF / Security

- **Bot Fight Mode**: ON (free tier OK).
- **Always Use HTTPS**: ON.
- **Minimum TLS Version**: 1.2 (1.3 idealmente).
- **Opportunistic Encryption**: ON.
- **TLS 1.3**: ON.
- **Automatic HTTPS Rewrites**: ON.

Rate limiting (post-MVP, cuando tengamos tráfico real):

- Custom rule: `(http.request.uri.path eq "/auth/login") and (rate(10s) > 5)` → block 10 min.

---

## Email auth records

**Resend** (transactional email — sprint 1 onward):

CF dashboard → DNS → Add record:

```
TXT  resend._domainkey  k=rsa; p=MIGfMA0...   (Resend dashboard te lo da)
TXT  @                  v=spf1 include:_spf.resend.com ~all
TXT  _dmarc             v=DMARC1; p=quarantine; rua=mailto:dmarc@moneto.xyz
```

Verificar con https://mxtoolbox.com.

---

## Universal links / App links (deep linking)

Para que `https://app.moneto.xyz/tx/abc123` abra Moneto en iOS/Android sin browser intermedio:

### iOS — `apple-app-site-association`

Servir desde `https://app.moneto.xyz/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.moneto.app",
        "paths": ["/tx/*", "/recovery/*", "/onboard/*"]
      }
    ]
  }
}
```

### Android — `assetlinks.json`

Servir desde `https://app.moneto.xyz/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.moneto.app",
      "sha256_cert_fingerprints": ["TBD: from EAS credentials"]
    }
  }
]
```

Estos files típicamente los sirve el web app o un Worker dedicado. Sprint 1
(launch web landing) define la implementación.

---

## Domain ownership records

- **Apple Developer**: domain verification para Sign in with Apple en `apps.apple.com`.
- **Google Play Console**: domain verification para deep links.
- **Sentry**: source map upload requires domain confirmation.

Estos los configura el founder vía console UI cada vez que onboarding de un
provider nuevo. No automatizable.

---

## Monitoring

CF Analytics (free tier):

- DNS Analytics: queries/sec, errors.
- Web Analytics: traffic, bot %, top countries.
- Workers Metrics: invocations, errors, cpu time, p50/p99 latency.

Para alerts (rate spikes, error spikes), Sprint 0.05 conecta Workers
metrics a Axiom/Sentry.

---

## Cómo agregar un environment / subdomain nuevo

1. Crear DNS record en CF dashboard (orange cloud según corresponda).
2. Si es Worker: agregar `[env.X]` block en `apps/api/wrangler.toml` con `routes = [...]`.
3. Si es Vercel: linkear el domain en Vercel project settings → Domains.
4. Verificar TLS (cert auto-issued por CF en ~30s).
5. Smoke test con `curl -I https://nuevo-sub.moneto.xyz`.
6. Documentar el nuevo sub en este file (table al inicio).
