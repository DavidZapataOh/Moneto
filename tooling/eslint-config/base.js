/**
 * Base ESLint config for all packages and apps.
 * Extends recommended TypeScript rules + prettier compat.
 */
module.exports = {
  root: false,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
      },
      node: true,
    },
  },
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports", fixStyle: "inline-type-imports" },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    // Off intencionalmente: con `noUncheckedIndexedAccess` activo, el `!`
    // en accesos de array después de un guard es la forma idiomática de
    // documentar el invariant. La regla generaba false positives constantes.
    "@typescript-eslint/no-non-null-assertion": "off",
    "import/order": [
      "warn",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ],
    "import/no-default-export": "off",
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    "no-debugger": "error",
    eqeqeq: ["error", "always", { null: "ignore" }],
  },
  ignorePatterns: [
    "node_modules",
    "dist",
    "build",
    ".next",
    ".expo",
    ".turbo",
    "coverage",
    "*.config.js",
    "*.config.ts",
    "babel.config.js",
    "metro.config.js",
  ],
};
