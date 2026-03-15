---
phase: 02-chrome-tabs-feature
plan: 02
subsystem: ui
tags: [react, chrome-extension, tabs, tailwind]

# Dependency graph
requires:
  - phase: 02-chrome-tabs-feature
    plan: 01
    provides: tabsUtils.ts, types.ts (TabItem, TabSaveStatus, TabGroupInfo), config.ts (UI_STRINGS tabs entries)
provides:
  - Popup opens to tabs view by default (loadTabsData on mount, viewState='tabs')
  - All open Chrome tabs listed with favicon, group border, already-saved badge
  - Group filter pill bar (shown only when tabs have groups)
  - Select-all header checkbox toggles visible selectable tabs
  - Per-tab checkboxes with disabled state for already-saved tabs
  - Confirm dialog before bulk save trigger
  - 'Guardar aquesta pagina' link switches to single-save form view
  - manifest.json has tabs, tabGroups, favicon permissions
affects:
  - 02-03 (handleBulkSave stub ready for full implementation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Tabs view as default popup view (not form view) — loadTabsData() called on mount
    - filterTabsByGroup / hasGroups / selectAllVisible / deselectAllVisible from tabsUtils
    - GROUP_COLOR_MAP drives border-l-4 color classes for grouped tabs
    - Favicon with letter-avatar fallback on onError

key-files:
  created: []
  modified:
    - extension/manifest.json
    - extension/popup/popup.tsx
    - extension/background/service-worker.ts

key-decisions:
  - "Trim imports to only what is used in Plan 02 (buildTabBookmark, getTabSaveSummary, resolveAuthorFromUrl deferred to Plan 03) — noUnusedLocals:true blocks build otherwise"
  - "tabStatuses/tabSaveResults state vars kept with void references in handleBulkSave stub — used in Plan 03 full impl"
  - "Rule 3 auto-fix: SAVE_CATEGORY -> ADD_CATEGORY in service-worker.ts and popup.tsx to match Message type union and unblock build"

patterns-established:
  - "Tabs view is the popup default: useEffect calls loadTabsData(), setViewState('tabs')"
  - "handleBulkSave stub pattern: reference unused state vars with void to satisfy noUnusedLocals"

requirements-completed: [TABS-01, TABS-02, TABS-03]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 02 Plan 02: Tabs View UI Summary

**React popup rewritten to default to tabs view: lists all open Chrome tabs with group filter pills, favicon+letter-avatar, colored group borders, select-all, and already-saved badges**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-15T10:16:58Z
- **Completed:** 2026-03-15T10:20:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Popup now opens to tabs view by default (loadTabsData on mount, viewState='tabs')
- Full tabs view rendered: header with 'Guardar aquesta pagina' link, group filter bar, select-all header, scrollable tab list, save/confirm footer
- Per-tab rows: favicon with letter-avatar fallback, colored left border for grouped tabs, disabled+greyed state for already-saved tabs with badge
- manifest.json updated with tabs, tabGroups, favicon permissions required by Chrome APIs
- All 17 existing tests continue to pass (no regressions)

## Task Commits

1. **Task 1: Add tabs types to manifest and new state to popup** - `84cfe93` (feat)
2. **Task 2: Render tabs view, group filter, select-all, and per-tab rows** - `2866a5d` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `extension/manifest.json` - Added tabs, tabGroups, favicon permissions
- `extension/popup/popup.tsx` - Rewritten: loadTabsData(), tabs state, full tabs view JSX, handleBulkSave stub
- `extension/background/service-worker.ts` - Fixed SAVE_CATEGORY -> ADD_CATEGORY (Rule 3 auto-fix)

## Decisions Made

- Trimmed imports to only what Plan 02 uses (deferring `buildTabBookmark`, `getTabSaveSummary`, `resolveAuthorFromUrl` to Plan 03) because `noUnusedLocals: true` in tsconfig would block the build
- `tabStatuses`/`tabSaveResults` state kept with `void` references in `handleBulkSave` stub — these will be properly used when Plan 03 implements the full bulk save logic
- Kept original `newCategory`/`addingCategory` state variable names from the existing popup (not renamed to match reference) to minimize diff surface

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed SAVE_CATEGORY -> ADD_CATEGORY type mismatch blocking build**
- **Found during:** Task 2 (build verification step)
- **Issue:** `service-worker.ts` handled `message.type === 'SAVE_CATEGORY'` but the `Message` type union in `types.ts` only allows `ADD_CATEGORY`. TypeScript error blocked `npm run build` (which runs `tsc` first).
- **Fix:** Updated `service-worker.ts` handler and `popup.tsx` `handleAddCategory` to use `ADD_CATEGORY`
- **Files modified:** `extension/background/service-worker.ts`, `extension/popup/popup.tsx`
- **Verification:** `npm run build` succeeds; all 17 tests pass
- **Committed in:** `2866a5d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was necessary to complete build verification. No scope creep — aligns with the STATE.md decision already recorded ("SAVE_CATEGORY renamed to ADD_CATEGORY in Message type union — service-worker.ts updated in Plan 03") but pulled forward because it blocked the build.

## Issues Encountered

- `noUnusedLocals: true` in tsconfig required pruning imports to only what Plan 02 uses — the plan spec included all tabsUtils imports for forward compatibility, but TypeScript rejected unused ones. Solved by importing only the subset needed in this plan's code.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Tabs view is fully rendered and build passes
- `handleBulkSave` stub is in place — Plan 03 implements the full sequential bulk save loop with Claude proxy categorization and tabs-saving/tabs-summary view states
- Chrome extension can be loaded in Chrome for visual verification (Plan 03 checkpoint)

---
*Phase: 02-chrome-tabs-feature*
*Completed: 2026-03-15*
