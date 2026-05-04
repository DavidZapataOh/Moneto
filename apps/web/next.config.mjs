/**
 * Security headers — aplicados a TODAS las rutas. Dynamic CSP via
 * `middleware.ts` cuando necesitemos `nonce` para inline scripts; los
 * headers estáticos van acá.
 *
 * Ver `docs/security/threat-model.md` para qué amenaza mitiga cada uno.
 */
const securityHeaders = [
  // HSTS — fuerza HTTPS por 2 años + preload (post-launch confirmation).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Bloquea sniffing de MIME types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Sin clickjacking — Moneto nunca debería embed en iframes externos.
  { key: "X-Frame-Options", value: "DENY" },
  // Bloquea XSS legacy (deprecated pero aún honrado por algunos browsers).
  { key: "X-XSS-Protection", value: "0" },
  // Origin-only en cross-origin nav (no leak de query strings con tokens).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permissions-Policy — disable APIs que no usamos. Cuando agreguemos
  // camera/microphone para KYC selfie liveness, ajustar a `self`.
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "picture-in-picture=()",
      "publickey-credentials-get=(self)",
      "screen-wake-lock=()",
      "sync-xhr=()",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  },
  // COOP/COEP — process isolation. COEP `require-corp` es agresivo;
  // si rompe assets externos, bajar a `credentialless`.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
  // CSP estricta — landing page no necesita scripts inline. Si un sprint
  // posterior agrega Server Actions / streaming con inline runtime,
  // pasar a nonce-based via middleware.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self'",
      // Tailwind compila a CSS estático — no necesita 'unsafe-inline'.
      // Si Sprint 8 agrega CSS-in-JS runtime, bajar a 'unsafe-inline'
      // o (mejor) implementar nonce.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.moneto.xyz https://api-staging.moneto.xyz https://*.posthog.com https://*.sentry.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@moneto/theme",
    "@moneto/types",
    "@moneto/utils",
    "@moneto/config",
    "@moneto/observability",
  ],
  experimental: {
    typedRoutes: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
