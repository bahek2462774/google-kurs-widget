// Manual, occasional check against the real rate API. Run explicitly with:
// npm run test:live

import { fetchRate } from '../../src/scraper/rateApiClient.js';

const pairs = [
  ['USD', 'RUB'],
  ['EUR', 'RUB']
];

for (const [from, to] of pairs) {
  const result = await fetchRate(from, to);
  if (result) {
    console.log(`OK   ${from}${to}: ${result.rate} (fetched at ${result.fetchedAt.toISOString()})`);
  } else {
    console.log(`FAIL ${from}${to}: no rate extracted`);
  }
}
