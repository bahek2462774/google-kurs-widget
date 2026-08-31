import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { _electron as electron } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const fixtureHtml = readFileSync(
  path.join(projectRoot, 'test/fixtures/google-serp-usd-rub-ru-locale.html'),
  'utf8'
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reads+parses config.json, retrying until `predicate` passes or we time
// out -- more robust than a fixed sleep-then-read-once, since the exact
// number of concurrent fs writes racing to disk (add-pair write, background
// refresh writes) isn't something a test should need to hardcode timing for.
async function waitForConfig(configPath, predicate, { timeoutMs = 5000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastConfig = null;
  while (Date.now() < deadline) {
    try {
      lastConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      if (predicate(lastConfig)) return lastConfig;
    } catch {
      // file mid-write (temp-rename in progress) or not yet created -- retry
    }
    await sleep(intervalMs);
  }
  throw new Error(`waitForConfig timed out; last seen config: ${JSON.stringify(lastConfig)}`);
}

function startFixtureServer() {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fixtureHtml);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function launchApp() {
  const { server, port } = await startFixtureServer();
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'gkw-e2e-'));
  const app = await electron.launch({
    args: [projectRoot],
    env: {
      ...process.env,
      GOOGLE_BASE_URL: `http://127.0.0.1:${port}`,
      GKW_USER_DATA_DIR: userDataDir
    }
  });
  return {
    app,
    userDataDir,
    async cleanup() {
      await app.close();
      rmSync(userDataDir, { recursive: true, force: true });
      server.close();
    }
  };
}

test('widget renders pair rows and the last-updated footer after a refresh', async () => {
  const { app, cleanup } = await launchApp();
  try {
    const widgetWindow = await app.firstWindow();
    await widgetWindow.waitForSelector('.pair-row', { timeout: 20000 });

    await widgetWindow.waitForFunction(
      () => document.getElementById('footer')?.textContent?.startsWith('Обновлено:'),
      null,
      { timeout: 20000 }
    );

    const rowTexts = await widgetWindow.$$eval('.pair-row', (rows) => rows.map((r) => r.textContent));
    assert.ok(rowTexts.some((t) => t.includes('USD') && t.includes('RUB')));
    assert.ok(rowTexts.every((t) => t.includes('85,91')), 'both pairs should show the fixture rate');

    const footerText = await widgetWindow.$eval('#footer', (el) => el.textContent);
    assert.match(footerText, /^Обновлено: \d{2}:\d{2}$/);
  } finally {
    await cleanup();
  }
});

test('settings: adding a pair persists to config.json on disk', async () => {
  const { app, userDataDir, cleanup } = await launchApp();
  try {
    const widgetWindow = await app.firstWindow();
    await widgetWindow.waitForSelector('.pair-row', { timeout: 20000 });

    await widgetWindow.evaluate(() => window.api.openSettings());
    const settingsWindow = await app.waitForEvent('window', (win) => win.url().includes('settings'));
    await settingsWindow.waitForLoadState('domcontentloaded');

    await settingsWindow.fill('#fromInput', 'gbp');
    await settingsWindow.fill('#toInput', 'usd');
    await settingsWindow.click('button[type="submit"]');

    await settingsWindow.waitForFunction(() =>
      Array.from(document.querySelectorAll('#pairsList li')).some((li) => li.textContent.includes('GBP'))
    );

    const configPath = path.join(userDataDir, 'config.json');
    const config = await waitForConfig(configPath, (c) => c.pairs.some((p) => p.id === 'gbp-usd'));
    assert.ok(config.pairs.some((p) => p.id === 'gbp-usd'), 'new pair should be persisted to config.json');
  } finally {
    await cleanup();
  }
});

test('settings: changing the refresh interval persists', async () => {
  const { app, userDataDir, cleanup } = await launchApp();
  try {
    const widgetWindow = await app.firstWindow();
    await widgetWindow.waitForSelector('.pair-row', { timeout: 20000 });

    await widgetWindow.evaluate(() => window.api.openSettings());
    const settingsWindow = await app.waitForEvent('window', (win) => win.url().includes('settings'));
    await settingsWindow.waitForLoadState('domcontentloaded');

    await settingsWindow.fill('#intervalInput', '15');
    await settingsWindow.click('.interval-form button[type="submit"]');

    const configPath = path.join(userDataDir, 'config.json');
    const config = await waitForConfig(configPath, (c) => c.refreshIntervalMinutes === 15);
    assert.equal(config.refreshIntervalMinutes, 15);
  } finally {
    await cleanup();
  }
});
