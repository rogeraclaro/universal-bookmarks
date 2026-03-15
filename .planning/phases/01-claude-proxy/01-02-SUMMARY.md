---
phase: 01-claude-proxy
plan: 02
subsystem: infra
tags: [express, cors, node, spawn, launchagent, plist, proxy]

# Dependency graph
requires:
  - phase: 01-01
    provides: Wave 0 test scaffold (proxy.test.mjs, mock-claude.sh, test-install.sh)
provides:
  - Express HTTP proxy server on port 3838 with /categorize and /process-tweet routes
  - createApp({claudeBin, claudeTimeout, port}) factory returning http.Server
  - getChildEnv(input) stripping CLAUDECODE and CLAUDE_CODE_ENTRYPOINT
  - macOS LaunchAgent plist template with placeholder substitution
  - install.sh for one-time LaunchAgent setup per Mac
affects: [01-03, 01-04]

# Tech tracking
tech-stack:
  added: [express@4.21.x, cors@2.8.x]
  patterns:
    - "createApp factory returns http.Server (not Express app) — enables server.close() in tests"
    - "spawn with stdio:['ignore','pipe','pipe'] — stdin:ignore prevents claude -p hang"
    - "isMain check via process.argv[1] === fileURLToPath(import.meta.url) for ESM"
    - "Plist placeholder substitution via sed — __HOME__, __PROXY_DIR__, __NODE_BIN__"

key-files:
  created:
    - proxy/server.js
    - proxy/package.json
    - proxy/package-lock.json
    - proxy/com.ailinks.claude-proxy.plist
    - proxy/install.sh
  modified: []

key-decisions:
  - "createApp returns http.Server (not Express app): tests call server.close() for cleanup, so factory must .listen() and return the server object"
  - "Fallback title uses rawText.slice(0, 80) not substring(0,77)+'...': test asserts exact 80-char slice"
  - "spawn stdio:['ignore','pipe','pipe'] not execFile: stdin must be closed or claude -p waits forever"
  - "LaunchAgent PATH includes both /usr/local/bin and /opt/homebrew/bin: supports Intel and Apple Silicon Homebrew"

patterns-established:
  - "Proxy factory pattern: createApp returns already-listening http.Server for hermetic test lifecycle"
  - "Child process isolation: getChildEnv strips Claude Code session vars to prevent nested-session errors"

requirements-completed: [PROXY-01, PROXY-02, PROXY-03]

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 1 Plan 02: Proxy Server Summary

**Express proxy server spawning claude CLI via child process with graceful fallbacks, plus macOS LaunchAgent for auto-start at login — all 8 TDD tests GREEN**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-15T01:29:48Z
- **Completed:** 2026-03-15T01:31:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- proxy/server.js implements createApp factory returning http.Server, getChildEnv stripping env vars, /categorize and /process-tweet routes with fallback on any claude failure
- All 8 Wave 0 tests turned GREEN (from RED in Plan 01)
- LaunchAgent plist with placeholder tokens + install.sh with sed substitution and launchctl load
- test-install.sh returns PASS (upgraded from SKIP in Plan 01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create proxy server (server.js + package.json + npm install)** - `28aa9f0` (feat)
2. **Task 2: Create LaunchAgent plist + install.sh** - `2f6f7d8` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `proxy/server.js` - Express HTTP server; createApp factory, getChildEnv, /categorize + /process-tweet with spawn-based claude invocation and graceful fallbacks
- `proxy/package.json` - Node package manifest with express + cors deps, ESM type, test script
- `proxy/package-lock.json` - Lockfile for reproducible installs
- `proxy/com.ailinks.claude-proxy.plist` - LaunchAgent plist template with __HOME__, __PROXY_DIR__, __NODE_BIN__ placeholders; KeepAlive + RunAtLoad enabled
- `proxy/install.sh` - One-time setup script: sed substitution of plist placeholders + launchctl load

## Decisions Made

- `createApp` returns `http.Server` not Express `app`: the tests do `server.close()` in `after()` hooks, so the factory must call `.listen()` internally and return the server object. The plan template showed `createApp` returning the app, but the test contract is authoritative.
- Fallback title uses `rawText.slice(0, 80)` not `substring(0, 77) + '...'`: the test asserts `body.title === tweetText.slice(0, 80)` with an exact 80-char slice — no ellipsis.
- `export default` omitted from module level: the plan template included `export default createApp()` which would start a second server on port 3838 every time the module is imported in tests. Omitted to avoid port conflicts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] createApp must return http.Server, not Express app**
- **Found during:** Task 1 (reading test contract before coding)
- **Issue:** Plan template had `createApp` not calling `.listen()` and returning the Express `app`. Tests call `server.close(resolve)` in `after()` — requires an `http.Server` object.
- **Fix:** `createApp` calls `app.listen(port, 'localhost')` and returns the resulting `http.Server`.
- **Files modified:** proxy/server.js
- **Verification:** All 8 tests pass including teardown
- **Committed in:** 28aa9f0

**2. [Rule 1 - Bug] Fallback title must be exact 80-char slice, no ellipsis**
- **Found during:** Task 1 (reading test assertion)
- **Issue:** Plan showed `rawText.substring(0, 77) + '...'`; test asserts `body.title === tweetText.slice(0, 80)` — exact match, no ellipsis.
- **Fix:** Use `rawText.slice(0, 80)` in fallback handler.
- **Files modified:** proxy/server.js
- **Verification:** Fallback test asserts exact equality and passes
- **Committed in:** 28aa9f0

**3. [Rule 1 - Bug] Removed export default createApp() at module level**
- **Found during:** Task 1 (analyzing test isolation)
- **Issue:** Plan template included `export default createApp()` unconditionally — this would spawn a server on port 3838 every time server.js is imported (including in tests), causing port conflicts.
- **Fix:** Omitted the module-level `export default`; isMain guard already handles the listen-on-direct-run case.
- **Files modified:** proxy/server.js
- **Verification:** Tests run without port-already-in-use errors
- **Committed in:** 28aa9f0

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs in plan template vs test contract)
**Impact on plan:** All fixes required for tests to pass. No scope creep. Test contract took precedence over plan template as specified in plan interfaces section.

## Issues Encountered

None — plan executed cleanly once test contract was analyzed before coding.

## User Setup Required

**One-time manual step per Mac:** Run `bash proxy/install.sh` to register the LaunchAgent. This:
1. Substitutes actual paths into the plist
2. Copies to ~/Library/LaunchAgents/
3. Loads via launchctl (proxy starts immediately and on every login)

## Next Phase Readiness

- Proxy server is fully functional and tested
- Plans 03 and 04 can call http://localhost:3838/categorize and /process-tweet
- LaunchAgent setup is ready for one-time activation
- No blockers

---
*Phase: 01-claude-proxy*
*Completed: 2026-03-15*
