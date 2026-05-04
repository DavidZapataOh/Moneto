/**
 * React Native ESLint config — extends React with RN-specific rules.
 */
module.exports = {
  extends: ["./react.js", "plugin:react-native/all"],
  plugins: ["react-native"],
  env: {
    "react-native/react-native": true,
  },
  rules: {
    "react-native/no-inline-styles": "off",
    "react-native/no-color-literals": "off",
    "react-native/sort-styles": "off",
    "react-native/no-raw-text": "off",
    // Metro / Expo asset loading requires `require("./asset.png")` — no ESM
    // equivalent exists. Allow it ONLY para image/font/svg extensions.
    "@typescript-eslint/no-require-imports": [
      "error",
      { allow: ["\\.(png|jpg|jpeg|gif|webp|svg|ttf|otf|woff|woff2)$"] },
    ],
  },
};
