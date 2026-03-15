---
phase: 01-claude-proxy
plan: 03
subsystem: api
tags: [vitest, typescript, fetch, claude-proxy, react]

# Dependency graph
requires:
  - phase: 01-01
    provides: proxy server contract (POST /process-tweet endpoint)
  - phase: 01-02
    provides: running proxy server at localhost:3838
provides:
  - claudeService.ts as drop-in replacement for geminiService.ts using fetch to proxy
  - vitest test suite (5 tests) for claudeService
  - App.tsx wired to claudeService, Gemini/TrialCountdown removed
affects:
  - 01-04
  - future UI phases referencing tweet import pipeline

# Tech tracking
tech-stack:
  added: [vitest]
  patterns: [fetch-with-AbortSignal-timeout, proxy-fallback-bookmark, tdd-red-green-vitest]

key-files:
  created:
    - src/services/claudeService.ts
    - src/services/claudeService.test.ts
  modified:
    - src/App.tsx
    - vite.config.ts
    - package.json
    - .env (gitignored — VITE_CLAUDE_PROXY_URL added locally)

key-decisions:
  - "vite.config.ts test.include scoped to src/**/*.test.ts — prevents vitest picking up proxy/test/proxy.test.mjs (node:test format)"
  - "claudeService uses (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLAUDE_PROXY_URL) guard for test compatibility"
  - "Fallback bookmark has no isAI field — matches actual ProcessedTweetResult type in types.ts (plan's interface block had isAI but types.ts does not)"

patterns-established:
  - "Test include pattern: restrict vitest to src/**/*.test.ts to coexist with node:test files in proxy/"
  - "Proxy fallback: on all retries exhausted, create fallback bookmark with categories:['Altres'] and no AI-enrichment"

requirements-completed: [AI-01, AI-02, AI-04]

# Metrics
duration: 8min
completed: 2026-03-15
---

# Phase 1 Plan 03: claudeService + App.tsx Wiring Summary

**claudeService.ts fetch-based drop-in for geminiService.ts: POST /process-tweet via AbortSignal timeout, 3-retry fallback, 5 vitest tests, App.tsx Gemini references removed**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T02:34:00Z
- **Completed:** 2026-03-15T02:42:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created `claudeService.ts` with identical TypeScript signature to `geminiService.ts`, calling proxy via fetch with AbortSignal.timeout(90000) and 3-retry fallback
- Created `claudeService.test.ts` with 5 vitest tests: export check, success path, fallback path, abort signal, empty input — all pass
- Installed vitest, configured `vite.config.ts` with node environment and src-scoped include, added `test` script to package.json
- Updated `src/App.tsx` surgically: swapped geminiService import, removed TrialCountdown import and JSX, replaced function call name
- Added `VITE_CLAUDE_PROXY_URL=http://localhost:3838` to .env (gitignored)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install vitest + create claudeService.ts with tests** - `91dd364` (feat)
2. **Task 2: Wire App.tsx to claudeService + add env var** - `b699b5d` (feat)

**Plan metadata:** (final docs commit)

_Note: Task 1 used TDD — test written first (RED: 5 failures), then implementation (GREEN: 5 passes)_

## Files Created/Modified
- `src/services/claudeService.ts` - Proxy-based tweet processing service, drop-in for geminiService
- `src/services/claudeService.test.ts` - 5 vitest tests covering success, fallback, abort, empty input, export
- `src/App.tsx` - Import swapped to claudeService, TrialCountdown removed
- `vite.config.ts` - Added vitest config with node environment and src include pattern
- `package.json` - Added test script and vitest devDependency
- `.env` - Added VITE_CLAUDE_PROXY_URL locally (gitignored, not committed)

## Decisions Made
- Scoped `vite.config.ts` `test.include` to `src/**/*.test.ts` to prevent vitest picking up `proxy/test/proxy.test.mjs` which uses node:test format (would cause "No test suite found" failure)
- Used `(typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLAUDE_PROXY_URL)` guard so the module works in both browser (Vite) and Node.js (vitest) environments
- Fallback bookmark does not include `isAI` field — the plan's context interfaces block listed it, but `src/types.ts` `ProcessedTweetResult` does not have it; used actual types.ts as truth

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scoped vitest include to prevent node:test file pickup**
- **Found during:** Task 1 (npm test run after claudeService creation)
- **Issue:** vitest discovered `proxy/test/proxy.test.mjs` which uses `node:test` format and has no vitest `describe`/`it` blocks — caused "No test suite found" failure, blocking `npm test` from passing
- **Fix:** Added `include: ['src/**/*.test.ts']` to vitest config in `vite.config.ts`
- **Files modified:** vite.config.ts
- **Verification:** `npm test` runs cleanly with 5/5 passing, proxy.test.mjs not picked up
- **Committed in:** 91dd364 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix necessary for `npm test` success criteria. No scope creep.

## Issues Encountered
- `import.meta.env` is undefined in vitest Node.js environment — resolved by using optional chaining guard so the proxy URL falls back to hardcoded `'http://localhost:3838'` in test context

## User Setup Required
None — `VITE_CLAUDE_PROXY_URL=http://localhost:3838` was added to local `.env` (gitignored). The value is also hardcoded as fallback in `claudeService.ts`.

## Next Phase Readiness
- Tweet import pipeline wired to Claude proxy — ready for end-to-end testing
- `npm test` passes cleanly (5/5 claudeService tests)
- `tsc --noEmit` exits 0
- App.tsx has no remaining references to geminiService or TrialCountdown
- Phase 1 plan 03 of 04 complete — one plan remaining in this phase

---
*Phase: 01-claude-proxy*
*Completed: 2026-03-15*
