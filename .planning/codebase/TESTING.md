# Testing Patterns

**Analysis Date:** 2026-03-15

## Test Framework

**Status:** No testing infrastructure currently implemented.

**Runner:** Not configured
- No test runner (Jest, Vitest, etc.) in package.json
- No test configuration files detected

**Assertion Library:** Not configured

**Run Commands:** Not applicable - no test scripts in package.json

## Test File Organization

**Current State:** Zero test files exist in the codebase (glob search excluding node_modules returned no results).

**Test file naming convention (when implemented):** Not yet established
- Recommendation based on common patterns: Use `.test.ts` or `.spec.ts` suffix
- Recommended location: Co-located with source files (e.g., `src/services/geminiService.test.ts` next to `src/services/geminiService.ts`)

## Test Structure

**Recommended approach (not yet implemented):** Based on codebase complexity, recommend:

1. **Unit test scope:**
   - Pure utility functions: `sanitizeText`, `cleanContaminatedTitle`, `delay`
   - Type validation and data transformation functions
   - Service method contracts

2. **Integration test scope:**
   - Storage API interaction (API vs. localStorage fallback behavior)
   - Gemini service batch processing with mock responses
   - Error handling and retry logic

3. **Component test scope:** (if implemented)
   - Component rendering with different props
   - State management (useState hooks)
   - User interactions (button clicks, form submissions)

**Testing challenges identified in codebase:**
- External API dependency: `GoogleGenAI` requires mocking or integration test setup
- Storage abstraction: Tests must verify both API and localStorage code paths
- Async/retry logic: Complex timing and retry scenarios in `processBookmarksWithGemini`
- AbortController usage: Async cancellation testing

## Mocking

**Framework:** Not currently configured; recommend Vitest with `vi.mock()` or Jest with `jest.mock()`.

**Patterns to establish (not yet implemented):**

```typescript
// Example mock pattern for storage.ts
vi.mock('../services/storage', () => ({
  storage: {
    getBookmarks: vi.fn(),
    saveBookmarks: vi.fn(),
    getCategories: vi.fn(),
    // ... other methods
  }
}));

// Example mock pattern for Gemini API
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn()
    }
  }))
}));
```

**What to Mock:**
- External APIs: `GoogleGenAI` (Gemini service)
- Storage layer: Both API and localStorage code paths
- Environment variables: Mocking `import.meta.env.VITE_API_KEY`, `VITE_STORAGE_API_URL`, `VITE_STORAGE_SECRET`
- Time-dependent logic: `Date.now()`, `setTimeout` for testing retry backoff
- Network requests: `fetch` calls in `apiRequest` function

**What NOT to Mock:**
- Pure utility functions: `sanitizeText`, `cleanContaminatedTitle` - test directly
- React hooks: `useState`, `useEffect` - test via component behavior
- Type transformations and data structure conversions
- Error classification logic (detecting 429, timeout, JSON parse errors)

## Fixtures and Factories

**Test data (not yet implemented):** Codebase contains multiple complex types requiring fixtures.

**Required fixtures:**

```typescript
// Bookmark fixtures
const mockBookmark: Bookmark = {
  id: 'test-123',
  title: 'Sample Bookmark',
  description: 'Test description',
  author: '@testauthor',
  originalLink: 'https://x.com/user/status/123',
  externalLinks: ['https://example.com'],
  categories: ['Tecnologia'],
  createdAt: Date.now()
};

// TweetRaw fixtures (multiple formats for robustness)
const mockTweetV1: TweetRaw = {
  id_str: '123456',
  full_text: 'Test tweet content',
  created_at: '2025-01-01T00:00:00Z',
  user: { name: 'Test User', screen_name: 'testuser' },
  entities: { urls: [{ expanded_url: 'https://example.com' }] }
};

const mockTweetV2: TweetRaw = {
  id: '123456',
  text: 'Alternative format tweet',
  entities: { urls: [] }
};

// Gemini response fixtures
const mockProcessedResult: ProcessedTweetResult = {
  title: 'Processed Title',
  categories: ['Programació', 'Tecnologia'],
  externalLinks: ['https://example.com'],
  originalId: '123456'
};

// LogEntry fixtures
const mockLogEntry: LogEntry = {
  timestamp: new Date().toISOString(),
  message: 'Test log message',
  type: 'info'
};
```

**Location:** Recommend creating `src/test/fixtures.ts` or `src/__fixtures__/index.ts` for centralized fixture definitions.

## Coverage

**Requirements:** Not enforced - no coverage configuration detected.

**Recommendation:** When test setup is implemented, establish minimum coverage targets:
- Services (geminiService, storage): 80%+ coverage
- Type validation and data transformation: 90%+ coverage
- UI components: 60%+ coverage (less critical for styling/layout)
- Utility functions: 100% coverage (small, pure functions)

