import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchRate } from '../../src/scraper/googleRateScraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
  path.join(__dirname, '../fixtures/google-serp-usd-rub-ru-locale.html'),
  'utf8'
);

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

test('fetchRate resolves the rate when the server returns a valid fixture', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fixtureHtml);
  });
  process.env.GOOGLE_BASE_URL = `http://127.0.0.1:${port}`;
  try {
    const result = await fetchRate('USD', 'RUB');
    assert.ok(result);
    assert.equal(result.rate, 85.9106529);
    assert.ok(result.fetchedAt instanceof Date);
  } finally {
    delete process.env.GOOGLE_BASE_URL;
    server.close();
  }
});

test('fetchRate resolves null (never throws) on a non-200 response', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(503);
    res.end('unavailable');
  });
  process.env.GOOGLE_BASE_URL = `http://127.0.0.1:${port}`;
  try {
    const result = await fetchRate('USD', 'RUB');
    assert.equal(result, null);
  } finally {
    delete process.env.GOOGLE_BASE_URL;
    server.close();
  }
});

test('fetchRate resolves null (never throws) when the server is unreachable', async () => {
  // Port 1 is a privileged, essentially-never-listening port -- fast, reliable ECONNREFUSED.
  process.env.GOOGLE_BASE_URL = 'http://127.0.0.1:1';
  try {
    const result = await fetchRate('USD', 'RUB', { timeoutMs: 2000 });
    assert.equal(result, null);
  } finally {
    delete process.env.GOOGLE_BASE_URL;
  }
});

test('fetchRate resolves null (never throws) when currency input is malformed enough to break URL building', async () => {
  // A lone UTF-16 surrogate makes encodeURIComponent() throw a URIError.
  // fetchRate must swallow that rather than propagate an unhandled rejection
  // to its callers (the scheduler loop, or a tray click handler with no .catch).
  const result = await fetchRate('\uD800', 'RUB');
  assert.equal(result, null);
});
