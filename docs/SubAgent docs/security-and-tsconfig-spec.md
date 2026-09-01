# Security and TypeScript configuration analysis

**Scope:** research only; no manifests or source files were changed. Lockfile/package data was inspected on 2026-09-01. Versions below are the resolved versions in `package-lock.json` (lockfile v3), not merely the ranges in `package.json`.

## tsconfig.json

`compilerOptions.baseUrl` is present and set to `"."` (line 13), alongside `paths: { "@/*": ["src/*"] }`. `baseUrl` is deprecated in modern TypeScript (the option is scheduled for deprecation/removal guidance and is unnecessary when path mappings are rooted explicitly). The alias can be retained without `baseUrl` under current bundler resolution by changing the mapping to `"@/*": ["./src/*"]` (verify Expo/Metro and Jest alias handling before removal). Recommended surgical change:

```json
"paths": {
  "@/*": ["./src/*"]
}
```

then remove `"baseUrl": "."`. Run `npx tsc --noEmit`, the existing Jest suite, and a web/native build/prebuild check. If the toolchain still requires `baseUrl`, keep it temporarily and document the exception; do not replace it with an unrelated compiler setting.

## Resolved vulnerable packages and paths

| Package | Resolved version(s) | Dependency path / status | Applicable safe target |
|---|---:|---|---|
| `axios` | 0.28.0 | Direct root dependency (`^0.28.0`); brings root `form-data` | Upgrade to `axios@^1.20.0` (latest and npm audit fix target). This is a major upgrade; inspect interceptors, error typing, URL/proxy behavior, and browser/native adapters. |
| `form-data` | 4.0.2 | `axios@0.28.0 -> form-data@^4.0.0` | `>=4.0.6` (latest 4.0.6). Fixes unsafe boundary randomness and CRLF injection. It should be updated with axios or pinned via a lockfile refresh. |
| `js-yaml` | 4.3.2; 3.14.0; 3.15.2 | Root `js-yaml@4.3.2`; Jest/Istanbul `@istanbuljs/load-nyc-config -> js-yaml@3.14.0`; `cosmiconfig -> js-yaml@3.15.2` | For 3.x, `>=3.15.1` is the minimum range covering the current merge/DoS advisories (3.15.2 is already beyond it). Prefer latest compatible 4.x or `5.4.1` only after checking consumers; do not force 5.x into Jest tooling without testing. Current 4.3.2 is not reported by this audit for the listed advisories. |
| `plist` | 3.0.1 | `simple-plist@1.1.1 -> plist@^3.0.1`; ultimately Expo config plugins/xcode | `>=3.0.5`; preferably `3.1.1` (or 4/5 if all consumers support it). `3.1.1` switches to `@xmldom/xmldom`, eliminating the old vulnerable xmldom edge. |
| `simple-plist` | 1.1.1 | `xcode@3.0.1 -> simple-plist@^1.1.0` (Expo config plugin chain) | `>=1.3.1` (latest 1.x safe release). This range is accepted by xcode's existing `^1.1.0` constraint; refresh lockfile and verify Expo prebuild. |
| `xmldom` | 0.1.31 | `plist@3.0.1 -> xmldom@0.1.x` | All `xmldom` releases through 0.6.0 are affected by the listed XML parsing/injection/recursion advisories. Do not upgrade only to `xmldom@0.6.0`; migrate the chain to `plist@>=3.1.1`, which uses `@xmldom/xmldom@^0.9.10`. If a direct XML consumer exists, migrate it to maintained `@xmldom/xmldom` and test API compatibility. |
| `@babel/helpers` | 7.29.7 | Transitive `@babel/core@7.29.7 -> @babel/helpers@^7.29.7`; no direct audit finding | No listed vulnerability currently applies to 7.29.7. Keep aligned with `@babel/core`; do not independently force Babel 8. If Babel is upgraded, use the same compatible 7.x release family. |
| `@babel/runtime` | 7.26.7 | Transitive from `@expo/cli@0.24.24 -> @babel/runtime@^7.20.0` | `>=7.26.10` (latest 7.x is safe for GHSA-968p-4wvh-cqc8). Prefer an Expo CLI/SDK update that resolves it; otherwise a compatible npm override may be considered and must be tested. Avoid Babel 8 for Expo 53. |
| `brace-expansion` | 1.1.11; 2.0.1; 2.1.4; 5.0.9 | Root 1.1.11 via `glob@7.2.3`; Expo and Jest nested copies; 2.0.1 under sucrase; 2.1.4 under Expo; 5.0.9 under Jest | 1.x: `>=1.1.18`; 2.x: `>=2.1.4`; 5.x is current safe. Refresh transitive ranges/lockfile; use overrides only if required, because major versions are not interchangeable. |
| `glob` | 7.2.3; 10.4.5/10.5.0; 13.0.6 | Root 7.2.3 (`glob -> minimatch@^3.1.1`); Expo/Jest nested 10.x; Jest nested 13.x | CLI command-injection advisory affects `10.2.0–10.4.5`; `10.5.0` is the minimum safe 10.x. Keep 7.2.3 unless another advisory requires a major migration; upgrade the parent package rather than forcing glob 13 into Expo/Jest. |
| `minimatch` | 3.1.5; 9.0.5/9.0.9; 10.2.6 | Root glob 7 path has 3.1.5; Expo paths 9.0.9; Jest paths 10.2.6 | 9.x minimum `9.0.7`; current 9.0.9 and 10.2.6 are safe for listed ReDoS advisories. Keep 3.1.5 unless a separate advisory is identified; update old parents/lockfile rather than cross-major overrides. |
| `ansi-regex` | 4.1.1; 5.0.0/5.0.1; 6.1.0/6.3.0 | Root 5.0.0; nested versions from ora, strip-ansi, chalk/CLI tooling | 5.x minimum `5.0.1`; current 6.x is safe. Update root/transitive parent ranges as applicable; do not force v6 where a package requires v5. |

## Action plan

1. Remove `baseUrl` and make the `@/*` path explicitly `./src/*`, then run the validation commands above.
2. Upgrade direct `axios` to `^1.20.0`; regenerate `package-lock.json` with the repository's package manager. Confirm `form-data` resolves to `4.0.6+`.
3. Upgrade the Expo config-plugin chain (or at minimum refresh compatible transitive versions) so `simple-plist >=1.3.1`, `plist >=3.1.1`, and `@xmldom/xmldom >=0.9.10` replace `xmldom@0.1.31`. Validate `npm run prebuild:check`.
4. Refresh Jest/Babel/tooling dependencies to resolve `@babel/runtime >=7.26.10`, `brace-expansion` minimums, `glob >=10.5.0` where 10.x is used, `minimatch >=9.0.7` where 9.x is used, and `ansi-regex >=5.0.1`.
5. Re-run `npm audit --omit=optional` (and normal `npm audit` if CI audits dev dependencies), `npm ls` for every package in this document, tests, lint, and the relevant build/prebuild checks. Review any remaining findings separately; do not claim that a package is fixed merely because a different nested copy upgraded.

The exact lockfile changes must be generated by the package manager (`npm install`/targeted `npm update`), not hand-edited, so integrity hashes and dependency edges remain consistent.
