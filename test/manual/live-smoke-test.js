// Manual, occasional check against the REAL Google -- never run this from
// `npm test` / CI. Run explicitly with: npm run test:live
//
// Prints whether the scraper still successfully extracts a rate from the
// live page, or hit a failure mode (consent wall, captcha, markup drift,
// network error). Avoid running this often -- frequent automated hits to
// Google search from the same IP risk triggering abuse detection.

import { fetchRate } from '../../src/scraper/googleRateScraper.js';

const pairs = [
  ['USD', 'RUB'],
  ['EUR', 'RUB']
];

for (const [from, to] of pairs) {
  const result = await fetchRate(from, to, { locale: 'ru' });
  if (result) {
    console.log(`OK   ${from}->${to}: ${result.rate} (fetched at ${result.fetchedAt.toISOString()})`);
  } else {
    console.log(`FAIL ${from}->${to}: no rate extracted -- likely consent wall, captcha, or markup drift`);
  }
}
