// A CommonJS-compatible re-implementation of react-native-mmkv's in-memory
// mock (see node_modules/react-native-mmkv/lib/createMMKV/createMockMMKV.js).
// ts-jest cannot transform the real package's ESM build, so this module is
// mapped in place of "react-native-mmkv" for the test environment.
class MockMMKV {
  constructor(config = { id: "mmkv.default" }) {
    this.id = config.id;
    this.isReadOnly = false;
    this.isEncrypted = false;
    this.storage = new Map();
  }

  set(key, value) {
    if (key === "") throw new Error("Cannot set a value for an empty key!");
    this.storage.set(key, value);
  }

  getString(key) {
    const result = this.storage.get(key);
    return typeof result === "string" ? result : undefined;
  }

  getNumber(key) {
    const result = this.storage.get(key);
    return typeof result === "number" ? result : undefined;
  }

  getBoolean(key) {
    const result = this.storage.get(key);
    return typeof result === "boolean" ? result : undefined;
  }

  getAllKeys() {
    return Array.from(this.storage.keys());
  }

  contains(key) {
    return this.storage.has(key);
  }

  remove(key) {
    return this.storage.delete(key);
  }

  clearAll() {
    this.storage.clear();
  }
}

let mockInstances = new Map();

const createMMKV = (config = { id: "mmkv.default" }) => {
  if (!mockInstances.has(config.id)) {
    mockInstances.set(config.id, new MockMMKV(config));
  }

  return mockInstances.get(config.id);
};

const resetMockMMKV = () => {
  mockInstances = new Map();
};

module.exports = { createMMKV, resetMockMMKV };
