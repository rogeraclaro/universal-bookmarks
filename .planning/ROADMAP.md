# Roadmap: Universal Bookmarks

## Overview

Port of ai-bookmarks v1.0 (shipped 2026-03-14). Replace Gemini with Claude via a local proxy server, add Chrome Tabs bulk-save feature, wire single-save to Claude, then clean the Gemini dead code. All implementation is known and proven from the reference project.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Claude Proxy** - Build local proxy server and replace Gemini with Claude across the full stack (completed 2026-03-15)
- [x] **Phase 2: Chrome Tabs Feature** - Add bulk tab selection and AI categorization to the extension popup (completed 2026-03-15)
- [ ] **Phase 3: Fix Single-Save** - Wire single-page save from extension to Claude for categorization
- [ ] **Phase 4: Tech Debt Cleanup** - Remove Gemini dead code, uninstall @google/genai, clean stale strings

## Phase Details

### Phase 1: Claude Proxy
**Goal**: Users can process bookmarks and tweets with Claude instead of Gemini, with the proxy auto-starting on Mac login
**Depends on**: Nothing (first phase)
**Requirements**: PROXY-01, PROXY-02, PROXY-03, PROXY-04, AI-01, AI-02, AI-04
**Success Criteria** (what must be TRUE):
  1. Tweets imported from JSON are categorized, titled, and described by Claude (not Gemini)
  2. The local proxy server starts automatically at Mac login via LaunchAgent without manual intervention
  3. If the proxy is not accessible, bookmarks are saved without AI categorization (graceful fallback) rather than failing
  4. Both the web app and Chrome extension send AI requests to localhost:3838 (not the Gemini API)
**Plans**: 4 plans

Plans:
- [x] 01-01: Build local proxy server (reads Claude CLI session token, exposes localhost:3838)
- [x] 01-02: Configure LaunchAgent for auto-start on both Macs
- [x] 01-03: Replace geminiService.ts with claudeService.ts (same public interface)
- [x] 01-04: Wire web app and extension to call proxy; implement error fallback (AI-04)

### Phase 2: Chrome Tabs Feature
**Goal**: Users can select multiple open Chrome tabs and bulk-save them as AI-categorized bookmarks from the extension popup
**Depends on**: Phase 1
**Requirements**: TABS-01, TABS-02, TABS-03, TABS-04
**Success Criteria** (what must be TRUE):
  1. A tabs section is visible in the extension popup showing currently open Chrome tabs
  2. User can filter the tab list by Chrome group or view only ungrouped tabs
  3. User can select multiple tabs from the list simultaneously
  4. Clicking bulk-save sends each selected tab through Claude categorization and saves all of them as bookmarks, with per-tab inline status feedback
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Types, config strings, tabsUtils pure functions, vitest setup, 3 test suites (TDD)
- [ ] 02-02-PLAN.md — Tabs view UI: list, group filter, checkboxes, select-all, already-saved badges
- [ ] 02-03-PLAN.md — Bulk save flow: handleBulkSave, tabs-saving/summary views, service-worker simplification

### Phase 3: Fix Single-Save
**Goal**: Saving a single page from the extension uses Claude for categorization, at parity with bulk-save behavior
**Depends on**: Phase 1
**Requirements**: AI-03
**Success Criteria** (what must be TRUE):
  1. Saving the current page from the extension popup results in a bookmark with a Claude-assigned category (not a manual or missing category)
  2. If Claude is unavailable the user is prompted to select a category, and if dismissed the bookmark is saved under "Altres" — matching the 3-tier fallback from ai-bookmarks v1.0
**Plans**: 1 plan

Plans:
- [ ] 03-01: Wire single-save path in popup to callClaudeProxy; implement 3-tier fallback (Claude → user selection → Altres)

### Phase 4: Tech Debt Cleanup
**Goal**: Gemini code, packages, and references are fully removed; the codebase contains no dead code from the migration
**Depends on**: Phase 3
**Requirements**: None (non-functional cleanup)
**Success Criteria** (what must be TRUE):
  1. `@google/genai` is absent from package.json and node_modules
  2. `geminiService.ts` and any Gemini-specific imports no longer exist in the codebase
  3. No stale Gemini API key references, env vars, or UI strings remain
**Plans**: 1 plan

Plans:
- [ ] 04-01: Remove geminiService.ts, uninstall @google/genai, scrub all Gemini references (strings, env vars, imports)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Claude Proxy | 4/4 | Complete   | 2026-03-15 |
| 2. Chrome Tabs Feature | 3/3 | Complete   | 2026-03-15 |
| 3. Fix Single-Save | 0/1 | Not started | - |
| 4. Tech Debt Cleanup | 0/1 | Not started | - |
