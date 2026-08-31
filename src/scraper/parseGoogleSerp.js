import * as cheerio from 'cheerio';

/**
 * Pure function: Google SERP HTML -> parsed exchange rate, or null.
 * Any failure to find/parse the rate (missing selector, consent wall,
 * captcha, unexpected markup) collapses to a single `null` result --
 * callers treat that as "keep the last known cached value".
 */
export function parseGoogleSerp(html) {
  if (typeof html !== 'string' || html.length === 0) {
    return null;
  }

  let $;
  try {
    $ = cheerio.load(html);
  } catch {
    return null;
  }

  const el = $('[data-exchange-rate]').first();
  if (el.length === 0) {
    return null;
  }

  const rawRate = el.attr('data-exchange-rate');
  const rate = Number.parseFloat(rawRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  return { rate };
}
