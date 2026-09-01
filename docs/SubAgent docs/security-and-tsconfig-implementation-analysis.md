# Security and TypeScript Configuration Implementation Analysis

**Target Document:** `docs/SubAgent docs/security-and-tsconfig-implementation-analysis.md`  
**Date:** 2026-09-01  
**Scope:** Specification and analysis for implementation agent. No application source, package manifests, or lockfiles were modified during this phase.

---

## 1. TypeScript Configuration Specification (`tsconfig.json`)

### Required Changes
Modify `tsconfig.json` under `compilerOptions`:

1. **Add `ignoreDeprecations: "6.0"`**:
   ```json
   "ignoreDeprecations": "6.0"
   ```
   *Purpose:* Explicitly requested by specification to suppress deprecation warnings for compiler options scheduled for deprecation in TypeScript 6.0.

2. **Update Alias Path Mapping**:
   Change:
   ```json
   "paths": {
     "@/*": ["src/*"]
   }
   ```
   To:
   ```json
   "paths": {
     "@/*": ["./src/*"]
   }
   ```

3. **Remove `baseUrl`**:
   Remove `"baseUrl": "."` from `compilerOptions`. Modern TypeScript module resolution (`moduleResolution: "bundler"`) resolves explicit paths relative to root without `baseUrl`.
   *Fallback Note:* If downstream Expo/Metro or Jest tooling fails during validation without `baseUrl`, retain `"baseUrl": "."` and document the exception—`ignoreDeprecations: "6.0"` ensures clean compilation regardless.

---

## 2. Dependency Topology & `npm audit fix` Analysis

The table below outlines the 12 targeted packages, their exact current resolved versions in `package-lock.json`, current dependency paths, required target ranges/actions, and expected lockfile effects.

