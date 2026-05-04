module.exports = {
  root: true,
  extends: ["@moneto/eslint-config/base.js"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
