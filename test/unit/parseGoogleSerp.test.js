import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseGoogleSerp } from '../../src/scraper/parseGoogleSerp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures');

function readFixture(name) {
  return readFileSync(path.join(fixturesDir, name), 'utf8');
}

test('extracts the rate from a real Google SERP fragment', () => {
  const html = readFixture('google-serp-usd-rub-ru-locale.html');
  const result = parseGoogleSerp(html);
  assert.ok(result, 'expected a non-null result');
  assert.equal(result.rate, 85.9106529);
});

test('returns null for a cookie-consent wall page', () => {
  const html = readFixture('google-serp-consent-wall.html');
  assert.equal(parseGoogleSerp(html), null);
});

test('returns null for unexpected/garbage markup without throwing', () => {
  const html = readFixture('google-serp-garbage.html');
  assert.equal(parseGoogleSerp(html), null);
});

test('returns null for empty input', () => {
  assert.equal(parseGoogleSerp(''), null);
  assert.equal(parseGoogleSerp(undefined), null);
});

test('returns null when data-exchange-rate is present but not numeric', () => {
  const html = '<div data-exchange-rate="not-a-number"></div>';
  assert.equal(parseGoogleSerp(html), null);
});