| Package | Current Resolved Version(s) | Current Dependency Topology / Path | Target Safe Version & Action | Anticipated `package-lock.json` Effect |
|---|---|---|---|---|
| **axios** | `0.28.0` | Direct root dependency (`axios@^0.28.0`) | `^1.7.9` (or safe `1.8.x`). Major version bump. | Root entry in `package.json` and `package-lock.json` updated to 1.x. Replaces `axios@0.28.0` node tree. |
| **form-data** | `4.0.2` | Transitive via `axios@0.28.0 -> form-data@4.0.2` | `>=4.0.6` | Upgrading `axios` or running `npm audit fix` refreshes `form-data` under `axios` to `4.0.6`+. Resolves CRLF & boundary randomness advisories. |
| **js-yaml** | `4.3.2`<br>`3.15.2`<br>`3.14.0` | • `eslint -> @eslint/eslintrc -> js-yaml@4.3.2`<br>• `react-native -> cosmiconfig -> js-yaml@3.15.2`<br>• `react-native -> babel-jest -> istanbul -> @istanbuljs/load-nyc-config -> js-yaml@3.14.0` | `>=3.15.1` for 3.x instances (3.14.0 has Merge DoS CVE-2022-1471). | `npm audit fix` updates the `3.14.0` lockfile node to `3.15.2` (or deduplicates with existing `3.15.2`). |
| **plist** | `3.0.1` | `expo -> @expo/config-plugins -> xcode -> simple-plist -> plist@3.0.1` | `>=3.0.5` (preferably `3.1.1`+) | `plist@3.1.1` replaces the deprecated `xmldom` sub-dependency with `@xmldom/xmldom@^0.9.10`. |
| **simple-plist** | `1.1.1` | `expo -> @expo/config-plugins -> xcode@3.0.1 -> simple-plist@1.1.1` | `>=1.3.1` (compatible with `xcode`'s `^1.1.0` range) | `simple-plist` node in `package-lock.json` updated from `1.1.1` to `1.3.1`. |
| **xmldom** | `0.1.31` | `simple-plist@1.1.1 -> plist@3.0.1 -> xmldom@0.1.31` | Deprecated/Vulnerable. Replace via `plist >=3.1.1` upgrade to `@xmldom/xmldom`. | `xmldom@0.1.31` node removed from `package-lock.json`; `@xmldom/xmldom` added. |
| **@babel/helpers** | `7.29.7` | `@babel/core@7.29.7 -> @babel/helpers@7.29.7` | Keep aligned with `@babel/core` (7.29.x). | Preserved in 7.x family; lockfile remains aligned. |
| **@babel/runtime** | `7.26.7` | Direct/Transitive via `expo`, `@expo/cli`, `react-native-web`, `metro-runtime` | `>=7.26.10` (fixes GHSA-968p-4wvh-cqc8 ReDoS) | `npm audit fix` updates `@babel/runtime` node in `package-lock.json` to `>=7.26.10`. |
| **brace-expansion** | `1.1.11`<br>`2.0.1`<br>`2.1.4`<br>`5.0.9` | • `minimatch@3.1.5 -> brace-expansion@1.1.11`<br>• `sucrase -> glob@10.4.5 -> minimatch@9.0.5 -> brace-expansion@2.0.1`<br>• `glob@10.5.0 -> minimatch@9.0.9 -> brace-expansion@2.1.4`<br>• `jest -> minimatch@10.2.6 -> brace-expansion@5.0.9` | `1.x >=1.1.18`, `2.x >=2.1.4` (2.0.1 has ReDoS advisory) | `brace-expansion@2.0.1` upgraded to `2.1.4` in `package-lock.json`. 1.1.11 refreshed to safe patch. |
| **glob** | `7.2.3`<br>`10.4.5`<br>`10.5.0`<br>`13.0.6` | • `react-native -> @react-native/codegen -> glob@7.2.3`<br>• `sucrase -> glob@10.4.5`<br>• `expo / @expo/cli -> glob@10.5.0`<br>• `jest -> glob@13.0.6` | `10.x >=10.5.0` (10.4.5 affected by command injection advisory) | `glob@10.4.5` under `sucrase` updated to `10.5.0` in `package-lock.json`. |
| **minimatch** | `3.1.5`<br>`9.0.5`<br>`9.0.9`<br>`10.2.6` | • `eslint / serve -> minimatch@3.1.5`<br>• `sucrase -> glob@10.4.5 -> minimatch@9.0.5`<br>• `glob@10.5.0 -> minimatch@9.0.9`<br>• `jest -> minimatch@10.2.6` | `9.x >=9.0.7` (9.0.5 affected by ReDoS advisory) | `minimatch@9.0.5` updated to `9.0.9` in `package-lock.json`. |
| **ansi-regex** | `4.1.1`<br>`5.0.0`<br>`5.0.1`<br>`6.1.0 / 6.3.0` | • `ora -> strip-ansi@5.2.0 -> ansi-regex@4.1.1`<br>• `react-native -> ansi-regex@5.0.0`<br>• `eslint -> strip-ansi -> ansi-regex@5.0.1`<br>• `serve -> strip-ansi -> ansi-regex@6.3.0` | `5.x >=5.0.1` (4.1.1 and 5.0.0 affected by ReDoS GHSA-93q8-gq69-wqmw) | `ansi-regex@5.0.0` updated/deduplicated to `5.0.1` in `package-lock.json`. |

---

## 3. Implementation Step-by-Step Instructions

1. **Update `tsconfig.json`**:
   - Open `tsconfig.json`.
   - Add `"ignoreDeprecations": "6.0"` inside `compilerOptions`.
   - Update `"paths": { "@/*": ["./src/*"] }`.
   - Remove `"baseUrl": "."`.

2. **Update `package.json`**:
   - Update `"axios": "^0.28.0"` to `"axios": "^1.7.9"`.

3. **Execute Dependency Resolution & Audit Fixes**:
   - Run `npm audit fix` to automatically resolve fixable transitive vulnerabilities across `@babel/runtime`, `js-yaml`, `simple-plist`/`plist`/`xmldom`, `brace-expansion`, `glob`, `minimatch`, and `ansi-regex`.
   - Run `npm install` to ensure lockfile synchronization.

4. **Verify Dependency Tree**:
   - Execute `npm ls axios form-data js-yaml plist simple-plist xmldom @babel/helpers @babel/runtime brace-expansion glob minimatch ansi-regex` to verify all 12 packages meet safe target versions.

---

## 4. Required Validation Commands

The implementation agent must run and pass all of the following commands:

```bash
# 1. Type Check Validation
npx tsc --noEmit

# 2. Test Suite Execution
npm test

# 3. Prebuild / Expo Configuration Validation
npm run prebuild:check

# 4. Lint Check
npm run lint

# 5. Security Audit Verification
npm audit

# 6. Dependency Graph Verification
npm ls axios form-data js-yaml plist simple-plist xmldom @babel/helpers @babel/runtime brace-expansion glob minimatch ansi-regex
```
