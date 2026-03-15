# Coding Conventions

**Analysis Date:** 2026-03-15

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `TrialCountdown.tsx`, `ScrollToTop.tsx`, `UI.tsx`)
- Services: camelCase with descriptive suffix (e.g., `geminiService.ts`, `storage.ts`)
- Utilities and data: camelCase (e.g., `translations.ts`, `types.ts`)
- Index files: `index.html`, config files as-is (e.g., `vite.config.ts`)

**Functions:**
- Regular functions: camelCase (e.g., `processBookmarksWithGemini`, `toggleCategory`, `sanitizeText`)
- React FC components: PascalCase (e.g., `export const Button: React.FC<ButtonProps>`)
- Helper functions: camelCase with descriptive action verb (e.g., `cleanContaminatedTitle`, `apiRequest`, `delay`)
- Callback handlers: camelCase prefixed with `on` (e.g., `onProgress`, `onLog`, `onEdit`, `onDelete`, `onClose`, `onConfirm`)

**Variables:**
- State: camelCase (e.g., `bookmarks`, `isLoading`, `categories`, `isMobileMenuOpen`)
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `TRIAL_START_DATE`, `TRIAL_END_DATE`, `BATCH_SIZE`, `RATE_LIMITS`)
- Local/temporary: camelCase (e.g., `batch`, `results`, `parsed`, `simplified Tweets`)
- Booleans: prefix with `is`, `has`, or `should` (e.g., `isLoading`, `isDanger`, `TRIAL_ACTIVE`, `hasPendingReview`)

**Types:**
- Interfaces: PascalCase, descriptive nouns (e.g., `ButtonProps`, `Bookmark`, `TweetRaw`, `LogEntry`, `ProcessedTweetResult`)
- Type unions: PascalCase (e.g., `Category = string`)
- Literal unions: single quotes and kebab-case or camelCase as appropriate (e.g., `'primary' | 'secondary' | 'danger' | 'ghost'`, `'info' | 'success' | 'warning' | 'error'`)

## Code Style

**Formatting:**
- No explicit Prettier config exists; follows common React/TypeScript conventions
- Indentation: Tabs (seen in App.tsx and geminiService.ts)
- Semicolons: Present throughout
- Quote style: Single quotes for strings, double quotes in JSX attributes

**Linting:**
- ESLint with TypeScript support (`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`)
- Config: `eslint.config.js` (new flat config format)
- Target: ES2020+ with React 19

**TypeScript:**
- Strict mode enabled (`strict: true`)
- Type annotations required on function parameters and return types
- Avoid `any` where possible; use typed error handlers with `error: any` only when necessary for error objects
- Use `type` imports where appropriate (e.g., `import type { Bookmark, Category } from './types'`)

## Import Organization

**Order:**
1. External libraries (React, third-party packages)
2. Internal types (with `type` prefix when available)
3. Internal services and utilities
4. Components
5. Constants and config

**Example from `App.tsx`:**
```typescript
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Upload, X, Edit2, ... } from 'lucide-react'
import type { Bookmark, Category, TweetRaw, LogEntry } from './types'
import { processBookmarksWithGemini } from './services/geminiService'
import { storage } from './services/storage'
import { TrialCountdown } from './components/TrialCountdown'
import { Button, Input, Label, ... } from './components/UI'
import { ScrollToTop } from './components/ScrollToTop'
import { strings } from './translations'
```

**Path Aliases:**
- None detected; uses relative paths consistently (e.g., `'../types'`, `'./services/geminiService'`)

## Error Handling

**Patterns:**
- Try-catch blocks for async operations and file parsing (e.g., in `geminiService.ts` processBatch, App.tsx file import)
- Custom error messages with context (e.g., `'Failed to parse Gemini response: ' + parseError.message`)
- Error classification: Distinguishes between rate limits (429), timeouts, JSON parsing errors
- Fallback behavior: Creates default/stub data when API fails (e.g., fallback bookmark in geminiService line 264)
- Retry logic with exponential backoff: Implemented in `processBookmarksWithGemini` with `CURRENT_LIMITS.MAX_RETRIES`
- User-facing errors logged to UI via `onLog` callback with type classification (`'error' | 'warning' | 'info' | 'success'`)

