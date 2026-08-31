import { buildSearchUrl, buildSearchHeaders } from './buildSearchUrl.js';
import { parseGoogleSerp } from './parseGoogleSerp.js';

/**
 * Never throws. Returns { rate, fetchedAt } on success, or null on any
 * failure (network error, timeout, non-200, consent wall, missing
 * selector, malformed markup). Callers must keep the last cached value
 * when this returns null.
 */
export async function fetchRate(fromCurrency, toCurrency, { locale = 'ru', timeoutMs = 10000 } = {}) {
  let controller;
  let timer;

  try {
    // Inside the try on purpose: e.g. encodeURIComponent() (used by
    // buildSearchUrl) throws on a lone UTF-16 surrogate, which a garbled
    // paste into the add-pair form could produce -- this function must
    // never throw regardless of where the failure originates.
    const url = buildSearchUrl(fromCurrency, toCurrency, locale);
    const headers = buildSearchHeaders(locale);

    controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      console.warn(`[scraper] ${fromCurrency}->${toCurrency}: HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    const parsed = parseGoogleSerp(html);
    if (!parsed) {
      console.warn(
        `[scraper] ${fromCurrency}->${toCurrency}: rate not found in response (consent wall / captcha / markup drift?)`
      );
      return null;
    }

    return { rate: parsed.rate, fetchedAt: new Date() };
  } catch (err) {
    console.warn(`[scraper] ${fromCurrency}->${toCurrency}: request failed: ${err.message}`);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
