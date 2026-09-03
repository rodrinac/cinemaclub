module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  moduleNameMapper: {
    "^react-native-mmkv$": "<rootDir>/tests/mocks/react-native-mmkv.js",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
