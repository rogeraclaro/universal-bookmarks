# Phase 2: Chrome Tabs Feature - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning
**Source:** Reference implementation (ai-bookmarks v1.0, shipped 2026-03-14)

<domain>
## Phase Boundary

Add bulk tab selection and AI categorization to the extension popup. Users can view all open Chrome tabs, filter by group, select multiple tabs, and bulk-save them as AI-categorized bookmarks with per-tab inline status feedback. Single-save of the current page is a separate view accessible via a header link.

</domain>

<decisions>
## Implementation Decisions

### Layout / View Architecture
- Tabs view is the **default** when the popup opens (`loadTabsData` on mount, `viewState` starts as `'loading'` then transitions to `'tabs'`)
- ViewState enum expanded: `'loading' | 'form' | 'duplicate' | 'success' | 'error' | 'tabs' | 'tabs-saving' | 'tabs-summary'`
- Popup width: `w-[400px]`, max height: `max-h-[580px]`, tab list is `flex-1 overflow-y-auto`
- Header shows "🔖 Pestanyes Obertes" + a small "Guardar aquesta pàgina" text link that triggers `loadData()` and switches to `'form'` view

### Tab Item Display
- Per-tab row: checkbox → favicon (16px via `getFaviconUrl()`) with letter-avatar fallback → title (bold, truncated) + URL (small, gray, monospace, truncated)
- Left colored border (`border-l-4 border-l-{color}`) when tab belongs to a Chrome group (color from `GROUP_COLOR_MAP`)
- `alreadySaved` tabs: greyed out (`opacity-50 cursor-not-allowed`), checkbox disabled, "✓ guardat" badge shown — not selectable
- Chrome system tabs (`chrome://`, `chrome-extension://`) filtered out from list
- `getFaviconUrl` uses `chrome-extension://{chrome.runtime.id}/_favicon/?pageUrl=...&size=16` — requires `"favicon"` permission in manifest

### Group Filter UI
- Filter bar hidden entirely when no Chrome groups exist (`hasGroups(tabs)` check)
- When groups exist: pill buttons row — "Totes" | "Sense grup" | [group title buttons per group]
- Active filter: `bg-black text-white`; inactive: `bg-white hover:bg-gray-100`, all with `border-2 border-black`
- Filter state: `'all' | 'ungrouped' | number` (number = Chrome group ID)

### Select-All
- Sticky header row below filter bar: checkbox + "Seleccionar-ho tot" / "Desseleccionar tot" label
- Only operates on visible selectable tabs (excludes `alreadySaved` tabs and tabs hidden by group filter)

### Bulk Save Flow
- **Confirmation step**: Footer shows confirm dialog inline (`showConfirm` state) before starting — "Segur que vols guardar N pestanyes?"
- **Saving view** (`tabs-saving`): live per-tab status — `pending` (○), `saving` (spinner `animate-spin`), `saved` (✓ green), `failed` (✗ red)
- **Sequential `for..of`** — never `Promise.all` (prevents GET-modify-POST race condition on shared JSON storage — locked from Phase 1)
- **callClaudeProxy called from popup** (not service worker) — popup builds fully-categorized bookmark before sending `SAVE_BOOKMARK` (locked from Phase 1)
- Category filtering: `aiResult.categories.filter(c => categories.includes(c))` — invented categories rejected; fallback to `['Altres']`
- Twitter/X tabs: extract tweet body via `chrome.scripting.executeScript` on `[data-testid="tweetText"]`; also resolve author from URL + tab title pattern
- Timeout for `callClaudeProxy`: 30s (tweets need more time — reference uses 30s, not 10s)

### Summary View (`tabs-summary`)
- Saved tabs: list with Claude-assigned title + categories as `bg-yellow-100 border-yellow-400` badges
- Failed tabs: list with URLs in red monospace
- "Reintentar N fallits" button for partial retry (re-runs `handleBulkSave` with only failed IDs)
- "Tancar" closes popup — no auto-close (user reviews results)

### Service Worker Changes
- `SAVE_BOOKMARK` handler: **remove `callClaudeProxy` call** — popup now calls Claude before sending `SAVE_BOOKMARK`; service worker just calls `saveBookmark(bookmark)` directly (avoids double-call)
- `SAVE_CATEGORY` message type renamed to `ADD_CATEGORY` (matches reference; service worker handles dedup check internally)
- `callClaudeProxy` import removed from service-worker

### New Types (add to `types.ts`)
- `TabGroupColor` — union of 9 Chrome group color strings
- `TabItem` — merged tab object: id, title, url, favIconUrl, groupId, groupColor?, groupTitle?, alreadySaved
- `TabSaveStatus` — `'pending' | 'saving' | 'saved' | 'failed'`
- `TabGroupInfo` — { id, title, color } for filter button rendering
- Message type union: add `'ADD_CATEGORY'` (rename from `'SAVE_CATEGORY'`)

