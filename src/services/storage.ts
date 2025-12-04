import { Bookmark, Category } from '../types';
import { strings } from '../translations';

const KEYS = {
  BOOKMARKS: 'ai-bookmarks-data',
  CATEGORIES: 'ai-bookmarks-categories',
  DELETED_IDS: 'ai-bookmarks-deleted-ids'
};

const API_URL = import.meta.env.VITE_STORAGE_API_URL;
const API_SECRET = import.meta.env.VITE_STORAGE_SECRET;

// Helper function to handle API requests
async function apiRequest<T>(endpoint: string, method: 'GET' | 'POST', data?: any): Promise<T | null> {
  if (!API_URL || !API_SECRET) return null;

  try {
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

    const response = await fetch(`${API_URL}/${endpoint}`, options);

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Storage API Error (${endpoint}):`, error);
    // Fallback logic or error handling could go here
    throw error; // Re-throw so the UI knows something failed
  }
}

export const storage = {
  async getBookmarks(): Promise<Bookmark[]> {
    if (API_URL) {
      const res = await apiRequest<{ data: Bookmark[] }>('bookmarks', 'GET');
      return res?.data || [];
    }
    const saved = localStorage.getItem(KEYS.BOOKMARKS);
    return saved ? JSON.parse(saved) : [];
  },

  async saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
    if (API_URL) {
      await apiRequest('bookmarks', 'POST', { data: bookmarks });
      return;
    }
    localStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(bookmarks));
  },

  async getCategories(): Promise<Category[]> {
    if (API_URL) {
      const res = await apiRequest<{ data: Category[] }>('categories', 'GET');
      // Ensure we return default categories if the server list is empty
      return (res?.data && res.data.length > 0) ? res.data : strings.defaults.categories;
    }
    const saved = localStorage.getItem(KEYS.CATEGORIES);
    return saved ? JSON.parse(saved) : strings.defaults.categories;
  },

  async saveCategories(categories: Category[]): Promise<void> {
    if (API_URL) {
      await apiRequest('categories', 'POST', { data: categories });
      return;
    }
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
  },

  async getDeletedIds(): Promise<string[]> {
    if (API_URL) {
      const res = await apiRequest<{ data: string[] }>('deleted', 'GET');
      return res?.data || [];
    }
    const saved = localStorage.getItem(KEYS.DELETED_IDS);
    return saved ? JSON.parse(saved) : [];
  },

  async saveDeletedIds(ids: string[]): Promise<void> {
    if (API_URL) {
      await apiRequest('deleted', 'POST', { data: ids });
      return;
    }
    localStorage.setItem(KEYS.DELETED_IDS, JSON.stringify(ids));
  },

  async clearData(): Promise<void> {
    if (API_URL) {
      await apiRequest('reset', 'POST', {});
      // We also clear local storage just in case
      localStorage.removeItem(KEYS.BOOKMARKS);
      localStorage.removeItem(KEYS.CATEGORIES);
      localStorage.removeItem(KEYS.DELETED_IDS);
      return;
    }
    localStorage.removeItem(KEYS.BOOKMARKS);
    localStorage.removeItem(KEYS.CATEGORIES);
    localStorage.removeItem(KEYS.DELETED_IDS);
  }
};