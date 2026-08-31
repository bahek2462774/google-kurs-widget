const DEFAULT_BASE_URL = 'https://www.google.com';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export function buildSearchUrl(from, to, locale = 'ru') {
  const baseUrl = process.env.GOOGLE_BASE_URL || DEFAULT_BASE_URL;
  const query = encodeURIComponent(`${from} to ${to}`);
  return `${baseUrl}/search?q=${query}&hl=${encodeURIComponent(locale)}`;
}

export function buildSearchHeaders(locale = 'ru') {
  return {
    'User-Agent': USER_AGENT,
    'Accept-Language': `${locale},en;q=0.8`,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
  };
}
