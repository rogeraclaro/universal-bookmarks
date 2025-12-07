import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import type { TweetRaw, ProcessedTweetResult } from "../types";
import { strings } from "../translations";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Clean titles that contain contamination from other JSON fields
const cleanContaminatedTitle = (title: string): string => {
  if (!title) return title;

  // Remove contamination patterns like: ","category":"... or ','category':'...
  // These appear when Gemini's response gets truncated mid-JSON
  const contaminationPatterns = [
    /[",]['"]category['"]:/i,
    /[",]['"]isAI['"]:/i,
    /[",]['"]externalLinks['"]:/i,
    /[",]['"]originalId['"]:/i,
  ];

  let cleaned = title;
  for (const pattern of contaminationPatterns) {
    const match = cleaned.match(pattern);
    if (match && match.index !== undefined) {
      // Cut the title just before the contamination
      cleaned = cleaned.substring(0, match.index).trim();
      break;
    }
  }

  // Remove trailing punctuation artifacts
  cleaned = cleaned.replace(/[.,;:]+$/, '');

  return cleaned;
};

// Sanitize text to prevent JSON parsing errors and reduce length
const sanitizeText = (text: string): string => {
  return text
    .replace(/#\w+/g, '') // Remove hashtags (#AI, #MachineLearning, etc.)
    .replace(/@\w+/g, '') // Remove mentions (@username)
    .replace(/[\r\n]+/g, ' ') // Replace newlines with spaces
    .replace(/\t/g, ' ') // Replace tabs with spaces
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Compress multiple spaces into one
    .trim()
    .substring(0, 700); // Truncate to 700 chars (reduced from 1000)
};

const processBatch = async (
  tweets: TweetRaw[],
  categories: string[],
  timeoutMs: number = 90000 // 90 second timeout
): Promise<ProcessedTweetResult[]> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  // Sanitize and simplify tweets
  const simplifiedTweets = tweets.map((t) => ({
    id: t.id_str || t.id || Math.random().toString(),
    text: sanitizeText(t.full_text || t.text || ""),
    urls: t.entities?.urls?.map((u) => u.expanded_url) || [],
  }));

  const categoriesString = categories.join(", ");
  const systemInstruction = strings.prompts.systemInstruction(categoriesString);

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        originalId: { type: Type.STRING, description: "The ID of the processed tweet" },
        isAI: { type: Type.BOOLEAN, description: "Is this tweet related to Artificial Intelligence?" },
        title: { type: Type.STRING, description: "A VERY short descriptive title in Catalan (max 80 characters, 10 words)" },
        description: { type: Type.STRING, description: "A summary of the content in Catalan" },
        categories: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Array of assigned categories. A tweet can belong to multiple categories if it covers multiple topics."
        },
        externalLinks: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of relevant external URLs found"
        },
      },
      required: ["originalId", "isAI"],
    },
  };

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout after ' + (timeoutMs / 1000) + 's')), timeoutMs);
  });

  // Race between API call and timeout
  const response = await Promise.race([
    ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: JSON.stringify(simplifiedTweets),
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        maxOutputTokens: 800, // Reduced to prevent infinite title generation
        temperature: 0.3, // Lower temperature for more focused responses
      },
    }),
    timeoutPromise
  ]);

  let jsonText = response.text;
  if (!jsonText) return [];

  // Clean up markdown code blocks if present
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/```$/, "");
  }

  // Additional cleanup for malformed JSON
  jsonText = jsonText
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
    .trim();

  // CRITICAL FIX: Truncate long titles WITHIN the JSON string before parsing
  // This prevents "Unterminated string" errors caused by infinite title generation
  jsonText = jsonText.replace(
    /"title"\s*:\s*"([^"]{100,})"/g,
    (_match, title) => {
      // Truncate titles longer than 100 chars to prevent JSON parsing errors
      const truncated = title.substring(0, 97) + '...';
      return `"title":"${truncated}"`;
    }
  );

  try {
    const parsed = JSON.parse(jsonText) as ProcessedTweetResult[];

    // Additional validation and cleanup
    return parsed.map(item => ({
      ...item,
      title: item.title && item.title.length > 100
        ? item.title.substring(0, 97) + '...'
        : cleanContaminatedTitle(item.title)
    }));
  } catch (parseError: any) {
    console.error('JSON Parse Error:', parseError);
    console.error('Problematic JSON:', jsonText.substring(0, 500));
    throw new Error('Failed to parse Gemini response: ' + parseError.message);
  }
};

export const processBookmarksWithGemini = async (
  rawTweets: TweetRaw[],
  currentCategories: string[],
  onProgress: (current: number, total: number) => void,
  onLog: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void,
  signal?: AbortSignal
): Promise<ProcessedTweetResult[]> => {
  const BATCH_SIZE = 1;
  const results: ProcessedTweetResult[] = [];
  const validTweets = rawTweets.filter(t => (t.full_text || t.text));

  for (let i = 0; i < validTweets.length; i += BATCH_SIZE) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const batch = validTweets.slice(i, i + BATCH_SIZE);
    onProgress(i, validTweets.length);
    onLog(strings.logs.batchStart.replace("{0}", String(i + 1)).replace("{1}", String(validTweets.length)), 'info');

    // Retry logic with exponential backoff
    let attempts = 0;
    const maxAttempts = 10;
    let success = false;
    // Start with a significant delay if we hit a rate limit to allow quota to reset
    let backoffDelay = 10000;

    while (attempts < maxAttempts && !success) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      try {
        onLog(strings.logs.analyzing, 'info');
        const batchResults = await processBatch(batch, currentCategories);
        results.push(...batchResults);
        success = true;
        onLog(strings.logs.batchSuccess, 'success');

        // Successful request throttling
        // Free tier is ~15 RPM. 60s / 15 = 4s per request.
        // We add a 4000ms delay to be safe and avoid hitting the limit constantly.
        if (i + BATCH_SIZE < validTweets.length) {
          onLog(strings.logs.cooldown, 'info');
          await delay(4000);
        }

      } catch (error: any) {
        attempts++;
        console.error("Batch processing error:", error);

        // Detect different error types
        const isRateLimit =
          error.message?.includes("429") ||
          error.status === 429 ||
          error.error?.code === 429 ||
          JSON.stringify(error).includes("RESOURCE_EXHAUSTED");

        const isTimeout = error.message?.includes("timeout");
        const isJSONError = error.message?.includes("parse") || error.message?.includes("JSON");

        if (isRateLimit) {
          onLog(strings.logs.ratelimitHit.replace("{0}", String(backoffDelay / 1000)), 'warning');
          await delay(backoffDelay);
          // Cap backoff at 60s
          backoffDelay = Math.min(backoffDelay * 1.5, 60000);
        } else if (isTimeout) {
          onLog(`⏱️ Timeout després de 90s. Reintentant...`, 'warning');
          if (attempts < maxAttempts) {
            await delay(3000);
          }
        } else if (isJSONError) {
          onLog(`🔧 Error de format JSON. Reintentant...`, 'warning');
          if (attempts < maxAttempts) {
            await delay(2000);
          }
        } else {
          onLog(strings.logs.error.replace("{0}", error.message || "Unknown"), 'error');
          if (attempts < maxAttempts) {
            onLog(strings.logs.retrying, 'warning');
            await delay(2000);
          }
        }

        // If we've failed all attempts, create fallback bookmark without Gemini
        if (attempts >= maxAttempts) {
          onLog(`⚠️ Gemini ha fallat ${maxAttempts} vegades. Creant entrada sense processar...`, 'warning');

          // Extract the original tweet data
          const originalTweet = batch[0];
          const tweetText = originalTweet.full_text || originalTweet.text || "";

          // Create fallback result with minimal processing
          const fallbackResult: ProcessedTweetResult = {
            originalId: originalTweet.id_str || originalTweet.id || Math.random().toString(),
            isAI: false, // Mark as non-AI so user can review manually
            title: tweetText.length > 80
              ? tweetText.substring(0, 77) + "..."
              : tweetText || "Tweet sobre IA",
            categories: ["Altres"], // Default category for unprocessed tweets
            externalLinks: originalTweet.entities?.urls?.map((u: any) => u.expanded_url).filter((url: string) =>
              !url.includes('twitter.com') && !url.includes('x.com')
            ) || []
          };

          results.push(fallbackResult);
          onLog(`✓ Entrada creada sense Gemini (títol extret del text original)`, 'success');
          success = true; // Mark as success to continue with next tweet
        }
      }
    }
  }

  onProgress(validTweets.length, validTweets.length);
  return results;
};