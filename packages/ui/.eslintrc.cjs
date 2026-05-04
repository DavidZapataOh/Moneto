module.exports = {
  root: true,
  extends: ["@moneto/eslint-config/react-native.js"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
