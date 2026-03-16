
export interface TweetRaw {
  full_text?: string; // Common export format
  text?: string;      // Alternative
  id_str?: string;
  id?: string;
  created_at?: string;
  author?: string;    // Format: "Name@username·date"
  user?: {
    name?: string;
    screen_name?: string;
  };
  entities?: {
    urls?: Array<{ expanded_url: string }>;
  };
  [key: string]: any;
}

export interface Bookmark {
  id: string;
  title: string;
  description: string; // Now stores the raw tweet text
  author: string;      // New field
  originalLink: string;
  externalLinks: string[];
  categories: string[]; // Changed from 'category' to 'categories' array
  createdAt: number;
  highlighted?: boolean; // Visual highlight flag
}

export type Category = string;

// AI Service Types
export interface ProcessedTweetResult {
  title: string;
  // description removed as we use raw text
  categories: string[]; // Changed from 'category' to 'categories' array
  externalLinks: string[];
  originalId: string;
  isAI?: boolean;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}
