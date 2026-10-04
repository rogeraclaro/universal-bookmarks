import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveBookmark } from '../shared/api';
import type { Bookmark } from '../shared/types';

const bookmark = {
  id: 'abc',
  title: 'Example',
  originalLink: 'https://example.com',
} as unknown as Bookmark;

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'x',
    json: async () => body,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('saveBookmark', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('makes exactly one POST to /bookmarks/add with {bookmark}', async () => {
    const fetchMock = mockFetch(201, { success: true, duplicate: false, id: 'abc' });
    await saveBookmark(bookmark);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://links.masellas.info/api/bookmarks/add');
    expect(options.method).toBe('POST');
    expect(options.headers).toHaveProperty('x-api-secret');
    expect(JSON.parse(options.body)).toEqual({ bookmark });
  });

  it('treats duplicate:true (200) as success', async () => {
    mockFetch(200, { success: true, duplicate: true, id: 'abc' });
    await expect(saveBookmark(bookmark)).resolves.toBeUndefined();
  });

  it('throws on server error', async () => {
    mockFetch(400, { success: false });
    await expect(saveBookmark(bookmark)).rejects.toThrow();
  });
});