**View Coverage:** (when implemented)
```bash
npm run test:coverage        # Run tests with coverage report
npm run test:coverage:open   # Open coverage report in browser
```

## Test Types

**Unit Tests:**
- Scope: Individual functions in isolation
- Approach: Mock all external dependencies
- Examples: `sanitizeText`, `cleanContaminatedTitle`, `toggleCategory`
- Location: `src/services/__tests__/`, `src/utils/__tests__/`

**Integration Tests:**
- Scope: Multiple modules interacting (storage + API, Gemini service + retry logic)
- Approach: Mock external APIs but test actual service code paths
- Examples:
  - Storage: Verify API path vs. localStorage path both work
  - Gemini: Test retry logic with simulated API responses and timeouts
- Location: `src/services/__tests__/` or separate integration test directory

**E2E Tests:**
- Framework: Not currently used - Playwright or Cypress would be suitable
- Scope: Full user workflows (import bookmarks, process with Gemini, view results)
- Would test: File upload → processing → display → export
- Status: Not implemented - recommend adding if production-critical

## Common Patterns

**Async Testing:**

```typescript
// Using Vitest/Jest async syntax
test('processBookmarksWithGemini handles successful batch', async () => {
  const mockGemini = vi.fn().mockResolvedValue({
    text: JSON.stringify([
      {
        originalId: '123',
        title: 'Test',
        categories: ['Tech'],
        externalLinks: []
      }
    ])
  });

  const results = await processBookmarksWithGemini(
    [mockTweet],
    ['Tecnologia'],
    vi.fn(),
    vi.fn()
  );

  expect(results).toHaveLength(1);
});
```

**Error Testing:**

Testing error handling patterns observed in `geminiService.ts`:

```typescript
// Rate limit error testing
test('processBookmarksWithGemini retries on 429 error', async () => {
  const onLog = vi.fn();

  // Simulate rate limit then success
  let callCount = 0;
  vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn(async () => {
          callCount++;
          if (callCount === 1) {
            throw { status: 429, message: 'Rate limited' };
          }
          return { text: JSON.stringify([...]) };
        })
      }
    }))
  }));

  const results = await processBookmarksWithGemini(...);

  expect(onLog).toHaveBeenCalledWith(
    expect.stringContaining('429'),
    'warning'
  );
  expect(results).toBeDefined();
});

// JSON parse error testing
test('geminiService handles malformed JSON response', async () => {
  const mockGemini = vi.fn().mockResolvedValue({
    text: '{"incomplete": "json'  // Invalid JSON
  });

  expect(async () => {
    await processBatch([mockTweet], ['Tecnologia']);
  }).rejects.toThrow('Failed to parse Gemini response');
});

// Timeout error testing
test('processBookmarksWithGemini handles timeout', async () => {
  const mockGemini = vi.fn().mockImplementation(
    () => new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), 200);
    })
  );

  // API call timeout should be caught by timeout wrapper
  // Verify exponential backoff was triggered
});
```

**AbortController testing:**

```typescript
test('processBookmarksWithGemini respects abort signal', async () => {
  const controller = new AbortController();

  // Start processing, then abort
  const promise = processBookmarksWithGemini(
    largeTweetArray,
    ['Tech'],
    vi.fn(),
    vi.fn(),
    controller.signal
  );

  // Abort after brief delay
  setTimeout(() => controller.abort(), 100);

  expect(promise).rejects.toThrow('AbortError');
});
```

**Storage path testing:**

```typescript
test('storage uses API when secret is configured', async () => {
  vi.stubEnv('VITE_STORAGE_SECRET', 'test-secret');
  vi.stubEnv('VITE_STORAGE_API_URL', 'https://api.example.com');

  const fetchSpy = vi.spyOn(global, 'fetch');

  await storage.getBookmarks();

  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining('bookmarks'),
    expect.objectContaining({
      headers: expect.objectContaining({
        'x-api-secret': 'test-secret'
      })
    })
  );
});

test('storage falls back to localStorage when no secret', async () => {
  vi.stubEnv('VITE_STORAGE_SECRET', undefined);

  const localStorageSpy = vi.spyOn(Storage.prototype, 'getItem');

  await storage.getBookmarks();

  expect(localStorageSpy).toHaveBeenCalledWith('universal-bookmarks-data');
});
```

## Testing Philosophy

**Key areas requiring comprehensive testing:**
1. **Data transformation:** Ensure bookmark migration (old `category` → new `categories[]`) works correctly
2. **API resilience:** Retry logic, backoff timing, error classification
3. **Storage abstraction:** Both API and localStorage paths behave identically
4. **Gemini response handling:** JSON parsing, title contamination cleaning, fallback creation
5. **Rate limit handling:** Dynamic limits based on trial status

**Low test priority:**
- Styling/className rendering (covered by visual testing)
- Component mount/unmount (standard React behavior)
- Translation string rendering (covered by visual inspection)

---

*Testing analysis: 2026-03-15*
