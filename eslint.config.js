import eslintConfigExpo from "eslint-config-expo";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  {
    files: ["**/*.tsx"],
    plugins: {
      eslintConfigExpo,
      eslintConfigPrettier,
    },
    rules: {
      "eol-last": ["error", "always"],
      "no-trailing-spaces": "error",
    },
  },
];
