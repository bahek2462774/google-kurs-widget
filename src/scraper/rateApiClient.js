// Talks to a small purpose-built backend (VPS + Google Apps Script pulling
// GOOGLEFINANCE) that fetches and caches Google Finance rates server-side,
// refreshed roughly every 30 min, exposed as a public read-only JSON API.
// This replaced an earlier direct-scraping-of-google.com approach, which
// Google's bot detection actively blocks (JS-required shell, then an actual
// CAPTCHA once a real headless browser was tried) -- no HTML parsing or
// browser automation needed here, just a plain fetch + JSON.
const DEFAULT_BASE_URL = 'https://google-kurs-widget.duckdns.org';

function baseUrl() {
  return process.env.RATE_API_BASE_URL || DEFAULT_BASE_URL;
}

/**
 * Never throws. Returns { rate, fetchedAt } on success, or null on any
 * failure (network error, timeout, invalid pair, upstream rate unavailable,
 * rate-limited). Callers must keep the last cached value when this returns
 * null.
 */
export async function fetchRate(fromCurrency, toCurrency, { timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const pair = `${fromCurrency}${toCurrency}`.toUpperCase();
    const url = `${baseUrl()}/google-kurs-widget/${encodeURIComponent(pair)}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`[rate-api] ${pair}: rate-limited (429), will retry next cycle`);
      } else {
        console.warn(`[rate-api] ${pair}: HTTP ${response.status}`);
      }
      return null;
    }

    const data = await response.json();
    const rate = Number(data?.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      console.warn(`[rate-api] ${pair}: response had no usable rate`, data);
      return null;
    }

    const fetchedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    return { rate, fetchedAt: Number.isNaN(fetchedAt.getTime()) ? new Date() : fetchedAt };
  } catch (err) {
    console.warn(`[rate-api] ${fromCurrency}${toCurrency}: request failed: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Never throws. Returns an array of { pair, label } (possibly empty) on
 * success or failure alike -- the catalog is a "nice to have" for the
 * add-pair picker, never something that should block manual entry.
 */
export async function fetchPairsCatalog({ timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl()}/google-kurs-widget/pairs`, { signal: controller.signal });
    if (!response.ok) {
      console.warn(`[rate-api] pairs catalog: HTTP ${response.status}`);
      return [];
    }
    const data = await response.json();
    return Array.isArray(data?.pairs) ? data.pairs : [];
  } catch (err) {
    console.warn(`[rate-api] pairs catalog: request failed: ${err.message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
