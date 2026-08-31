import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSearchUrl, buildSearchHeaders } from '../../src/scraper/buildSearchUrl.js';

test('builds a Google search URL with the query and locale', () => {
  const url = buildSearchUrl('USD', 'RUB', 'ru');
  assert.equal(url, 'https://www.google.com/search?q=USD%20to%20RUB&hl=ru');
});

test('respects GOOGLE_BASE_URL override for testing', () => {
  process.env.GOOGLE_BASE_URL = 'http://localhost:12345';
  try {
    const url = buildSearchUrl('EUR', 'RUB', 'ru');
    assert.equal(url, 'http://localhost:12345/search?q=EUR%20to%20RUB&hl=ru');
  } finally {
    delete process.env.GOOGLE_BASE_URL;
  }
});

test('builds headers with the requested Accept-Language', () => {
  const headers = buildSearchHeaders('de');
  assert.match(headers['Accept-Language'], /^de,/);
  assert.ok(headers['User-Agent'].includes('Chrome'));
});