**File location examples:**
- `src/services/geminiService.ts:158-172` - JSON parse error handling
- `src/services/geminiService.ts:218-279` - Comprehensive batch error handling with retry
- `src/services/storage.ts:20-50` - API request error handling
- `src/App.tsx:222-267` - Data loading with error logging

## Logging

**Framework:** Native `console` object (no logging library)

**Patterns:**
- `console.error()` for errors and debugging: Used in `geminiService.ts`, `storage.ts`, `App.tsx` for error tracking
- `console.log()` for significant events (e.g., user abort in App.tsx line 462)
- User-facing logs: Separate `onLog` callback system with type classification for UI display (see `addLog` in App.tsx line 285)
- Log entry structure: `{ timestamp: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }`

**Console usage locations:**
- `src/App.tsx:265` - Data loading errors
- `src/App.tsx:462,464` - Processing abort/error
- `src/services/geminiService.ts:169-170` - JSON parse diagnostics
- `src/services/geminiService.ts:220` - Batch processing errors
- `src/services/storage.ts:48` - API request errors

## Comments

**When to Comment:**
- Complex logic or non-obvious transformations (e.g., `cleanContaminatedTitle` function explaining contamination patterns)
- Important configuration with reasoning (e.g., API rate limits with calculations)
- Workarounds and fixes (e.g., "CRITICAL FIX: Truncate long titles WITHIN the JSON string before parsing")
- Removed code with explanation (e.g., "Carousel Modal State (new flow) - REMOVED for Universal Bookmarks")
- Migration notes (e.g., "Migrate old bookmarks: category (string) → categories (array)")

**JSDoc/TSDoc:**
- Minimal use; focus on inline comments for context
- Function signatures have type annotations but sparse documentation comments
- No `@param` or `@returns` blocks observed

## Function Design

**Size:**
- Range: 20-300 lines depending on component/service
- Helper/utility functions: 5-30 lines (e.g., `sanitizeText`, `delay`, `cleanContaminatedTitle`)
- React components: 50-200+ lines (e.g., `BookmarkCard` component within App.tsx)
- Service functions: 50-150 lines (e.g., `processBookmarksWithGemini`)

**Parameters:**
- Named objects for multiple parameters (e.g., `ButtonProps` interface for Button component)
- Callback functions named with `on` prefix (e.g., `onProgress`, `onLog`, `onEdit`)
- Optional parameters via union types and defaults (e.g., `priority?: 'normal' | 'high' = 'normal'`)
- Typed error handlers allow `error: any` when dealing with unknown error shapes

**Return Values:**
- Explicit return types on all exported functions
- Async functions return `Promise<T>` or `Promise<void>`
- React components return `JSX.Element` or `null` (conditional rendering)
- Service functions return typed data structures (e.g., `Promise<ProcessedTweetResult[]>`)
- Helper functions return transformed/validated data with clear types

## Module Design

**Exports:**
- Named exports for functions and types (preferred): `export const`, `export interface`
- Default export only for root components where appropriate (none observed in src/)
- Type exports use `import type` syntax consistently

**Barrel Files:**
- `UI.tsx` acts as component library barrel, exporting: `Button`, `Card`, `Input`, `TextArea`, `Label`, `Select`, `Badge`, `Modal`
- Types centralized in `types.ts` (single source of truth)
- Services export object with multiple methods (e.g., `storage` export is an object with methods)
- Translations centralized in `translations.ts` with nested object structure

**Object Method Export Pattern (from `storage.ts`):**
```typescript
export const storage = {
  async getBookmarks(): Promise<Bookmark[]> { ... },
  async saveBookmarks(bookmarks: Bookmark[]): Promise<void> { ... },
  async getCategories(): Promise<Category[]> { ... },
  // ...
};
```

---

*Convention analysis: 2026-03-15*
