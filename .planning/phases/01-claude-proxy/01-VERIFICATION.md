---
phase: 01-claude-proxy
verified: 2026-03-15T10:32:00Z
status: gaps_found
score: 18/21 must-haves verified
re_verification: false
gaps:
  - truth: "Running `cd proxy && node server.js` starts without error and logs 'Claude proxy listening on http://localhost:3838'"
    status: failed
    reason: "proxy/server.js DEFAULT_PORT is 3839, not 3838 as specified. The server logs 'http://localhost:3839'. Plan 02 specified port 3838 for PROXY-02."
    artifacts:
      - path: "proxy/server.js"
        issue: "Line 6: `const DEFAULT_PORT = 3839;` — should be 3838"
    missing:
      - "Change DEFAULT_PORT from 3839 to 3838 in proxy/server.js"

  - truth: "extension/manifest.json host_permissions includes 'http://localhost:3838/*'"
    status: failed
    reason: "manifest.json contains 'http://localhost:3839/*' instead of 'http://localhost:3838/*'"
    artifacts:
      - path: "extension/manifest.json"
        issue: "Line 26: `\"http://localhost:3839/*\"` — should be 3838"
    missing:
      - "Update host_permissions from 3839 to 3838 in extension/manifest.json"

  - truth: "extension/shared/config.ts exports CLAUDE_PROXY_URL = 'http://localhost:3838'"
    status: failed
    reason: "config.ts exports CLAUDE_PROXY_URL = 'http://localhost:3839' not 3838"
    artifacts:
      - path: "extension/shared/config.ts"
        issue: "Line 42: `export const CLAUDE_PROXY_URL = 'http://localhost:3839';` — should be 3838"
    missing:
      - "Update CLAUDE_PROXY_URL from 3839 to 3838 in extension/shared/config.ts"

  - truth: "When proxy returns 200 with a valid body, processBookmarksWithClaude returns ProcessedTweetResult[]"
    status: partial
    reason: ".env sets VITE_CLAUDE_PROXY_URL=http://localhost:3838 (correct), but claudeService.ts fallback hardcode is 'http://localhost:3839'. Web app will hit 3838 when env is loaded, but will silently hit wrong port if env var is missing."
    artifacts:
      - path: "src/services/claudeService.ts"
        issue: "Line 30: fallback hardcode is 'http://localhost:3839' — inconsistent with .env (3838) and plans (3838)"
    missing:
      - "Update fallback hardcode in claudeService.ts from 3839 to 3838"

human_verification:
  - test: "Start proxy and test /categorize endpoint end-to-end"
    expected: "curl POST to http://localhost:3838/categorize returns JSON with categories array (once port is corrected to 3838)"
    why_human: "Requires real Claude CLI session; hermetic tests use mock binary"
  - test: "Test web app tweet import pipeline with proxy running"
    expected: "Tweet import returns processed results with isAI, title, categories — or graceful fallback if proxy unreachable"
    why_human: "Real-time behavior and UI feedback cannot be verified programmatically"
  - test: "Test Chrome extension saving a bookmark with proxy running"
    expected: "Bookmark is saved with categories from Claude; saved without categories when proxy is off"
    why_human: "Extension popup UI and Chrome runtime behavior require manual testing"
  - test: "Test LaunchAgent auto-start at login"
    expected: "After `bash proxy/install.sh`, proxy starts automatically on next login and appears in `launchctl list | grep ailinks`"
    why_human: "Requires logout/login cycle and launchctl state check"
---

# Phase 01: Claude Proxy Verification Report

