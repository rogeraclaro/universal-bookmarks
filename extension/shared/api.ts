import { API_CONFIG } from './config';
import type { Bookmark, APIBookmarksResponse, APICategoriesResponse, APISaveResponse } from './types';

// Generic API request function
async function apiRequest<T>(endpoint: string, method: 'GET' | 'POST', data?: any): Promise<T> {
  const url = `${API_CONFIG.BASE_URL}/${endpoint}`;

  const options: RequestInit = {
    method,
    headers: API_CONFIG.HEADERS,
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return await response.json();
}

// GET all bookmarks (for duplicate check)
export async function getBookmarks(): Promise<Bookmark[]> {
  try {
    const response = await apiRequest<APIBookmarksResponse>('bookmarks', 'GET');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    throw error;
  }
}

// GET categories list
export async function getCategories(): Promise<string[]> {
  try {
    const response = await apiRequest<APICategoriesResponse>('categories', 'GET');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
}

// POST new bookmark (appends to existing bookmarks)
export async function saveBookmark(bookmark: Bookmark): Promise<void> {
  try {
    // First, get all existing bookmarks
    const existingBookmarks = await getBookmarks();

    // Add new bookmark to the array
    const allBookmarks = [...existingBookmarks, bookmark];

    // POST the complete array (backend replaces entire file)
    await apiRequest<APISaveResponse>('bookmarks', 'POST', { data: allBookmarks });
  } catch (error) {
    console.error('Error saving bookmark:', error);
    throw error;
  }
}

// Check if URL is duplicate
export async function isDuplicate(url: string): Promise<boolean> {
  try {
    const bookmarks = await getBookmarks();
    return bookmarks.some(b => b.originalLink === url);
  } catch (error) {
    console.error('Error checking duplicate:', error);
    // If error, allow saving (don't block user)
    return false;
  }
}
