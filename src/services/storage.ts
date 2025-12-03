

import { Bookmark, Category } from '../types';
import { strings } from '../translations';

const KEYS = {
  BOOKMARKS: 'ai-bookmarks-data',
  CATEGORIES: 'ai-bookmarks-categories',
  DELETED_IDS: 'ai-bookmarks-deleted-ids' // New key for blacklist
};

// --- CURRENT IMPLEMENTATION: LOCAL STORAGE ---
// Quan tinguis la API al VPS, canviarem això per crides 'fetch'

export const storage = {
  async getBookmarks(): Promise<Bookmark[]> {
    // EN EL FUTUR: const res = await fetch('https://tuvps.com/api/bookmarks'); return res.json();
    const saved = localStorage.getItem(KEYS.BOOKMARKS);
    return saved ? JSON.parse(saved) : [];
  },

  async saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
    // EN EL FUTUR: await fetch('https://tuvps.com/api/bookmarks', { method: 'POST', body: ... });
    localStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(bookmarks));
  },

  async getCategories(): Promise<Category[]> {
    const saved = localStorage.getItem(KEYS.CATEGORIES);
    return saved ? JSON.parse(saved) : strings.defaults.categories;
  },

  async saveCategories(categories: Category[]): Promise<void> {
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
  },

  async getDeletedIds(): Promise<string[]> {
    const saved = localStorage.getItem(KEYS.DELETED_IDS);
    return saved ? JSON.parse(saved) : [];
  },

  async saveDeletedIds(ids: string[]): Promise<void> {
    localStorage.setItem(KEYS.DELETED_IDS, JSON.stringify(ids));
  },

  async clearData(): Promise<void> {
    localStorage.removeItem(KEYS.BOOKMARKS);
    localStorage.removeItem(KEYS.CATEGORIES);
    localStorage.removeItem(KEYS.DELETED_IDS);
  }
};