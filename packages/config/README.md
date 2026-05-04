# @moneto/config

Env validation (Zod) + cross-app constants.

- `parsePublicEnv()` — for mobile bundle (no secrets).
- `parseServerEnv()` — for Cloudflare Workers / Edge functions (secrets included).
- `MAINNET_MINTS`, `PYTH_FEEDS`, `KYC_LIMITS_USD`, etc. — verified constants used by Sprint 3+ services.
