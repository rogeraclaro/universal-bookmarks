# Architecture

**Analysis Date:** 2026-03-15

## Pattern Overview

**Overall:** Client-server multi-layer architecture with optional backend persistence

The system follows a hybrid storage pattern supporting both local (localStorage) and server-side (REST API) persistence. Three separate applications communicate through well-defined interfaces:
1. **Chrome Extension** - Captures and saves bookmarks from the browser
2. **React Web Application** - Full-featured bookmark management dashboard
3. **Express Backend** - Simple REST API with JSON file persistence

**Key Characteristics:**
- Shared type system across all applications
- Message-based communication in extension (Chrome runtime messages)
- API request pattern for backend communication
- Environment-driven configuration (API credentials, feature toggles)
- Graceful fallback from API to localStorage when offline

## Layers

**Extension Layer (Chrome):**
- Purpose: Browser integration for capturing web pages as bookmarks
- Location: `extension/`
- Contains: Popup UI, background service worker, content scripts, shared types
- Depends on: Chrome APIs, Remote API (`links.masellas.info/api`)
- Used by: Browser tabs and pages

**Web Application Layer (React + Vite):**
- Purpose: Full-featured bookmark management, search, organization, bulk import/export
- Location: `src/`
- Contains: Main React app, components, services, types, styling (Tailwind)
- Depends on: Google Gemini API (for content analysis), storage service
- Used by: End users via browser as SPA

**Service Layer:**
- Purpose: Data persistence abstraction and AI-powered content processing
- Location: `src/services/`, `extension/shared/api.ts`
- Contains: Storage adapter (API/localStorage), Gemini integration
- Depends on: External APIs (backend, Gemini), localStorage
- Used by: App components, extension components

**Backend Layer (Express):**
- Purpose: Centralized data storage with simple CRUD operations
- Location: `backend/`
- Contains: REST endpoints, file-based database (db.json), authentication
- Depends on: Express, filesystem, CORS
- Used by: Web app and extension for persistent storage

**Shared Types & Config:**
- Purpose: Single source of truth for data structures and constants
- Location: `extension/shared/types.ts`, `extension/shared/config.ts`, `src/types.ts`
- Contains: TypeScript interfaces for bookmarks, categories, messages
- Depends on: None
- Used by: All application layers

## Data Flow

**Saving a Bookmark (Extension → Server):**

1. User clicks extension icon on any webpage
2. Content script (`extension/content/content.ts`) extracts page metadata via DOM queries
   - Tries og:title, twitter:title, then document.title
   - Extracts description from og:description, twitter:description, or page meta
   - Gets author from article:author or twitter:creator meta tags
   - Records current window.location.href
3. Popup (`extension/popup/popup.tsx`) displays form with extracted metadata
4. User fills title, selects categories, optionally adds new category
5. Background service worker (`extension/background/service-worker.ts`) receives SAVE_BOOKMARK message
6. Service worker calls `extension/shared/api.ts` → apiRequest POST /bookmarks
7. Server (`backend/server.js`) validates secret header, reads db.json, appends new bookmark, writes back
8. Response returned to popup, popup closes after 1 second success delay

**Saving Bookmarks to Web App (Direct or via Gemini):**

1. User uploads JSON file (Twitter export or manual JSON)
2. App (`src/App.tsx`) parses JSON into TweetRaw[] objects
3. If Gemini enabled: calls `processBookmarksWithGemini()` for batch analysis
   - Sanitizes tweet text (removes hashtags, mentions, newlines)
   - Calls Gemini API with structured schema for title/categories/links extraction
   - Handles rate limiting, retry logic, timeouts (90s)
   - Falls back to raw tweet text if Gemini fails after retries
4. Creates Bookmark objects with extracted data
5. Storage layer saves via API or localStorage based on VITE_STORAGE_SECRET env var
6. Log entries track progress and errors

**Fetching & Display:**

1. App mount loads bookmarks and categories via `storage.getBookmarks()` and `storage.getCategories()`
2. Bookmarks filtered by selected categories, search text, date range
3. Grid display shows bookmark cards with edit/delete/copy actions
4. Categories sidebar updated in real-time as user creates new ones

**State Management:**

- **Web App**: Pure React hooks (useState, useRef, useMemo for filtering)
- **Extension**: Local component state + Chrome runtime messaging for cross-process communication
- **Persistence**: Delegated to storage service (API or localStorage)
- **Trial State**: Checked at module load time (`geminiService.ts` TRIAL_ACTIVE flag)

## Key Abstractions

