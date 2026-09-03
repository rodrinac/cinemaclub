// react-native-web already converts these deprecated props/styles correctly
// under the hood (see react-native-web's createDOMProps/preprocess), but
// react-native-paper still uses the old APIs internally, so react-native-web
// logs a one-time console warning per prop via warnOnce. These are harmless
// noise, not bugs, so they're suppressed here rather than patched deep
// inside react-native-paper's node_modules.
//
// This must be the first import in App.tsx (before Routes/Theme/etc.) since
// ES module imports evaluate in the order they're written, and some of
// those modules trigger the warnings as soon as they're imported (e.g. via
// top-level StyleSheet.create calls).
const SUPPRESSED_WARNING_SUBSTRINGS = [
  '"shadow*" style props are deprecated',
  "props.pointerEvents is deprecated",
];

const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const [firstArg] = args;
  if (
    typeof firstArg === "string" &&
    SUPPRESSED_WARNING_SUBSTRINGS.some((substring) => firstArg.includes(substring))
  ) {
    return;
  }
  originalConsoleWarn(...args);
};
