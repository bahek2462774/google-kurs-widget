import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStore } from './store.js';
import { createScheduler } from './scheduler.js';
import { createWidgetWindow, createSettingsWindow } from './windows.js';
import { registerIpcHandlers } from './ipc.js';
import { fetchRate } from '../scraper/googleRateScraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(__dirname, '../preload/preload.cjs');

let widgetWindow = null;
let settingsWindow = null;
let tray = null;

// Test-only override so e2e tests never touch the developer's real saved config.
if (process.env.GKW_USER_DATA_DIR) {
  app.setPath('userData', process.env.GKW_USER_DATA_DIR);
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = createSettingsWindow({ preloadPath, parent: widgetWindow });
}

function setupTray(scheduler) {
  const icon = nativeImage.createFromNamedImage('NSStatusAvailable', [-1, 0, 1]);
  tray = new Tray(icon);
  const menuTemplate = [
    {
      label: 'Обновить сейчас',
      click: () =>
        scheduler
          .refreshOnce({ force: true })
          .catch((err) => console.warn('[main] manual refresh from tray failed:', err))
    },
    { label: 'Настройки…', click: openSettingsWindow },
    { type: 'separator' }
  ];
  if (!app.isPackaged) {
    menuTemplate.push({
      label: 'Открыть DevTools (dev)',
      click: () => widgetWindow?.webContents.openDevTools({ mode: 'detach' })
    });
  }
  menuTemplate.push({ type: 'separator' }, { label: 'Выход', click: () => app.quit() });
  tray.setToolTip('Google Kurs Widget');
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
}

async function main() {
  await app.whenReady();
  app.dock?.hide();

  const configPath = path.join(app.getPath('userData'), 'config.json');
  const store = createStore(configPath);
  await store.load();

  // Captured once, before the scheduler ever starts mutating store.pairs in
  // place. `did-finish-load` fires on a real wall-clock timer unrelated to
  // the scheduler's own progress, so reading store.getPairs() *live* inside
  // that callback could race and observe a mid-refresh-cycle state (some
  // pairs updated, others not yet) -- sending this fixed pre-refresh
  // snapshot instead sidesteps that race entirely. (getPairs() already
  // returns a deep clone, so no extra cloning is needed here.)
  const preRefreshSnapshot = store.getPairs();

  widgetWindow = createWidgetWindow({
    preloadPath,
    savedWindow: store.getConfig().window,
    onMoveResize: (bounds) => store.setWindowBounds(bounds),
    onReady: () => widgetWindow.webContents.send('rates:updated', preRefreshSnapshot)
  });

  const scheduler = createScheduler({
    store,
    fetchRate,
    onRatesUpdated: (pairs) => {
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send('rates:updated', pairs);
      }
    }
  });

  registerIpcHandlers({ store, scheduler, openSettingsWindow });

  setupTray(scheduler);
  scheduler.start();

  app.on('window-all-closed', (event) => {
    // Widget lives via the tray; don't quit when its window closes.
    event.preventDefault();
  });

  app.on('before-quit', () => scheduler.stop());
}

main().catch((err) => {
  console.error('[main] fatal startup error:', err);
  app.quit();
});
