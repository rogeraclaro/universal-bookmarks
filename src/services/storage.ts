import type { Bookmark, Category } from '../types';
import { strings } from '../translations';

const KEYS = {
  BOOKMARKS: 'universal-bookmarks-data',
  CATEGORIES: 'universal-bookmarks-categories',
  DELETED_IDS: 'universal-bookmarks-deleted-ids'
};

const API_URL = import.meta.env.VITE_STORAGE_API_URL;
const API_SECRET = import.meta.env.VITE_STORAGE_SECRET;

// Strategy: Use API if Secret is configured, otherwise LocalStorage
const USE_API = !!API_SECRET;

// Helper function to handle API requests
async function apiRequest<T>(endpoint: string, method: 'GET' | 'POST', data?: any): Promise<T | null> {
  if (!API_SECRET) return null;

  try {
    // Construct URL: If API_URL is empty/undefined, treat as relative path (for VPS serving)
    // Otherwise use the full absolute URL provided in env
    const baseUrl = API_URL || '';
    // Remove trailing slash if present to avoid // in url
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const url = `${cleanBaseUrl}/${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': API_SECRET
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Storage API Error (${endpoint}):`, error);
    throw error;
  }
}

export type BookmarkOps = {
  add: Bookmark[];
  update: (Partial<Bookmark> & { id: string })[];
  remove: string[];
};

// Pure diff keyed by id. Order is ignored; a changed bookmark is sent whole as an update.
export function diffBookmarks(previous: Bookmark[], next: Bookmark[]): BookmarkOps {
  const previousById = new Map(previous.map(b => [b.id, b]));
  const nextIds = new Set(next.map(b => b.id));
  const add: Bookmark[] = [];
  const update: BookmarkOps['update'] = [];
  for (const bookmark of next) {
    const before = previousById.get(bookmark.id);
    if (!before) add.push(bookmark);
    else if (JSON.stringify(before) !== JSON.stringify(bookmark)) update.push(bookmark);
  }
  const remove = previous.filter(b => !nextIds.has(b.id)).map(b => b.id);
  return { add, update, remove };
}

// API mode only: what the server is known to hold. null = never loaded, so never write blind.
let lastSynced: Bookmark[] | null = null;
// Serializes overlapping saves so lastSynced cannot go backwards.
let syncChain: Promise<unknown> = Promise.resolve();

const snapshot = (bookmarks: Bookmark[]): Bookmark[] => JSON.parse(JSON.stringify(bookmarks));

async function syncBookmarks(next: Bookmark[]): Promise<void> {
  if (lastSynced === null) return;
  const ops = diffBookmarks(lastSynced, next);
  if (!ops.add.length && !ops.update.length && !ops.remove.length) return;
  await apiRequest('bookmarks/ops', 'POST', ops);
  lastSynced = snapshot(next);
}

export const storage = {
  async getBookmarks(): Promise<Bookmark[]> {
    if (USE_API) {
      const res = await apiRequest<{ data: Bookmark[] }>('bookmarks', 'GET');
      return res?.data || [];
    }
    const saved = localStorage.getItem(KEYS.BOOKMARKS);
    return saved ? JSON.parse(saved) : [];
  },

  // Call this ONLY once the app has really put the loaded list in its state. Reading is not enough:
  // if a sibling request fails and the app keeps an empty list, syncing against a list it never
  // adopted would diff as "everything was deleted" and wipe the server.
  markLoaded(loaded: Bookmark[]): void {
    lastSynced = snapshot(loaded);
  },

  async saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
    if (USE_API) {
      const run = syncChain.then(() => syncBookmarks(bookmarks));
      // Keep the chain alive after a failure; the caller still sees the rejection.
      syncChain = run.catch(() => {});
      return run;
    }
    localStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(bookmarks));
  },

  async getCategories(): Promise<Category[]> {
    if (USE_API) {
      const res = await apiRequest<{ data: Category[] }>('categories', 'GET');
      // Ensure we return default categories if the server list is empty
      return (res?.data && res.data.length > 0) ? res.data : strings.defaults.categories;
    }
    const saved = localStorage.getItem(KEYS.CATEGORIES);
    return saved ? JSON.parse(saved) : strings.defaults.categories;
  },

  async saveCategories(categories: Category[]): Promise<void> {
    if (USE_API) {
      await apiRequest('categories', 'POST', { data: categories });
      return;
    }
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
  },

  async getDeletedIds(): Promise<string[]> {
    if (USE_API) {
      const res = await apiRequest<{ data: string[] }>('deleted', 'GET');
      return res?.data || [];
    }
    const saved = localStorage.getItem(KEYS.DELETED_IDS);
    return saved ? JSON.parse(saved) : [];
  },

  async saveDeletedIds(ids: string[]): Promise<void> {
    if (USE_API) {
      await apiRequest('deleted', 'POST', { data: ids });
      return;
    }
    localStorage.setItem(KEYS.DELETED_IDS, JSON.stringify(ids));
  },

  async clearData(): Promise<void> {
    if (USE_API) {
      await apiRequest('reset', 'POST', {});
      // Also clear local just in case
      localStorage.removeItem(KEYS.BOOKMARKS);
      localStorage.removeItem(KEYS.CATEGORIES);
      localStorage.removeItem(KEYS.DELETED_IDS);
      return;
    }
    localStorage.removeItem(KEYS.BOOKMARKS);
    localStorage.removeItem(KEYS.CATEGORIES);
    localStorage.removeItem(KEYS.DELETED_IDS);
  },

  async clearBookmarks(): Promise<void> {
    if (USE_API) {
      // Legacy replace-all is upsert-only on the server now: deletions must go through ops.
      const current = await this.getBookmarks();
      // force: the server refuses mass deletions unless explicitly confirmed (this is the user's confirmed reset)
      if (current.length) await apiRequest('bookmarks/ops', 'POST', { remove: current.map(b => b.id), force: true });
      lastSynced = [];
      // /deleted merges by default; replace:true is the explicit "clear the blacklist" intent
      await apiRequest('deleted', 'POST', { data: [], replace: true });
      localStorage.removeItem(KEYS.BOOKMARKS);
      localStorage.removeItem(KEYS.DELETED_IDS);
      return;
    }
    localStorage.removeItem(KEYS.BOOKMARKS);
    localStorage.removeItem(KEYS.DELETED_IDS);
  }
};