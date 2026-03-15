# Codebase Structure

**Analysis Date:** 2026-03-15

## Directory Layout

```
universal-bookmarks/
├── extension/              # Chrome extension source
│   ├── background/         # Service worker (message handling, API calls)
│   ├── popup/              # Extension popup UI (React)
│   ├── content/            # Content script (DOM metadata extraction)
│   ├── shared/             # Types, config, API client (shared by popup + background)
│   ├── assets/             # Extension icons
│   ├── manifest.json       # Chrome extension manifest v3
│   └── vite.config.ts      # Build config for extension
├── src/                    # React web application source
│   ├── components/         # React UI components
│   ├── services/           # Storage adapter, Gemini integration
│   ├── App.tsx             # Main app component (bookmark grid, filters, modals)
│   ├── main.tsx            # React DOM entry point
│   ├── types.ts            # TypeScript interfaces
│   ├── translations.ts     # i18n strings (Catalan)
│   ├── index.css           # Tailwind imports
│   ├── vite.config.ts      # Build config for web app
│   └── index.html          # HTML template
├── backend/                # Express server (simple REST API)
│   ├── server.js           # Express app with endpoints
│   ├── db.json             # JSON file database (bookmarks, categories, deletedIds)
│   └── package.json        # Node dependencies (express, cors)
├── public/                 # Static assets (served by SPA)
├── .planning/codebase/     # GSD mapping documents
├── package.json            # Root monorepo config (Vite, TypeScript, linting)
├── tsconfig.json           # Root TypeScript config (references tsconfig.app.json, tsconfig.node.json)
├── tsconfig.app.json       # App TypeScript config
├── vite.config.ts          # Root Vite config (references src/vite.config.ts)
├── postcss.config.js       # Tailwind CSS config loader
├── tailwind.config.js      # Tailwind CSS configuration
├── eslint.config.js        # ESLint rules
└── index.html              # Web app HTML template (loads src/main.tsx)
```

## Directory Purposes

**`extension/`:**
- Purpose: Chrome extension codebase
- Contains: TypeScript files for popup, background, content script; shared types and API client; manifest configuration
- Key files: `manifest.json`, `background/service-worker.ts`, `popup/popup.tsx`, `content/content.ts`

**`extension/background/`:**
- Purpose: Service worker for extension (long-lived, handles messages and API calls)
- Contains: `service-worker.ts` — message listener for SAVE_BOOKMARK, CHECK_DUPLICATE, GET_CATEGORIES, SAVE_CATEGORY
- Responsibilities: Calls API endpoints, caches categories, maintains authentication

**`extension/popup/`:**
- Purpose: UI shown when user clicks extension icon
- Contains: `popup.tsx` (main form component), `index.tsx` (mount point)
- Responsibilities: Displays form with extracted metadata, category selection, communicates with background via chrome.runtime.sendMessage()

**`extension/content/`:**
- Purpose: Content script injected into every webpage
- Contains: `content.ts` — DOM extraction and message listener
- Responsibilities: Extracts page title, description, author via meta tags and document properties

**`extension/shared/`:**
- Purpose: Code shared between popup and background service worker
- Contains: `types.ts` (Bookmark, Message, ExtractedMetadata interfaces), `api.ts` (REST client), `config.ts` (constants, UI strings)
- Responsibilities: Centralized types prevent duplication; API client abstracts fetch logic

**`src/`:**
- Purpose: React web application source
- Contains: Components, services, types, styling, translations
- Key files: `App.tsx` (main component, 1545 lines), `main.tsx` (DOM mount), `types.ts` (Bookmark interface)

**`src/components/`:**
- Purpose: Reusable React UI components
- Contains: `UI.tsx` (Button, Input, TextArea, Label, Select, Badge, Modal, Card), `ScrollToTop.tsx`, `TrialCountdown.tsx`
- Pattern: Styled components using Tailwind CSS with custom shadow/border utilities

**`src/services/`:**
- Purpose: Business logic abstraction
- Contains: `storage.ts` (dual-mode persistence: API or localStorage), `geminiService.ts` (AI processing with retry logic)
- Responsibilities: Hide implementation details from components; manageable import paths

**`backend/`:**
- Purpose: REST API server for persistent storage
- Contains: `server.js` (Express endpoints), `db.json` (JSON file database), `package.json` (dependencies)
- Endpoints: GET/POST /bookmarks, GET/POST /categories, GET/POST /deleted, POST /reset
- Authentication: x-api-secret header check (shared secret in config.ts and server.js)

## Key File Locations

**Entry Points:**