**Bookmark:**
- Purpose: Represents a saved web resource with metadata and categorization
- Examples: `src/types.ts`, `extension/shared/types.ts`
- Pattern: TypeScript interface with consistent structure across all applications
- Fields: id, title, description, author, originalLink, externalLinks[], categories[], createdAt

**Storage Adapter:**
- Purpose: Abstract data persistence layer to support multiple backends
- Examples: `src/services/storage.ts`, `extension/shared/api.ts`
- Pattern: Facade pattern over fetch + environment configuration
- Behavior: USE_API flag determines if calls hit REST endpoint or localStorage

**Message Protocol (Extension):**
- Purpose: Type-safe inter-process communication between popup, background, content script
- Examples: `extension/shared/types.ts` Message interface
- Pattern: Tagged union (message.type discriminates handler)
- Types: GET_METADATA, SAVE_BOOKMARK, CHECK_DUPLICATE, GET_CATEGORIES, SAVE_CATEGORY

**Gemini Processing Pipeline:**
- Purpose: Batch AI analysis of bookmark text with structured output schema
- Examples: `src/services/geminiService.ts` → processBatch(), processBookmarksWithGemini()
- Pattern: Retry-with-exponential-backoff + timeout racing + fallback mechanism
- Responsiveness: Uses AbortSignal for cancellation, onProgress callback for UI updates

## Entry Points

**Web Application:**
- Location: `src/main.tsx`
- Triggers: Direct browser navigation to SPA URL
- Responsibilities: React DOM mounting, loads root component
- Flow: main.tsx → App.tsx (loads bookmarks, renders grid)

**Extension Popup:**
- Location: `extension/popup/index.tsx`, `extension/popup/popup.tsx`
- Triggers: User clicks extension icon in browser toolbar
- Responsibilities: Metadata extraction form, category selection, save initiation
- Flow: loadData() queries content script → form render → handleSave() → background message

**Extension Background Service Worker:**
- Location: `extension/background/service-worker.ts`
- Triggers: Extension load, Chrome runtime messages
- Responsibilities: API communication, caching, authentication
- Flow: Listens for messages → validates → calls api.ts → responds

**Extension Content Script:**
- Location: `extension/content/content.ts`
- Triggers: Page load (matches all_urls in manifest)
- Responsibilities: DOM metadata extraction
- Flow: extractMetadata() on demand → responds to popup requests

**Backend Server:**
- Location: `backend/server.js`
- Triggers: Node process startup
- Responsibilities: REST API serving, file persistence
- Flow: Listens on :3003 → authenticates → reads/writes db.json

## Error Handling

**Strategy:** Defensive with graceful degradation

**Patterns:**

- **Extension bookmark save:** Popup checks for duplicate before save, shows error state if API fails
- **Web app Gemini processing:** Per-batch retry (exponential backoff), falls back to raw text after 5 attempts
- **Storage access:** API errors fall back to localStorage if available; missing data returns empty arrays
- **Metadata extraction:** Multiple extraction paths (og:title → twitter:title → document.title) ensure content capture
- **Rate limiting:** Detects 429 errors, implements 15s+ backoff delays based on trial status
- **Timeout:** Gemini requests race against 90s Promise.race() timeout, trigger retry on expiration
- **JSON parsing:** Truncates oversized titles mid-JSON before parsing, removes control characters
- **Duplicate detection:** Client-side check prevents same URL saving twice; ignores errors to allow saving

## Cross-Cutting Concerns

**Logging:**
- Web app uses `onLog(message, type)` callbacks during Gemini processing
- Backend logs errors to console
- Extension logs to browser dev console
- No centralized logging system

**Validation:**
- Popup: Title required, max 80 chars, at least one category selected
- Web app: URLs parsed and validated, duplicate URLs rejected
- Backend: API secret header required, all endpoints gated
- Gemini schema: Structured output forced by responseMimeType: "application/json"

**Authentication:**
- Backend: Simple x-api-secret header check (hardcoded in server.js and config.ts)
- Extension: Implicitly authenticated (runs in user's browser context)
- Web app: No authentication (bookmarks accessed via API secret header)
- Note: API secret visible in extension source and shared config — not suitable for user-specific secrets

**Trial/Rate Limiting:**
- Web app checks hardcoded trial dates (2025-12-08 to 2026-03-08)
- Trial: 2000 RPM, 100ms delay between requests
- Free tier: 5 RPM, 13s delay
- Flags determine Gemini request throttling
- UI shows countdown timer when <= 7 days remaining

---

*Architecture analysis: 2026-03-15*
