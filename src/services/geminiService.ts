import { GoogleGenAI, Type, Schema } from "@google/genai";
import { TweetRaw, ProcessedTweetResult } from "../types";
import { strings } from "../translations";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const processBatch = async (
  tweets: TweetRaw[],
  categories: string[]
): Promise<ProcessedTweetResult[]> => {

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

  // TRUNCATE text to prevent massive context windows or reflection issues
  const simplifiedTweets = tweets.map((t) => ({
    id: t.id_str || t.id || Math.random().toString(),
    text: (t.full_text || t.text || "").substring(0, 1000),
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
        title: { type: Type.STRING, description: "A short descriptive title in Spanish" },
        description: { type: Type.STRING, description: "A summary of the content in Spanish" },
        category: { type: Type.STRING, description: "The assigned category" },
        externalLinks: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of relevant external URLs found"
        },
      },
      required: ["originalId", "isAI"],
    },
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: JSON.stringify(simplifiedTweets),
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  let jsonText = response.text;
  if (!jsonText) return [];

  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/```$/, "");
  }

  const parsed = JSON.parse(jsonText) as ProcessedTweetResult[];
  return parsed;
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

        // Robust 429 detection (checking various error structures)
        const isRateLimit =
          error.message?.includes("429") ||
          error.status === 429 ||
          error.error?.code === 429 ||
          JSON.stringify(error).includes("RESOURCE_EXHAUSTED");

        if (isRateLimit) {
          onLog(strings.logs.ratelimitHit.replace("{0}", String(backoffDelay / 1000)), 'warning');
          await delay(backoffDelay);
          // Cap backoff at 60s
          backoffDelay = Math.min(backoffDelay * 1.5, 60000);
        } else {
          onLog(strings.logs.error.replace("{0}", error.message || "Unknown"), 'error');
          if (attempts < maxAttempts) {
            onLog(strings.logs.retrying, 'warning');
            await delay(2000);
          }
        }
      }
    }
  }

  onProgress(validTweets.length, validTweets.length);
  return results;
};