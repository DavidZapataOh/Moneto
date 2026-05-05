module.exports = {
  root: true,
  extends: ["@moneto/eslint-config/base.js"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  // Edge functions = Deno runtime, no node_modules → eslint Node parser falla.
  // Tests = spec viva sin vitest aún (Sprint 8 ramp), fuera de tsconfig include.
  ignorePatterns: ["supabase/functions/**", "supabase/.temp/**", "tests/**"],
};
