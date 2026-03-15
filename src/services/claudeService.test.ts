import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TweetRaw } from '../types';

// Dynamic import to get per-test failure if module missing, not top-level crash
const getModule = () => import('./claudeService');

const noop = () => {};
const noopLog = (_msg: string, _type: string) => {};

describe('claudeService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('exports processBookmarksWithClaude function', async () => {
    const mod = await getModule();
    expect(typeof mod.processBookmarksWithClaude).toBe('function');
  });

  it('success path — returns result from proxy on valid response', async () => {
    const mockResult = {
      originalId: '123',
      isAI: true,
      title: 'Test Title',
      categories: ['Tech'],
      externalLinks: []
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResult
    } as any);

    const tweets: TweetRaw[] = [{ id_str: '123', full_text: 'Hello world tweet' }];
    const { processBookmarksWithClaude } = await getModule();
    const results = await processBookmarksWithClaude(tweets, ['Tech'], noop, noopLog);

    expect(results).toHaveLength(1);
    expect(results[0].originalId).toBe('123');
    expect(results[0].title).toBe('Test Title');
  });

  it('fallback path — creates fallback entry when fetch throws network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const tweets: TweetRaw[] = [{ id_str: '456', full_text: 'Some tweet content here' }];
    const { processBookmarksWithClaude } = await getModule();
    const results = await processBookmarksWithClaude(tweets, ['Tech'], noop, noopLog);

    expect(results).toHaveLength(1);
    expect(results[0].categories).toEqual(['Altres']);
    expect(results[0].originalId).toBe('456');
  });

  it('abort signal — throws AbortError if signal.aborted before processing', async () => {
    global.fetch = vi.fn();

    const tweets: TweetRaw[] = [{ id_str: '789', full_text: 'Tweet to abort' }];
    const { processBookmarksWithClaude } = await getModule();

    const controller = new AbortController();
    controller.abort();

    await expect(
      processBookmarksWithClaude(tweets, ['Tech'], noop, noopLog, controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('empty input — returns empty array for empty tweet list', async () => {
    global.fetch = vi.fn();

    const { processBookmarksWithClaude } = await getModule();
    const results = await processBookmarksWithClaude([], ['Tech'], noop, noopLog);

    expect(results).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});
