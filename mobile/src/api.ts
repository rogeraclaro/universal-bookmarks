export { getBookmarks, getCategories, saveBookmark, isDuplicate } from '../../extension/shared/api';
import { API_CONFIG } from '../../extension/shared/config';

export async function callAICategorize(data: {
  url: string;
  title: string;
  description: string;
  categories: string[];
}): Promise<{ categories: string[]; title?: string; description?: string; resolvedUrl?: string }> {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/categorize`, {
      method: 'POST',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return { categories: [] };
    return await response.json();
  } catch {
    return { categories: [] };
  }
}