**Phase Goal:** Users can process bookmarks and tweets with Claude instead of Gemini, with the proxy auto-starting on Mac login
**Verified:** 2026-03-15T10:32:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `node --test proxy/test/proxy.test.mjs` exits with 8 passing tests | VERIFIED | Ran: 8 pass, 0 fail, 0 skip |
| 2 | Tests cover getChildEnv() removing CLAUDECODE and CLAUDE_CODE_ENTRYPOINT | VERIFIED | proxy.test.mjs lines 29-49 — 3 tests covering removal of both vars and preservation of HOME/PATH |
| 3 | Tests cover /categorize and /process-tweet routes returning correct JSON shape | VERIFIED | proxy.test.mjs lines 74-200 — success path tests for both routes |
| 4 | Tests cover fallback behavior when claude binary is unavailable | VERIFIED | proxy.test.mjs — ENOENT test (port 13839), timeout test (port 13840), fail test (port 13842) |
| 5 | `bash proxy/test/test-install.sh` exits 0 with PASS | VERIFIED | Ran: "PASS: plist substitution correct" |
| 6 | `cd proxy && node server.js` starts and logs "Claude proxy listening on http://localhost:3838" | FAILED | server.js DEFAULT_PORT=3839 — logs port 3839, not 3838 |
| 7 | POST http://localhost:3838/categorize returns {categories:[...]} | FAILED | Proxy listens on 3839; .env has 3838 — port mismatch across the stack |
| 8 | POST http://localhost:3838/process-tweet returns {originalId,isAI,title,categories,externalLinks} | FAILED | Same port mismatch; also `isAI` absent from ProcessedTweetResult type |
| 9 | When claude is unreachable, endpoints return graceful fallback with HTTP 200 | VERIFIED | server.js lines 114-117 and 135-141 implement graceful catch; tested by proxy tests |
| 10 | CLAUDECODE and CLAUDE_CODE_ENTRYPOINT stripped from child env | VERIFIED | getChildEnv() implemented and tested (8/8 pass) |
| 11 | `bash proxy/install.sh` copies plist with correct substitution | VERIFIED | test-install.sh PASS; install.sh exists, is executable, does sed substitution |
| 12 | plist has RunAtLoad+KeepAlive for auto-start at login | VERIFIED | plist lines 19-22: both true |
| 13 | All 8 tests in proxy/test/proxy.test.mjs pass GREEN | VERIFIED | Ran: 8 pass |
| 14 | claudeService.ts exports processBookmarksWithClaude with correct TypeScript signature | VERIFIED | claudeService.ts lines 23-29 — signature matches plan exactly |
| 15 | `tsc --noEmit` passes with no type errors | VERIFIED | Both web app and extension tsc --noEmit exit 0 |
| 16 | App.tsx imports from claudeService, not geminiService | VERIFIED | App.tsx line 19: `import { processBookmarksWithClaude } from './services/claudeService'` |
| 17 | TrialCountdown removed from App.tsx import and render tree | VERIFIED | No TrialCountdown import or JSX found in App.tsx |
| 18 | .env contains VITE_CLAUDE_PROXY_URL=http://localhost:3838 | VERIFIED | .env line 4 confirmed |
| 19 | processBookmarksWithClaude falls back gracefully when proxy unreachable | VERIFIED | claudeService.ts lines 83-94 — fallback created on all retries exhausted |
| 20 | extension/shared/config.ts exports CLAUDE_PROXY_URL = 'http://localhost:3838' | FAILED | Exports 'http://localhost:3839' — wrong port |
| 21 | callClaudeProxy in api.ts never throws, always resolves | VERIFIED | api.ts lines 116-119 — all catch paths return {categories:[]} |
| 22 | service-worker.ts SAVE_BOOKMARK handler calls callClaudeProxy before saving | VERIFIED | service-worker.ts lines 44-64 — callClaudeProxy called, enrichedBookmark merged |
| 23 | extension/manifest.json host_permissions includes 'http://localhost:3838/*' | FAILED | Contains 'http://localhost:3839/*' — wrong port |
| 24 | Extension TypeScript compiles with no errors | VERIFIED | extension/ tsc --noEmit exits 0 |

