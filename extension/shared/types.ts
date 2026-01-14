// Bookmark interface (matches webapp)
export interface Bookmark {
  id: string;
  title: string;
  description: string;
  author: string;
  originalLink: string;
  externalLinks: string[];
  categories: string[];
  createdAt: number;
}

// Metadata extracted from webpage
export interface ExtractedMetadata {
  title: string;
  description: string;
  author: string;
  url: string;
}

// Message types for Chrome messaging
export interface Message {
  type: 'GET_METADATA' | 'SAVE_BOOKMARK' | 'CHECK_DUPLICATE' | 'GET_CATEGORIES' | 'SAVE_CATEGORY';
  data?: any;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// API Response types
export interface APIBookmarksResponse {
  data: Bookmark[];
}

export interface APICategoriesResponse {
  data: string[];
}

export interface APISaveResponse {
  success: boolean;
}
