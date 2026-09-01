# Spec: Fix invalid `ignoreDeprecations` value in tsconfig.json

## Context
- Repo: `rodrinac/cinemaclub`
- Installed TypeScript version: **5.8.3** (`typescript: ~5.8.3` in `package.json`, confirmed via `node_modules/typescript/package.json` and `npx tsc --version`)
- File: `tsconfig.json` (root, extends `expo/tsconfig.base`)

## Current state
```jsonc
{
  "compilerOptions": {
    // ...
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "ignoreDeprecations": "6.0"   // <-- invalid for TS 5.8.3
  },
  "extends": "expo/tsconfig.base"
}
```

Running `npx tsc --noEmit` currently fails immediately with:
```
tsconfig.json(17,27): error TS5103: Invalid value for '--ignoreDeprecations'.
```
This is a hard compiler error (not a warning), so the build never gets past config parsing.

## Root cause
`ignoreDeprecations` only accepts specific version-string values, and the valid value depends on the currently installed TypeScript version. TS 5.8.3 only accepts `"5.0"` as a valid value for this option — `"6.0"` is not a recognized/valid value for this compiler version and throws `TS5103`.

Verified experimentally in an isolated temp project (using the repo's own `node_modules/.bin/tsc`, TS 5.8.3):
| `ignoreDeprecations` value | Result |
|---|---|
| `"5.0"` | ✅ compiles, exit code 0 |
| `"6.0"` | ❌ `TS5103: Invalid value for '--ignoreDeprecations'.` |
| *(omitted entirely)* | ✅ compiles, exit code 0 — no baseUrl deprecation warning surfaced in this TS version/config combo |

Also verified by overriding the option on the CLI against the real repo config (no file edits): `npx tsc --noEmit --ignoreDeprecations 5.0` — the `TS5103` error disappears entirely.

## Exact desired change
In `tsconfig.json`, change:
```jsonc
"ignoreDeprecations": "6.0"
```
to:
```jsonc
"ignoreDeprecations": "5.0"
```
This is a one-line value change only — no other keys, structure, or unrelated options should be touched. `"5.0"` is the correct/valid value for the currently installed TypeScript 5.8.3 and preserves the original intent (silencing the `baseUrl`/deprecation-related warning) without introducing an invalid-option error.

> Note: if TypeScript is upgraded to a major version where `"5.0"` itself becomes invalid or the deprecation window changes, this value will need to be re-verified against the new installed version (valid values are tied to the installed compiler version, not to the repo's TS "target").

## Validation command
```bash
npx tsc --noEmit
```
Expected outcome after the fix: the `TS5103` error is gone.

## ⚠️ Pre-existing unrelated issue discovered (out of scope)
After the `ignoreDeprecations` value is corrected, `npx tsc --noEmit` still reports one **unrelated, pre-existing** type error, not caused by and not fixed by this config change:
```
src/api/tmdb/index.ts(41,3): error TS2322: Type 'Promise<void | T>' is not assignable to type 'Promise<T>'.
  Type 'void | T' is not assignable to type 'T'.
    'T' could be instantiated with an arbitrary type which could be unrelated to 'void | T'.
```
This should be tracked/fixed separately; it is not part of this spec's scope (this spec only concerns the `ignoreDeprecations` config value).

## Summary of required action for implementation subagent
1. Edit `tsconfig.json`: change `"ignoreDeprecations": "6.0"` → `"ignoreDeprecations": "5.0"`.
2. Run `npx tsc --noEmit` to confirm the `TS5103` error is resolved.
3. Do not attempt to fix the unrelated `src/api/tmdb/index.ts` `TS2322` error as part of this change (separate concern).