### New File: `tabsUtils.ts`
Pure functions extracted from popup logic — all testable in isolation:
- `filterTabsByGroup`, `hasGroups` — filter logic
- `toggleTabSelection`, `selectAllVisible`, `deselectAllVisible`, `getSelectionCount` — selection logic
- `buildTabBookmark`, `getTabSaveSummary`, `resolveAuthorFromUrl` — save helpers
- `getFaviconUrl` — favicon URL builder
- `GROUP_COLOR_MAP` — `Record<TabGroupColor, string>` mapping colors to Tailwind border classes

### New Config Strings (add to `config.ts`)
Catalan UI strings for tabs feature: `TABS_HEADING`, `TABS_SAVE_THIS_PAGE`, `TABS_FILTER_ALL`, `TABS_FILTER_UNGROUPED`, `TABS_SELECT_ALL`, `TABS_DESELECT_ALL`, `TABS_SAVE_BUTTON(n)`, `TABS_CONFIRM_TITLE`, `TABS_CONFIRM_MESSAGE(n)`, `TABS_CONFIRM_YES`, `TABS_CONFIRM_CANCEL`, `TABS_SAVING_HEADING`, `TABS_SUMMARY_HEADING`, `TABS_SUMMARY_SAVED(n)`, `TABS_SUMMARY_FAILED(n)`, `TABS_RETRY_FAILED(n)`, `TABS_CLOSE`, `TABS_ALREADY_SAVED_BADGE`, `TABS_LOADING`, `TABS_EMPTY`.
Also add: `ERRORS.CATEGORY_EXISTS`, `ERRORS.CATEGORY_EMPTY`.

### Tests (vitest, in `extension/tests/`)
Three new test files matching reference:
- `tabs-filter.test.ts` — `filterTabsByGroup` (all/ungrouped/groupId), `hasGroups`
- `tabs-selection.test.ts` — `toggleTabSelection`, `selectAllVisible`, `deselectAllVisible`, `getSelectionCount`
- `tabs-save.test.ts` — `buildTabBookmark` (id prefix, originalLink, default categories, createdAt type), `getTabSaveSummary`

### Manifest Permission
Add `"tabGroups"` permission to `manifest.json` (required for `chrome.tabGroups.query()`).
The `"favicon"` permission may already be present; verify and add if missing.

### Claude's Discretion
- Exact Tailwind spacing/padding details not specified above
- Test fixture data shape (tab IDs, titles, URLs used in tests)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `callClaudeProxy` in `api.ts`: callable directly from popup — same signature as reference (add `categories?: string[]` parameter and expand return type to `{ categories: string[]; title?: string; description?: string }`)
- `saveBookmark`, `isDuplicate`, `getBookmarks`, `getCategories` in `api.ts`: all reused as-is
- `checkbox-input`, `checkbox-label` CSS classes: already used in popup category selector — reused for tab checkboxes
- `btn-primary`, `btn-secondary`: used for confirm/cancel/close buttons
- `UI_STRINGS`, `ERRORS` in `config.ts`: extended with tabs strings
- `ViewState` type in `popup.tsx`: expanded with 3 new states

### Established Patterns
- React functional component with `useState`/`useEffect` — no changes to component model
- Chrome messaging via `chrome.runtime.sendMessage` — new `ADD_CATEGORY` message type
- Neobrutalist style: `border-2 border-black`, yellow header, bold uppercase — consistent in tabs views
- `font-mono` for URLs and status text — carried through tabs UI

### Integration Points
- `service-worker.ts`: SAVE_BOOKMARK handler simplified (remove Claude call), SAVE_CATEGORY → ADD_CATEGORY rename
- `manifest.json`: add `"tabGroups"` permission, verify `"favicon"`
- `extension/popup/tabsUtils.ts`: new file, imported by popup.tsx
- `extension/tests/`: new test directory (may need to create), vitest config may need update to include it

</code_context>

<specifics>
## Specific Ideas

- Reference implementation at: `/Users/rogermasellas/AI/AI Bookmark Manager/ai-bookmarks/extension/`
- All implementation is known and proven — this is a port, not a design exercise
- `callClaudeProxy` timeout extended to 30s (from 10s) to handle tweet processing time
- `resolveAuthorFromUrl` extracts author from URL domain (github, twitter, web fallback)
- Twitter/X author: combines `@handle` from URL + display name from tab title pattern `"Display Name on X: \"tweet\""` → `"Display Name (@handle)"`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-chrome-tabs-feature*
*Context gathered: 2026-03-15 from reference implementation ai-bookmarks v1.0*