**Score:** 18/24 truths verified (3 failed on port, 1 partial on port inconsistency in fallback hardcode)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `proxy/test/proxy.test.mjs` | Unit + integration tests (Node built-in test runner) | VERIFIED | 183 lines, 8 tests covering getChildEnv, /categorize, /process-tweet |
| `proxy/test/mock-claude.sh` | Mock claude binary for hermetic tests | VERIFIED | Executable, branches on prompt content |
| `proxy/test/test-install.sh` | Smoke test for plist substitution | VERIFIED | Exits 0, PASS output |
| `proxy/server.js` | Express server on port 3838 with /categorize and /process-tweet | PARTIAL | Substantive implementation but DEFAULT_PORT=3839, not 3838 |
| `proxy/package.json` | Node package manifest (express, cors, ESM) | VERIFIED | type=module, correct deps |
| `proxy/com.ailinks.claude-proxy.plist` | LaunchAgent plist with __HOME__, __PROXY_DIR__, __NODE_BIN__ placeholders | VERIFIED | All 3 placeholder tokens present, RunAtLoad+KeepAlive=true |
| `proxy/install.sh` | One-time setup script with sed substitution + launchctl load | VERIFIED | Executable, sed substitution, launchctl load/unload |
| `src/services/claudeService.ts` | Drop-in replacement for geminiService.ts | PARTIAL | Correct signature and wiring; fallback hardcode is 3839 instead of 3838 |
| `src/services/claudeService.test.ts` | Vitest test suite (5 tests) | VERIFIED | 5 tests, all pass |
| `extension/shared/config.ts` | CLAUDE_PROXY_URL constant | PARTIAL | Constant exists but value is 3839, should be 3838 |
| `extension/shared/api.ts` | callClaudeProxy function | VERIFIED | Exported, uses CLAUDE_PROXY_URL, never throws |
| `extension/background/service-worker.ts` | SAVE_BOOKMARK enhanced with callClaudeProxy | VERIFIED | callClaudeProxy imported and called before saveBookmark |
| `extension/manifest.json` | host_permissions entry for localhost:3838 | FAILED | Entry is localhost:3839 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| proxy/test/proxy.test.mjs | proxy/server.js | dynamic import per test group | VERIFIED | `await import('../server.js')` in each describe block |
| proxy/server.js | claude binary | spawn with stdio ['ignore','pipe','pipe'] | VERIFIED | spawn(claudeBin, args, {stdio:['ignore','pipe','pipe'], cwd:'/tmp'}) |
| proxy/install.sh | ~/Library/LaunchAgents/plist | sed substitution + launchctl load | VERIFIED | sed with 3 placeholder replacements then launchctl load |
| src/services/claudeService.ts | http://localhost:3838/process-tweet | fetch POST | PARTIAL | Uses env var (3838 from .env) but fallback hardcode is 3839 |
| src/App.tsx | processBookmarksWithClaude | import from ./services/claudeService | VERIFIED | Line 19 import, line 393 call |
| extension/background/service-worker.ts | callClaudeProxy in extension/shared/api.ts | import from ../shared/api | VERIFIED | Line 1 imports callClaudeProxy, line 48 calls it |
| extension/shared/api.ts | http://localhost:3839/categorize | fetch with AbortSignal.timeout(10000) | PARTIAL | Wired correctly to CLAUDE_PROXY_URL constant, but constant value is 3839 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROXY-01 | 01-01, 01-02 | Proxy reads Claude Code CLI session token (uses `claude -p` subprocess) | VERIFIED | server.js spawns `claude` binary using system PATH; strips CLAUDECODE/CLAUDE_CODE_ENTRYPOINT env vars |
| PROXY-02 | 01-01, 01-02 | Local HTTP server on localhost:3838 accepts AI requests | FAILED | server.js listens on DEFAULT_PORT=3839, not 3838 |
| PROXY-03 | 01-02 | macOS LaunchAgent auto-start at login | VERIFIED | plist with RunAtLoad+KeepAlive=true; install.sh for setup |
| PROXY-04 | 01-01, 01-04 | Web app and extension call local proxy instead of Gemini | PARTIAL | Web app calls proxy via claudeService.ts (wired); extension calls proxy via callClaudeProxy (wired); but all components use port 3839 while .env specifies 3838 — port fragmentation across stack |
| AI-01 | 01-03 | claudeService.ts replaces geminiService.ts with same interface | VERIFIED | processBookmarksWithClaude exported with identical signature; App.tsx imports it |
| AI-02 | 01-03 | Tweet processing (categorization, Catalan title, isAI) via Claude | PARTIAL | Processing implemented via proxy; however ProcessedTweetResult type lacks `isAI` field, and claudeService.ts fallback omits isAI (type-safe but semantically incomplete per plan) |
| AI-03 | 01-04 | Chrome extension webpage categorization via Claude | VERIFIED | callClaudeProxy in api.ts + SAVE_BOOKMARK handler enrichment |
| AI-04 | 01-01, 01-03, 01-04 | Error handling and fallback when proxy unreachable | VERIFIED | All three layers (proxy server, claudeService.ts, callClaudeProxy) implement graceful fallback |

