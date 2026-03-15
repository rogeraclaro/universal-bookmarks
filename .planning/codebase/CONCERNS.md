# Codebase Concerns

**Analysis Date:** 2026-03-15

## Security Issues

**Hardcoded API Secret in Config:**
- Issue: API secret stored directly in source code at `extension/shared/config.ts` line 4 and 7
- Files: `extension/shared/config.ts`
- Risk: Secret is committed to version control and exposed in built extension
- Current mitigation: None - secret is directly hardcoded
- Recommendations:
  - Move secret to environment variables loaded at runtime
  - Use Chrome extension manifest `externally_connectable` instead of hardcoded secrets
  - Consider implementing request signature verification on backend instead of bearer token
  - Use a proxy service/backend that handles authentication without exposing secrets to client

**Exposed Gemini API Key:**
- Issue: `VITE_API_KEY` loaded from environment but exposed through `import.meta.env` in `src/services/geminiService.ts`
- Files: `src/services/geminiService.ts` line 77
- Risk: API key accessible in built JS bundle and development tools
- Current mitigation: Environment-only (slightly better than hardcoded)
- Recommendations:
  - Move Gemini API calls to a backend service that handles authentication
  - Implement server-side batch processing instead of client-side API calls
  - Use rate limiting and quota management on backend only

**Broad Content Script Permissions:**
- Issue: Content script registered with `<all_urls>` in manifest
- Files: `extension/manifest.json` line 33
- Risk: Extension runs on every website, potential XSS vulnerability if content script is compromised
- Current mitigation: Content script only extracts metadata passively
- Recommendations:
  - Restrict to specific domains if possible
  - Implement Content Security Policy headers
  - Add input validation on all message handlers

## Performance Bottlenecks

**Sequential Batch Processing with Batch Size 1:**
- Issue: Gemini processing uses `BATCH_SIZE = 1` meaning each tweet processed one at a time
- Files: `src/services/geminiService.ts` line 182
- Cause: Safety measure against rate limits, but extremely slow for large imports
- Current capacity: ~2000 RPM during trial, falls to 5 RPM after trial ends (2026-03-08 expires)
- Impact: Processing 100 bookmarks could take 2+ hours after trial ends
- Improvement path:
  - Increase batch size to 5-10 during trial while quota allows
  - Implement queue-based backend processing instead
  - Add background job system for async processing

**Multiple API Calls per Bookmark Save:**
- Issue: `saveBookmark()` in `extension/shared/api.ts` fetches all bookmarks, appends one, then saves all
- Files: `extension/shared/api.ts` lines 49-62
- Cause: No backend support for append operations
- Impact: Scales O(n) - downloading/uploading all bookmarks for each save
- Improvement path:
  - Add backend endpoint for appending single bookmarks
  - Implement delta sync protocol
  - Consider local-first sync with conflict resolution

**Metadata Extraction Falls Back to DOM Parsing:**
- Issue: `extractMetadata()` in `extension/content/content.ts` falls back to searching DOM for paragraphs
- Files: `extension/content/content.ts` lines 19-24
- Cause: Not all sites have proper meta tags
- Impact: DOM traversal on every bookmark can block page interaction
- Improvement path:
  - Move to background worker for extraction
  - Cache extracted metadata per URL
  - Implement timeout for slow DOM operations

## Tech Debt

**Dual Storage Implementation:**
- Issue: `src/services/storage.ts` implements dual API + localStorage fallback with conditional logic
- Files: `src/services/storage.ts` lines 14, 55-86
- Impact: Complex branching logic, hard to maintain and test both paths
- Fix approach:
  - Choose single storage strategy (API-first with local cache OR localStorage-only)
  - Remove unused path completely
  - Implement proper backend sync if using API

**Fragile JSON Parsing in Gemini Service:**
- Issue: Multiple cleanup and truncation steps to handle malformed Gemini responses
- Files: `src/services/geminiService.ts` lines 136-172
- Workarounds present:
  - Markdown code block removal (lines 137-138)
  - Control character removal (line 143)
  - Trailing comma removal (line 144)
  - Title length truncation before parsing (lines 149-155)
  - Post-parse title cleanup (lines 164-166)
- Root cause: Gemini API sometimes returns truncated or malformed JSON
- Better fix: Use structured output format with schema enforcement on backend, not client-side patches
- Risk: If Gemini output format changes, multiple fragile regexes will fail silently

**Trial Date Hardcoding:**
- Issue: Trial end date hardcoded as `2026-03-08` in service
- Files: `src/services/geminiService.ts` lines 11-13
- Problem: No mechanism to update after trial expires - code will fail after date
- Fix approach:
  - Fetch trial status from backend API
  - Implement graceful degradation when trial ends
  - Add user-facing notification with activation instructions

**Duplicate Message Listeners in Service Worker:**
- Issue: Two separate `chrome.runtime.onMessage.addListener()` calls that could conflict
- Files: `extension/background/service-worker.ts` lines 30 and 79
- Problem: Returns `false` in main listener could prevent secondary listener from firing
- Fix: Consolidate into single message handler with switch statement

## Missing Critical Features

**No Error Recovery for Failed Bookmarks:**
- Issue: When batch processing fails after max retries, falls back to simple title without description
- Files: `src/services/geminiService.ts` lines 256-278
- Impact: User loses AI-generated title and categories for bookmarks with processing errors
- Blocks: Users cannot reliably process large imports

