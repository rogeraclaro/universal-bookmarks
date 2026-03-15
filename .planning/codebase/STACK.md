# Technology Stack

**Analysis Date:** 2026-03-15

## Languages

**Primary:**
- TypeScript 5.3-5.9.3 - Web application and extension logic
- JavaScript - Backend server (Node.js)
- TSX - React component syntax

**Secondary:**
- CSS/PostCSS - Styling pipeline
- JSON - Configuration and data storage

## Runtime

**Environment:**
- Node.js - Backend server and dev tooling
- Web browsers (Chrome extension targets Chrome) - Frontend and extension
- Vite dev server - Local development

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present in root, extension, and backend directories

## Frameworks

**Core:**
- React 18.2.0 (extension) / 19.2.0 (web app) - UI components and state management
- Express.js 4.18.2 - Backend HTTP server

**Build/Dev:**
- Vite 5.0.8 (extension) / 7.2.4 (web app) - Module bundling and dev server
- @vitejs/plugin-react - React support in Vite

**Styling:**
- Tailwind CSS 3.4.0-3.4.17 - Utility-first CSS framework
- PostCSS 8.4.x - CSS transformation
- Autoprefixer 10.4.x - CSS vendor prefixing

**Linting:**
- ESLint 9.39.1 - Code linting
- TypeScript ESLint 8.46.4 - TypeScript linting support
- eslint-plugin-react-hooks - React hooks linting
- eslint-plugin-react-refresh - React Fast Refresh linting

## Key Dependencies

**Critical:**
- @google/genai 1.30.0 - Google Gemini API client for bookmark processing
- lucide-react 0.555.0 - Icon component library
- cors 2.8.5 - CORS middleware for Express backend
- @types/chrome 0.0.258 / 0.0.x - Chrome Extension API typings

**Infrastructure:**
- @vitejs/plugin-react - React JSX transformation for Vite
- globals 16.5.0 - Global variable types for ESLint

## Configuration

**Environment:**
- `.env` file required (not committed - contains sensitive keys)
  - `VITE_API_KEY` - Google Gemini API key
  - `VITE_STORAGE_API_URL` - Backend API endpoint (optional, falls back to localStorage)
  - `VITE_STORAGE_SECRET` - Authentication secret for backend API

**Build:**
- `vite.config.ts` - Vite configuration for web app
- `extension/vite.config.ts` - Vite configuration for Chrome extension with custom rollup output
- `tsconfig.json` - Root TypeScript references configuration
- `tsconfig.app.json` - Web app TypeScript config (ES2022 target, React JSX)
- `extension/tsconfig.json` - Extension TypeScript config (ES2020 target, Chrome types)
- `postcss.config.js` - PostCSS configuration for Tailwind processing
- `tailwind.config.js` - Tailwind CSS configuration
- `.eslintrc.js` - ESLint configuration (flat config)

## Platform Requirements

**Development:**
- Node.js 18+ (inferred from dependencies)
- npm 8+ for workspaces support
- TypeScript 5.3+ for strict type checking

**Production - Web App:**
- Modern web browser with ES2022 support (Chrome, Firefox, Safari, Edge)
- Vite-bundled SPA served as static assets
- Optional: Express backend for data persistence

**Production - Extension:**
- Chrome/Chromium-based browsers with Manifest V3 support
- Vite-bundled extension with:
  - Service worker for background processing
  - Content script injection for page metadata extraction
  - Popup UI for bookmark creation

## Package Structure

**Root (`package.json`):**
- Private monorepo-style project
- Scripts: `dev` (Vite), `build` (TypeScript + Vite), `lint` (ESLint), `preview` (Vite preview)

**Extension (`extension/package.json`):**
- Scripts: `dev` (watch build), `build` (TypeScript + Vite + asset copy), `copy-assets` (manifest and icons)
- Separate React 18.2.0 installation for isolated extension build

**Backend (`backend/package.json`):**
- Minimal setup: Express + CORS only
- Single entry: `server.js`
- Start script: `node server.js`

---

*Stack analysis: 2026-03-15*
