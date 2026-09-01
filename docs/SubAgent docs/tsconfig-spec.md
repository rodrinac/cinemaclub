# Spec and Analysis for tsconfig.json and Package Configuration

## 1. Overview & Analysis

### tsconfig.json Analysis
- **Previous HEAD State:**
  ```json
  {
    "compilerOptions": {
      "allowSyntheticDefaultImports": true,
      "jsx": "react-native",
      "lib": ["ESNext.Array", "dom", "esnext", "es2023"],
      "module": "esnext",
      "moduleResolution": "bundler",
      "noEmit": true,
      "skipLibCheck": true,
      "resolveJsonModule": true,
      "strict": true,
      "target": "ES2023",
      "baseUrl": ".",
      "paths": {
        "@/*": ["src/*"]
      }
    },
    "extends": "expo/tsconfig.base"
  }
  ```
- **Prior Implementation Issues:**
  - Removed `"baseUrl": "."`.
  - Changed `"@/*": ["src/*"]` to `"@/*": ["./src/*"]`.
  - Expanded formatting of `lib` and `paths` arrays.
- **Desired Target State:**
  Preserve all original `compilerOptions` from HEAD (`baseUrl`, `@/*` mapping as `src/*`, etc.) and ONLY add `"ignoreDeprecations": "6.0"` with 2-space indentation.

---

## 2. Target Content for tsconfig.json

```json
{
  "compilerOptions": {
    "allowSyntheticDefaultImports": true,
    "jsx": "react-native",
    "lib": ["ESNext.Array", "dom", "esnext", "es2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "strict": true,
    "target": "ES2023",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "ignoreDeprecations": "6.0"
  },
  "extends": "expo/tsconfig.base"
}
```

---

## 3. Verification of package.json and package-lock.json Changes

### package.json Changes
- **Updated Dependencies:**
  - `axios`: `^0.28.0` -> `^1.20.0`
  - Added Expo libraries: `expo-asset` (`~11.1.7`), `expo-constants` (`~17.1.8`), `expo-font` (`~13.3.2`)
- **Added devDependencies:**
  - Testing & DB packages: `@playwright/test`, `@types/better-sqlite3`, `@types/jest`, `better-sqlite3`, `jest`, `serve`, `ts-jest`
- **Added Scripts:**
  - `"test"`: `"jest"`
  - `"test:ci"`: `"jest --ci && playwright test"`
  - `"build:web"`: `"expo export --platform web"`
  - `"prebuild:check"`: `"expo prebuild --clean --no-install"`

### package-lock.json Changes
- Updated lockfile entries reflecting dependency additions/upgrades.

### npm audit Status
- **Vulnerabilities Found:** 27 total (18 moderate, 9 high)
  - `decode-uri-component` (moderate)
  - `image-size` (high)
  - `lodash.pick` (high)
  - `postcss` (high)
  - `uuid` (moderate)
- **Status:** Requires breaking major package updates (`expo`, `react-native`, `react-native-vector-icons`) if forced via `npm audit fix --force`.

---

## 4. Required Validation Commands

- **npm audit:** `npm audit`
- **Linting & Formatting:** `npm run lint` and `npx prettier --check tsconfig.json`
- **Type checking:** `npx tsc --noEmit`
- **Tests:** `npm test`

