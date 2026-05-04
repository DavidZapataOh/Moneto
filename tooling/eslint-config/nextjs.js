/**
 * Next.js ESLint config.
 *
 * NOT extiende `./react.js` — `next/core-web-vitals` ya trae react +
 * react-hooks plugins. Si los duplicamos, ESLint falla por plugin conflict.
 * En su lugar repetimos las pocas reglas de UX que queremos enforced.
 */
module.exports = {
  extends: ["./base.js", "next/core-web-vitals"],
  rules: {
    "react/prop-types": "off",
    "react/display-name": "off",
    "react-hooks/exhaustive-deps": "warn",
    "@next/next/no-html-link-for-pages": "off",
  },
};
