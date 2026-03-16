export function resolveAuthorFromUrl(url: string): string {
  if (/github\.com/i.test(url)) return 'github';
  if (/twitter\.com|x\.com/i.test(url)) return 'twitter';
  return 'web';
}

export interface ShareParams {
  url: string;
  title: string;
}

export function parseShareParams(search: string): ShareParams {
  const params = new URLSearchParams(search);
  const url = params.get('url') || params.get('text') || '';
  const title = params.get('title') || '';
  return { url, title };
}
