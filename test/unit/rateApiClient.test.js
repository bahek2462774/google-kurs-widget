import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { fetchRate } from '../../src/scraper/rateApiClient.js';

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

test('fetchRate resolves the rate on a valid API response', async () => {
  const { server, port } = await startServer((req, res) => {
    assert.equal(req.url, '/google-kurs-widget/USDRUB');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pair: 'USDRUB', rate: 86.3, updatedAt: '2026-08-31T19:35:27.382Z', ageSec: 5, stale: false }));
  });
  process.env.RATE_API_BASE_URL = `http://127.0.0.1:${port}`;
  try {
    const result = await fetchRate('USD', 'RUB');
    assert.ok(result);
    assert.equal(result.rate, 86.3);
    assert.equal(result.fetchedAt.toISOString(), '2026-08-31T19:35:27.382Z');
  } finally {
    delete process.env.RATE_API_BASE_URL;
    server.close();
  }
});

test('fetchRate resolves null (never throws) on 400 invalid pair format', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid pair format' }));
  });
  process.env.RATE_API_BASE_URL = `http://127.0.0.1:${port}`;
  try {
    assert.equal(await fetchRate('USD', 'RUB'), null);
  } finally {
    delete process.env.RATE_API_BASE_URL;
    server.close();
  }
});

test('fetchRate resolves null (never throws) on 502 rate unavailable', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'rate unavailable' }));
  });
  process.env.RATE_API_BASE_URL = `http://127.0.0.1:${port}`;
  try {
    assert.equal(await fetchRate('USD', 'RUB'), null);
  } finally {
    delete process.env.RATE_API_BASE_URL;
    server.close();
  }
});

test('fetchRate resolves null (never throws) on 429 rate-limited', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(429, { 'Content-Type': 'text/plain' });
    res.end('Too many requests, please try again later.');
  });
  process.env.RATE_API_BASE_URL = `http://127.0.0.1:${port}`;
  try {
    assert.equal(await fetchRate('USD', 'RUB'), null);
  } finally {
    delete process.env.RATE_API_BASE_URL;
    server.close();
  }
});

test('fetchRate resolves null (never throws) when the server is unreachable', async () => {
  process.env.RATE_API_BASE_URL = 'http://127.0.0.1:1';
  try {
    assert.equal(await fetchRate('USD', 'RUB', { timeoutMs: 2000 }), null);
  } finally {
    delete process.env.RATE_API_BASE_URL;
  }
});

test('fetchRate resolves null (never throws) on a malformed JSON body', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('not json');
  });
  process.env.RATE_API_BASE_URL = `http://127.0.0.1:${port}`;
  try {
    assert.equal(await fetchRate('USD', 'RUB'), null);
  } finally {
    delete process.env.RATE_API_BASE_URL;
    server.close();
  }
});
