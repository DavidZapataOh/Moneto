module.exports = {
  root: true,
  extends: ["@moneto/eslint-config/node.js"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