**No Conflict Resolution for Multi-Device Sync:**
- Issue: Dual storage with localStorage + API has no merge strategy if data differs
- Files: `src/services/storage.ts`
- Impact: User could lose bookmarks if using extension on multiple devices
- Blocks: Cross-device bookmarking workflows

**No Rate Limit Awareness in UI:**
- Issue: Extension shows all bookmarks in UI without warning about per-URL rate limits
- Files: `extension/popup/popup.tsx`
- Impact: User may attempt bulk actions that will fail
- Blocks: User understanding of API constraints

**No Fallback when API Unreachable:**
- Issue: Extension fails silently if `links.masellas.info` is down
- Files: `extension/shared/api.ts` line 48 only logs to console
- Impact: User thinks bookmark was saved but it wasn't
- Blocks: Reliability during server outages

## Test Coverage Gaps

**No Tests for Gemini Service:**
- What's not tested: JSON parsing, retry logic, rate limiting, title sanitization
- Files: `src/services/geminiService.ts` (300+ lines)
- Risk: Fragile regex patterns and JSON cleanup could break with format changes
- Priority: High - this is critical path code

**No Tests for Storage Layer:**
- What's not tested: API fallback logic, localStorage sync, data persistence
- Files: `src/services/storage.ts`, `extension/shared/api.ts`
- Risk: Subtle bugs in conditional logic between API/localStorage paths
- Priority: High - data loss risk

**No Tests for Content Script:**
- What's not tested: Metadata extraction from different page structures
- Files: `extension/content/content.ts`
- Risk: Extraction fails silently on unfamiliar DOM structures
- Priority: Medium

**No Tests for Extension Message Passing:**
- What's not tested: Message handler protocol, error cases, response timing
- Files: `extension/background/service-worker.ts`, `extension/popup/popup.tsx`
- Risk: Silent failures if message protocol changes
- Priority: Medium

**No E2E Tests:**
- Issue: No integration tests for full bookmark save flow
- Impact: Broken end-to-end workflows only discovered by users

## Fragile Areas

**JSON Sanitization for Gemini:**
- Files: `src/services/geminiService.ts` lines 59-70, 142-156
- Why fragile: Uses multiple regex patterns to clean user-generated content before API call and response
- Pattern list is hardcoded and may not cover all XSS vectors or malformed JSON
- Safe modification: Add test cases for each supported content format, test regex against known problematic inputs

**Rate Limit State Management:**
- Files: `src/services/geminiService.ts` lines 196-280
- Why fragile: Exponential backoff delay stored as local variable, resets if extension reloaded
- No persistent tracking of rate limit reset time
- Safe modification: Persist rate limit state to Chrome storage, implement sliding window rate limiter

**Category Caching in Service Worker:**
- Files: `extension/background/service-worker.ts` lines 4-27
- Why fragile: Simple timestamp-based cache with 5 minute TTL
- Can return stale categories if user adds category on other device/tab
- Safe modification: Implement cache invalidation on bookmark/category save, add cache versioning

**Message Handler Return Values:**
- Files: `extension/background/service-worker.ts` lines 30-91
- Why fragile: Returns `false` for unhandled messages, but async handlers use `return true`
- If promise rejects after initial return, sendResponse won't receive error
- Safe modification: Wrap all async calls in try/catch, always send response object

## Scaling Limits

**Single-File Bookmark Storage:**
- Current capacity: No inherent limit, but performance degrades as file grows
- Limit: JSON parsing/stringifying all bookmarks on every save becomes O(n) time
- Current scale: Tested with ~100 bookmarks, untested at 1000+
- Scaling path:
  - Implement backend database instead of JSON file
  - Add pagination/streaming for large exports
  - Implement delta sync for incremental updates

**Rate Limiting Based on Quota:**
- Current trial quota: 2000 RPM (expires 2026-03-08 - TODAY)
- Free tier: 5 RPM
- Limit: System becomes nearly unusable after trial (1 bookmark per 12 seconds)
- Scaling path:
  - Implement backend processing with higher quota
  - Implement request batching on server
  - Cache results to avoid re-processing

**No Pagination in Duplicate Check:**
- Issue: `isDuplicate()` loads all bookmarks into memory to check one URL
- Files: `extension/shared/api.ts` lines 66-75
- Limit: With 10k+ bookmarks, this becomes slow and memory-intensive
- Scaling path: Add backend endpoint that checks single URL without returning all data

## Dependency Risks

**Google GenAI SDK Version Pinned:**
- Issue: Using `@google/genai` ^1.30.0 with minimal version constraint
- Risk: API breaking changes in minor/patch versions not covered
- Impact: New major version released could break schema definitions
- Recommendation: Monitor releases, implement version pinning for production

**React Version Mismatch:**
- Issue: Main app uses React 19.2.0, extension uses React 18.2.0
- Files: `package.json` vs `extension/package.json`
- Risk: Different component behavior, API inconsistencies
- Recommendation: Standardize on React 19.2.0 across both, or document why they differ

## Known Issues Without Workarounds

**Inline Secret in Built Extension:**
- When extension is built, secret is inlined into `dist/background/service-worker.js`
- Anyone can extract the secret from the extension bundle
- No current workaround - architectural change needed

**Loss of Data on API Failure After Form Submit:**
- If API fails after user submits form but before data persists, form closes and data is lost
- Auto-close timeout is 1000ms which may not be enough for API response
- Recommendation: Add proper error handling before closing window

---

*Concerns audit: 2026-03-15*
