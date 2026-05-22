import type { TweetRaw, ProcessedTweetResult } from '../types';

const BATCH_SIZE = 1;
const MAX_RETRIES = 3;
const DELAY_MS = 2000;
const TIMEOUT_MS = 90000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Sanitization logic (migrated from legacy AI service)
const sanitizeText = (text: string): string => {
  return text
    .replace(/#\w+/g, '')          // Remove hashtags
    .replace(/@\w+/g, '')          // Remove mentions
    .replace(/[\r\n]+/g, ' ')      // Replace newlines with spaces
    .replace(/\t/g, ' ')           // Replace tabs with spaces
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ')          // Compress multiple spaces
    .trim()
    .substring(0, 700);            // Truncate to 700 chars
};

export const processBookmarksWithClaude = async (
  rawTweets: TweetRaw[],
  currentCategories: string[],
  onProgress: (current: number, total: number) => void,
  onLog: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void,
  signal?: AbortSignal
): Promise<ProcessedTweetResult[]> => {
  const proxyUrl = 'https://links.masellas.info/api';
  const results: ProcessedTweetResult[] = [];
  const validTweets = rawTweets.filter(t => (t.full_text || t.text));

  for (let i = 0; i < validTweets.length; i += BATCH_SIZE) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const tweet = validTweets[i];
    onProgress(i, validTweets.length);
    onLog(`Analitzant tweet ${i + 1} de ${validTweets.length}...`, 'info');

    const tweetId = tweet.id_str || tweet.id || Math.random().toString();
    const tweetText = tweet.full_text || tweet.text || '';
    const sanitized = sanitizeText(tweetText);
    const urls = tweet.entities?.urls?.map(u => u.expanded_url) || [];

    let attempts = 0;
    let success = false;

    while (attempts < MAX_RETRIES && !success) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      try {
        const response = await fetch(`${proxyUrl}/process-tweet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-secret': '4eb6fd03128af657e3b37c1467d00823',
          },
          body: JSON.stringify({
            tweet: { id: tweetId, text: sanitized, urls },
            categories: currentCategories
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS)
        });

        if (!response.ok) {
          throw new Error(`Proxy returned ${response.status}`);
        }

        const result = await response.json() as ProcessedTweetResult;
        results.push(result);
        success = true;
        onLog('Tweet processat correctament', 'success');

      } catch (error: unknown) {
        attempts++;
        if (attempts < MAX_RETRIES) {
          onLog(`Error processant tweet. Reintentant (${attempts}/${MAX_RETRIES})...`, 'warning');
          await delay(DELAY_MS);
        }
      }
    }

    if (!success) {
      onLog('Proxy no disponible. Creant entrada sense AI...', 'warning');
      const fallback: ProcessedTweetResult = {
        originalId: tweetId,
        title: tweetText.length > 80
          ? tweetText.substring(0, 77) + '...'
          : tweetText || 'Contingut sense títol',
        categories: ['Altres'],
        externalLinks: urls.filter(u => !u.includes('twitter.com') && !u.includes('x.com'))
      };
      results.push(fallback);
    }
  }

  onProgress(validTweets.length, validTweets.length);
  return results;
};
