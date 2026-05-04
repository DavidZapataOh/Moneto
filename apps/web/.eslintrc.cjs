module.exports = {
  root: true,
  extends: ["@moneto/eslint-config/nextjs.js"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
