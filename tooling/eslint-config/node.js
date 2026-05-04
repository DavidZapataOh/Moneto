/**
 * Node.js / Cloudflare Workers ESLint config.
 */
module.exports = {
  extends: ["./base.js"],
  env: {
    node: true,
  },
  rules: {
    "no-process-exit": "error",
  },
};