- `src/main.tsx`: React application mount point
  - Loads root DOM element (#root from index.html)
  - Renders React.StrictMode wrapping App component
  - Loads global CSS (index.css with Tailwind directives)

- `src/index.html`: Web application HTML template
  - Defines #root div for React mount
  - Script reference to src/main.tsx

- `extension/popup/index.tsx`: Extension popup entry point
  - Mounts Popup component to #app div
  - Loads popup-specific CSS

- `extension/background/service-worker.ts`: Background worker entry
  - Registered in manifest.json
  - Listens for chrome.runtime.onMessage events
  - Runs continuously while extension is enabled

- `extension/manifest.json`: Chrome extension configuration
  - Declares popup, icons, permissions (activeTab, scripting, storage)
  - Registers service worker and content script
  - Specifies host permissions for links.masellas.info API

- `backend/server.js`: Express server entry
  - Starts on port 3003
  - Loads db.json on startup
  - Listens for HTTP requests

**Configuration:**

- `src/vite.config.ts`: Web app build configuration
  - Port 3000 for dev server
  - React plugin enabled
  - Path alias @: resolves to current directory
  - env variables: GEMINI_API_KEY

- `extension/vite.config.ts`: Extension build configuration
  - Outputs popup, background, content script as separate bundles
  - Entry points: popup/index.html, background/service-worker.ts, content/content.ts

- `.env` file: Environment secrets
  - VITE_STORAGE_SECRET: Backend API authentication key
  - VITE_STORAGE_API_URL: Backend API base URL
  - VITE_API_KEY: Gemini API key
  - (Note: NOT readable per forbidden_files rules)

**Core Logic:**

- `src/App.tsx`: Main application component (1545 lines)
  - Grid display of bookmarks with filtering (categories, search, date range)
  - Edit/delete/copy bookmark functionality
  - Import/export (JSON file upload/download)
  - Gemini processing modal with real-time progress
  - New category creation modal
  - Trial countdown widget

- `src/services/storage.ts`: Storage abstraction
  - Detects USE_API flag from VITE_STORAGE_SECRET presence
  - Provides async interface: getBookmarks(), saveBookmarks(), getCategories(), saveCategories(), getDeletedIds(), saveDeletedIds()
  - Falls back to localStorage if API unavailable

- `src/services/geminiService.ts`: AI processing integration
  - Batch processing with 90s timeout per request
  - Exponential backoff retry logic (configurable by trial status)
  - Schema-validated JSON response with structured output
  - Fallback bookmark creation when Gemini fails after retries
  - Trial date tracking and rate limit switching

- `extension/shared/api.ts`: REST client
  - Implements: getBookmarks(), getCategories(), saveBookmark(), saveCategory(), isDuplicate()
  - Generic apiRequest<T>() wrapper for type-safe fetch

**Testing:**

- No test files detected (testing analysis in TESTING.md)

## Naming Conventions

**Files:**

- TypeScript source: `camelCase.ts` or `PascalCase.tsx` (React components)
  - Examples: `App.tsx`, `service-worker.ts`, `content.ts`, `storage.ts`

- Configuration: kebab-case or .config syntax
  - Examples: `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `eslint.config.js`

**Directories:**

- Lowercase kebab-case or descriptive plurals
  - Examples: `extension/`, `components/`, `services/`, `content/`, `popup/`, `shared/`

**React Components:**

- PascalCase file names: `TrialCountdown.tsx`, `ScrollToTop.tsx`
- Export default function or named export
- Props interface suffixed with `Props`: `ButtonProps`

**Services & Utilities:**

- camelCase file names: `storage.ts`, `geminiService.ts`
- Named exports for functions and objects: `export const storage = { ... }`

**Constants:**

- UPPERCASE_SNAKE_CASE for module-level constants
  - Examples: `TRIAL_START_DATE`, `RATE_LIMITS`, `CACHE_DURATION`, `KEYS`

**TypeScript Interfaces:**

- PascalCase: `Bookmark`, `Category`, `TweetRaw`, `ProcessedTweetResult`, `ExtractedMetadata`, `Message`
- Suffixes for specific types:
  - `Response`: `APIBookmarksResponse`, `APIBookmarksResponse`
  - `Result`: `ProcessedTweetResult`
  - `Entry`: `LogEntry`

**Environment Variables:**

- VITE_ prefix (Vite convention): `VITE_STORAGE_SECRET`, `VITE_STORAGE_API_URL`, `VITE_API_KEY`
- GEMINI_API_KEY (legacy, also VITE_API_KEY)

## Where to Add New Code

**New Feature (modifying App.tsx):**

- Primary code: `src/App.tsx` (main component logic and UI)
- Related storage: `src/services/storage.ts` (if new data type)
- Related services: `src/services/geminiService.ts` (if AI-powered)
- Types: `src/types.ts` (add new interfaces)
- Tests: Not present; would add alongside feature

**New Component/Module:**

- Implementation: `src/components/` for UI (e.g., `NewFeature.tsx`)
- Implementation: `src/services/` for logic (e.g., `newFeatureService.ts`)
- Types: Add to relevant `src/types.ts` or module-local types
- Import in: `src/App.tsx` or parent component
- Pattern: Follow existing Button, Input, Modal components in `src/components/UI.tsx` for reusable UI

**Extension Changes:**

- Popup logic: `extension/popup/popup.tsx`
- Background logic: `extension/background/service-worker.ts`
- Content script: `extension/content/content.ts`
- Shared types/config: `extension/shared/` (api.ts, types.ts, config.ts)
- Types: Must update both `src/types.ts` AND `extension/shared/types.ts` to keep in sync

**New Utility or Helper:**

- Shared utilities: `src/services/` (e.g., parsing, validation)
- Translation strings: `src/translations.ts` (for UI text)
- Constants: Add to module top (e.g., RATE_LIMITS, KEYS objects)

**Backend API Endpoint:**

- Endpoint logic: `backend/server.js` (add new app.get/post routes)
- Database operations: Modify readDB() and writeDB() calls
- Types: Mirror types in extension/shared/types.ts and src/types.ts

## Special Directories

**`dist/`:**
- Purpose: Build output for web application
- Generated: Yes (npm run build)
- Committed: No (.gitignore)
- Contains: Optimized bundles, CSS, assets

**`extension/dist/`:**
- Purpose: Build output for Chrome extension
- Generated: Yes (build process)
- Committed: No
- Contains: Bundled popup, background, content scripts; manifest.json copy

**`node_modules/`:**
- Purpose: NPM dependencies
- Generated: Yes (npm install from package-lock.json)
- Committed: No (.gitignore)

**`public/`:**
- Purpose: Static assets copied to build output
- Generated: No (manually maintained)
- Committed: Yes (tracked in git)
- Contains: Favicon, images, etc.

**`.planning/codebase/`:**
- Purpose: GSD codebase mapping documents
- Generated: Yes (by GSD mapper agent)
- Committed: Yes
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

---

*Structure analysis: 2026-03-15*
