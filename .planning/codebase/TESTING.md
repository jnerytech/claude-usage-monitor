# Testing Patterns

**Analysis Date:** 2026-04-26

## Test Framework

**Runner:** None — no test framework is configured or installed.

**Assertion Library:** None

**Run Commands:**
```bash
# No test commands configured in package.json
# "scripts" in package.json contains only: start, build, icons
```

## Test File Organization

**Location:** No test files exist in the project source. The only `*.test.*` and `*.spec.*` files are inside `node_modules/` (third-party packages).

**Coverage target:** None enforced.

## Current Testing State

This project has **zero automated tests**. There is no:
- Unit test suite
- Integration test suite
- E2E test suite
- Test runner config (`jest.config.*`, `vitest.config.*`, `playwright.config.*`)
- Test directory (`test/`, `__tests__/`, `spec/`)
- Test-related `devDependencies` (no jest, vitest, mocha, playwright, etc.)

The `package.json` scripts section confirms no test command:
```json
"scripts": {
  "start": "electron .",
  "build": "electron-builder",
  "icons": "node scripts/gen-icons.js"
}
```

## Manual Verification Approach

The codebase relies entirely on manual testing. The following functions contain logic that would benefit most from automated tests:

**`parseResetMins(text)` in `main.js` (lines 307–317):**
- Pure function — parses time strings like "in 2 hr 24 min", "in 3 hr", "in 45 min", "in 2 days"
- Returns minutes as integer or `null`
- Zero external dependencies — easiest to unit test

**`parseResetDate(resetAt, text)` in `renderer/app.js` (lines 299–327):**
- Pure function — similar time parsing but returns a `Date` object
- Handles ISO datetime strings and natural language
- Zero external dependencies — easy to unit test

**`checkAlerts(items, settings)` in `main.js` (lines 319–363):**
- Contains the alert threshold, near-reset, plan-reset, and spike logic
- Depends on `alertState` module-level variable (stateful side effect)
- Would need state reset between test cases

**`pctClass(pct)` in `renderer/app.js` (lines 132–136):**
- Pure function returning `'high'`, `'medium'`, or `'low'`
- Trivial to unit test

**`esc(str)` in `renderer/app.js` (lines 169–173):**
- Pure HTML escaping function
- Trivial to unit test

**`formatTimeRemaining(ms)` in `renderer/app.js` (lines 329–337):**
- Pure function — formats milliseconds to human-readable string
- Trivial to unit test

## Recommended Test Setup (if tests are added)

Based on project structure (plain Node.js/Electron, no bundler, no TypeScript), the lowest-friction option would be:

```bash
npm install --save-dev vitest
```

Add to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Pure utility functions (`parseResetMins`, `parseResetDate`, `pctClass`, `esc`, `formatTimeRemaining`) can be extracted to a shared module and tested without Electron. Electron-specific code (IPC handlers, window management) requires mocking or an Electron test harness.

## What Would Need to Be Extracted for Testability

Currently, all pure functions live inside files that also contain side-effectful initialization code (DOM queries at module load time in `renderer/app.js`, module-level singletons in `main.js`). To make them testable:

1. Extract pure utility functions to `src/utils.js` or similar
2. Export them with `module.exports`
3. Import in `main.js` / `renderer/app.js`

This is a prerequisite for any unit test coverage.

---

*Testing analysis: 2026-04-26*
