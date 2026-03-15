# External Integrations

**Analysis Date:** 2026-03-15

## APIs & External Services

**AI Processing:**
- Google Gemini API (gemini-2.5-flash model)
  - What it's used for: Processing bookmarks/tweets with AI to generate titles, descriptions, and category assignments
  - SDK/Client: `@google/genai` (v1.30.0)
  - Auth: Environment variable `VITE_API_KEY` (API key, not included in repo)
  - Rate limits: 2000 RPM during trial period (2025-12-08 to 2026-03-08), 5 RPM after trial ends
  - Implementation: `src/services/geminiService.ts` with batch processing, retry logic, and exponential backoff
  - Timeout: 90 seconds per request with automatic fallback to unprocessed entry if Gemini fails

**Bookmark Data API:**
- Custom Express backend served at `https://links.masellas.info/api` (hardcoded URL)
  - What it's used for: Persistent storage of bookmarks, categories, and deleted IDs
  - Auth: Header `x-api-secret` with secret `4eb6fd03128af657e3b37c1467d00823` (hardcoded in extension config)
  - Fallback: Browser localStorage if API secret not configured
  - Endpoints:
    - `GET /bookmarks` - Retrieve all saved bookmarks
    - `POST /bookmarks` - Save complete bookmarks array
    - `GET /categories` - Retrieve category list
    - `POST /categories` - Save complete categories array
    - `GET /deleted` - Retrieve deleted bookmark IDs
    - `POST /deleted` - Save deleted IDs for sync
    - `POST /reset` - Clear all data

## Data Storage

**Databases:**
- JSON file-based (backend only)
  - Location: `backend/db.json`
  - Structure: `{ bookmarks: [], categories: [], deletedIds: [] }`
  - Client: Node.js `fs` module for file read/write
  - No ORM - direct JSON serialization

**Client-Side Storage:**
- Browser localStorage (fallback when no API configured)
  - Keys used (from `src/services/storage.ts`):
    - `universal-bookmarks-data` - Bookmarks array
    - `universal-bookmarks-categories` - Category list
    - `universal-bookmarks-deleted-ids` - Deleted bookmark IDs tracking
  - Strategy: API takes precedence if `VITE_STORAGE_SECRET` is set; otherwise uses localStorage

**File Storage:**
- Local filesystem only (backend stores in `db.json`)
- No cloud storage integration detected

**Caching:**
- In-memory category cache in extension service worker (`backend/service-worker.ts`)
  - Duration: 5 minutes
  - Used to reduce API calls for category list

## Authentication & Identity

**Auth Provider:**
- Custom header-based authentication
- Implementation:
  - Backend: Checks `x-api-secret` header (fixed secret `4eb6fd03128af657e3b37c1467d00823`)
  - Extension: Includes secret in all API requests via headers
  - Web app: Uses environment variable `VITE_STORAGE_SECRET` (optional)
  - Status: 403 Unauthorized if secret missing or incorrect

**User Identity:**
- No user accounts or login system
- Extension identifies bookmarks with generated IDs: `ext_${timestamp}_${randomString}`
- Web app bookmarks use UUIDs or URLs as identifiers

## Monitoring & Observability

**Error Tracking:**
- None detected - no Sentry, LogRocket, or similar

**Logs:**
- Console logging only (`console.error`, `console.log`)
- Key log points:
  - Gemini API errors with retry attempts
  - Storage API errors
  - Service worker initialization

**Trial/Feature Status:**
- Hardcoded trial period: 2025-12-08 to 2026-03-08 (90 days)
- Trial status affects Gemini rate limits (2000 RPM trial vs 5 RPM free)
- UI component `TrialCountdown` displays countdown to end of trial

## CI/CD & Deployment

**Hosting:**
- Web App: VPS at `links.masellas.info` (nginx reverse proxy configured, see `nginx-config.conf`, `nginx-vhost-config.txt`)
- Backend: VPS at same domain, running Express on port 3003
- Extension: Chrome Web Store (implied, not yet deployed)

**Deployment:**
- Manual deployment script: `deploy-to-vps.sh`
- VPS requirements: nginx, Node.js
- Backend start: `npm start` runs `node server.js`

**CI Pipeline:**
- None detected - no GitHub Actions, GitLab CI, or similar

## Environment Configuration

**Required env vars for Web App:**
- `VITE_API_KEY` - Google Gemini API key (CRITICAL)
- `VITE_STORAGE_API_URL` - Backend API base URL (optional, defaults to relative path)
- `VITE_STORAGE_SECRET` - API authentication secret (optional, enables remote storage)

**Required env vars for Backend:**
- None - server.js has hardcoded port (3003) and hardcoded secret
- Database file: `backend/db.json` (auto-created if missing)

**Secrets Location:**
- `.env` file in project root (not committed to git)
- Backend secret hardcoded in `backend/server.js` and `extension/shared/config.ts` - **SECURITY CONCERN**

## Webhooks & Callbacks

**Incoming:**
- Chrome extension popup submits bookmarks via background service worker
- Service worker message handlers in `extension/background/service-worker.ts`:
  - `CHECK_DUPLICATE` - Verify URL not already saved
  - `SAVE_BOOKMARK` - Persist bookmark to API/localStorage
  - `SAVE_CATEGORY` - Add new category
  - `GET_CATEGORIES` - Fetch category list

**Outgoing:**
- None detected - application sends data to Gemini API and backend, no third-party notifications

## Extension-Specific Integrations

**Chrome APIs Used:**
- `chrome.tabs.query()` - Get active tab
- `chrome.tabs.sendMessage()` - Communicate with content script
- `chrome.scripting.executeScript()` - Inject content script if needed
- `chrome.runtime.onMessage` - Background service worker message handling
- `chrome.runtime.sendMessage()` - Popup to background communication

**Content Script Injection:**
- Runs on `<all_urls>` per manifest
- Extracts page metadata (title, description, author, URL)
- Responds to `GET_METADATA` messages from popup
- Location: `extension/content/content.ts` (injected at document_end)

---

*Integration audit: 2026-03-15*
