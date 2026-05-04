module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Reanimated 4 usa react-native-worklets/plugin (antes era reanimated/plugin)
    plugins: ["react-native-worklets/plugin"],
  };
};