**Note on AI-03:** Plan 01-04 declares requirement AI-03. REQUIREMENTS.md maps AI-03 to Phase 3 in its traceability table, but the Phase 1 plans claim it. This is an inconsistency in REQUIREMENTS.md tracking — the implementation is complete in Phase 1.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| proxy/server.js | 6 | `DEFAULT_PORT = 3839` | Blocker | Proxy starts on wrong port — web app (.env=3838) and proxy are misaligned |
| src/services/claudeService.ts | 30 | Fallback hardcode `'http://localhost:3839'` | Warning | Fallback uses 3839 when env var absent, inconsistent with .env and plans |
| extension/shared/config.ts | 42 | `CLAUDE_PROXY_URL = 'http://localhost:3839'` | Blocker | Extension will call wrong port |
| extension/manifest.json | 26 | `"http://localhost:3839/*"` in host_permissions | Blocker | Extension lacks permission for correct port if changed to 3838 |

### Human Verification Required

#### 1. Proxy endpoint live test

**Test:** Start proxy with `cd proxy && node server.js` (after port correction), then `curl -s -X POST http://localhost:3838/categorize -H 'Content-Type: application/json' -d '{"url":"https://example.com","title":"Test AI article","description":"Machine learning"}'`
**Expected:** `{"categories":["IA","Eines"]}` or similar
**Why human:** Requires real Claude CLI session in a terminal outside Claude Code (CLAUDECODE env var must be absent)

#### 2. Tweet import pipeline end-to-end

**Test:** Run `npm run dev`, import a small tweet JSON file using the web app UI
**Expected:** Tweets are processed with isAI, title, categories populated; if proxy not running, fallback bookmarks created with categories: ['Altres']
**Why human:** Real-time progress/log UI and actual Claude output cannot be verified programmatically

#### 3. Chrome extension save with proxy

**Test:** Build extension (`cd extension && npm run build`), load unpacked in Chrome from `extension/dist`, open any webpage, click extension icon, fill form, save
**Expected:** Bookmark saved with Claude-assigned categories (proxy running) or saved without categories (proxy off) — no error shown to user
**Why human:** Chrome extension runtime, popup UI, and network flow require browser testing

#### 4. LaunchAgent auto-start

**Test:** Run `bash proxy/install.sh`, then check `launchctl list | grep ailinks`
**Expected:** Entry shown with PID (running) and exit code 0
**Why human:** Requires launchctl system interaction and log inspection

### Gaps Summary

The implementation is functionally complete with all tests passing (8/8 proxy tests, 5/5 vitest), both TypeScript compilations clean, and all wiring in place. However, there is a **systemic port inconsistency** across the stack: the plans specify port 3838 throughout, but the implementation uses port 3839 in all three components that were built after the .env was created.

**Root cause:** The .env was written with 3838 (Plan 01-03 Task 2) but proxy/server.js (Plan 01-02) was written with DEFAULT_PORT=3839, and the extension files (Plan 01-04) followed the proxy's port. This created a three-way split: .env=3838, server=3839, extension=3839.

**Impact:** The web app will call port 3838 (from .env) but the proxy listens on 3839 — tweet processing will fail until the env var is loaded AND the proxy is on the correct port. The extension consistently calls 3839 (config.ts constant), so extension and proxy are aligned but both wrong per spec.

**Required fixes (all in the same root-cause correction):**
1. `proxy/server.js` line 6: `DEFAULT_PORT = 3839` → `3838`
2. `extension/shared/config.ts` line 42: `CLAUDE_PROXY_URL = 'http://localhost:3839'` → `3838`
3. `extension/manifest.json` line 26: `"http://localhost:3839/*"` → `"http://localhost:3838/*"`
4. `src/services/claudeService.ts` line 30: fallback hardcode `'http://localhost:3839'` → `3838`

**Secondary issue:** `ProcessedTweetResult` type in `src/types.ts` lacks the `isAI` field that the proxy returns. The fallback object in `claudeService.ts` also omits it. While TypeScript compiles cleanly (type is permissive), the `isAI` field from proxy responses will not surface in the web app if `ProcessedTweetResult` does not declare it.

---

_Verified: 2026-03-15T10:32:00Z_
_Verifier: Claude (gsd-verifier)_
