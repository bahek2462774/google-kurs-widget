// One-off dev utility: launches the real app against a local fixture
// server (so it shows real rendered rate values without hitting Google),
// and saves DOM screenshots of the widget + settings windows for use on
// the docs/ landing page. Run with: node scripts/capture-doc-screenshots.mjs
//
// Not part of the automated test suite -- run manually whenever the UI
// changes enough to warrant refreshed screenshots.

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { _electron as electron } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const docsAssetsDir = path.join(projectRoot, 'docs', 'assets');
mkdirSync(docsAssetsDir, { recursive: true });

const fixtureHtml = readFileSync(
  path.join(projectRoot, 'test/fixtures/google-serp-usd-rub-ru-locale.html'),
  'utf8'
);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fixtureHtml);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const userDataDir = mkdtempSync(path.join(tmpdir(), 'gkw-screenshots-'));

const app = await electron.launch({
  args: [projectRoot],
  env: {
    ...process.env,
    GOOGLE_BASE_URL: `http://127.0.0.1:${port}`,
    GKW_USER_DATA_DIR: userDataDir
  }
});

try {
  const widgetWindow = await app.firstWindow();
  await widgetWindow.waitForFunction(
    () => document.getElementById('footer')?.textContent?.startsWith('Обновлено:'),
    null,
    { timeout: 20000 }
  );
  await widgetWindow.screenshot({ path: path.join(docsAssetsDir, 'widget.png') });
  console.log('Saved docs/assets/widget.png');

  await widgetWindow.evaluate(() => window.api.openSettings());
  const settingsWindow = await app.waitForEvent('window', (win) => win.url().includes('settings'));
  await settingsWindow.waitForLoadState('domcontentloaded');
  await settingsWindow.screenshot({ path: path.join(docsAssetsDir, 'settings.png') });
  console.log('Saved docs/assets/settings.png');
} finally {
  await app.close();
  rmSync(userDataDir, { recursive: true, force: true });
  server.close();
}
