
export interface TweetRaw {
  full_text?: string; // Common export format
  text?: string;      // Alternative
  id_str?: string;
  id?: string;
  created_at?: string;
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
  category: string;
  createdAt: number;
}

export type Category = string;

// Gemini Service Types
export interface ProcessedTweetResult {
  isAI: boolean;
  title: string;
  // description removed as we use raw text
  category: string;
  externalLinks: string[];
  originalId: string;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}
