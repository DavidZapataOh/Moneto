/**
 * Conventional Commits enforcement.
 *
 * Format: `<type>(<scope>): <subject>`
 * Example: `feat(mobile): add Toggle component to settings screen`
 *
 * Validado por `.husky/commit-msg` localmente y por CI en cada PR.
 */

module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Tipos permitidos. Mantener corto — más tipos = más decisiones por commit.
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "refactor",
        "perf",
        "test",
        "docs",
        "chore",
        "ci",
        "style",
        "build",
        "revert",
      ],
    ],
    // Scope opcional pero, si se provee, debe estar en este enum.
    "scope-enum": [
      2,
      "always",
      [
        // Apps
        "mobile",
        "api",
        "web",
        "programs",
        // Packages
        "ui",
        "theme",
        "types",
        "solana",
        "config",
        "utils",
        // Tooling
        "tsconfig",
        "eslint-config",
        // Domain features (cross-cutting)
        "auth",
        "wallet",
        "swap",
        "privacy",
        "rails",
        "compliance",
        "yield",
        "card",
        "recovery",
        // Meta
        "deps",
        "release",
        "ci",
        "docs",
      ],
    ],
    "scope-empty": [0],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],
  },
};
