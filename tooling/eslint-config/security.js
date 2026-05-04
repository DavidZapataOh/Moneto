/**
 * Security-focused ESLint config.
 *
 * Activado por default desde `base.js` — toda regla aquí aplica a TODO el
 * monorepo. Si una regla genera demasiados false positives en un package
 * específico, override en su `.eslintrc.cjs`, NO acá.
 *
 * Ver `docs/security/threat-model.md` para qué amenaza mitiga cada regla.
 */
module.exports = {
  plugins: ["security", "no-secrets"],
  extends: ["plugin:security/recommended-legacy"],
  rules: {
    // ── Security plugin overrides ──────────────────────────────────────
    // `eval()` y `Function()` permiten code injection. Bloquear duro.
    "security/detect-eval-with-expression": "error",
    "security/detect-non-literal-require": "error",
    "security/detect-pseudoRandomBytes": "error",
    "security/detect-unsafe-regex": "error",

    // Warnings que conviene leer pero no bloquean — pueden tener
    // false positives en code legítimo (regex configurable, fs paths controlled).
    "security/detect-non-literal-fs-filename": "warn",
    "security/detect-non-literal-regexp": "warn",
    "security/detect-object-injection": "off", // demasiados false positives en TS estricto

    // child_process spawn con args dinámicos — vector clásico de RCE.
    "security/detect-child-process": "error",

    // Buffer(constructor) deprecated y unsafe.
    "security/detect-new-buffer": "error",

    // ── Anti-leak ──────────────────────────────────────────────────────
    // Bloquea strings con entropía alta (likely API keys/secrets) commiteados
    // en código. Tolerance 4.5 = razonable; bajo es paranoico, alto deja pasar.
    "no-secrets/no-secrets": [
      "error",
      {
        tolerance: 4.5,
        // Ignorar strings comunes que son alta entropía pero no secrets.
        ignoreContent: [
          // Solana mainnet mints (públicos, documentados).
          "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
          "So11111111111111111111111111111111111111112",
          "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
          "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
          "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
          // Pyth feed IDs (públicos).
          "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
          "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
          "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
        ],
      },
    ],

    // ── Custom: prevenir loggear data sensible ─────────────────────────
    // Bloquea `console.X(...balance...)`, `console.X(...amount...)`, etc.
    // No reemplaza la auditoría del scrubber, pero pesca el caso obvio
    // donde un dev escribe `console.log("balance:", balance)` debugging.
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "CallExpression[callee.object.name='console'] Identifier[name=/^(balance|amount|delta|seed|seedPhrase|mnemonic|privateKey|viewingKey|viewing_key|jwt|bearer|password|otp|pin|cedula|ssn|tax_id)$/i]",
        message:
          "No loguear data sensible (financial/PII/secrets). Usar @moneto/utils logger + @moneto/observability scrubber. Ver docs/observability/conventions.md.",
      },
      {
        selector: "Literal[value=/Bearer\\s+[A-Za-z0-9._\\-]{20,}/]",
        message:
          "Bearer token literal en código. Usar process.env / wrangler secret / vault.",
      },
    ],
  },
  overrides: [
    {
      // Tests pueden usar regex dinámicos / strings altos de entropía
      // (fixtures, mocked tokens). Relajar pero no apagar todo.
      files: ["**/*.test.{ts,tsx,js}", "**/*.spec.{ts,tsx,js}", "**/__tests__/**"],
      rules: {
        "no-secrets/no-secrets": "off",
        "security/detect-non-literal-regexp": "off",
        "security/detect-non-literal-fs-filename": "off",
      },
    },
    {
      // Config files (eslintrc, jest.config, etc.) pueden hacer require dinámico.
      files: ["**/*.config.{js,ts,cjs,mjs}", "**/.eslintrc.{js,cjs}"],
      rules: {
        "security/detect-non-literal-require": "off",
      },
    },
  ],
};
