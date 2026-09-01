module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  moduleNameMapper: {
    "^expo-sqlite$": "<rootDir>/tests/mocks/expo-sqlite.ts",
  },
};
