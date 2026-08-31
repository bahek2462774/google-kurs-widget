import { ipcMain } from 'electron';
import { fetchPairsCatalog } from '../scraper/rateApiClient.js';

export function registerIpcHandlers({ store, scheduler, openSettingsWindow, broadcastPairs }) {
  ipcMain.handle('pairs:get', () => store.getPairs());

  ipcMain.handle('pairs:catalog', () => fetchPairsCatalog());

  ipcMain.handle('pairs:add', async (_event, { from, to } = {}) => {
    if (!from || !to) {
      return { error: 'Укажите обе валюты' };
    }
    const result = await store.addPair(String(from).trim(), String(to).trim());
    if (!result.error) {
      // Reflect the new (still-pending) row in the widget immediately,
      // rather than leaving it invisible until the fetch below resolves.
      broadcastPairs?.();
      scheduler.refreshOnce({ force: true }).catch((err) => console.warn('[ipc] refresh after add failed:', err));
    }
    return result;
  });

  ipcMain.handle('pairs:remove', async (_event, { id } = {}) => {
    const result = await store.removePair(id);
    broadcastPairs?.();
    return result;
  });

  ipcMain.handle('pairs:reorder', async (_event, { ids } = {}) => {
    if (!Array.isArray(ids)) {
      return { error: 'Некорректный порядок' };
    }
    const result = await store.reorderPairs(ids);
    broadcastPairs?.();
    return result;
  });

  ipcMain.handle('interval:get', () => store.getConfig().refreshIntervalMinutes);

  ipcMain.handle('interval:set', async (_event, { minutes } = {}) => {
    const result = await store.setRefreshIntervalMinutes(minutes);
    if (!result.error) {
      scheduler.restart();
    }
    return result;
  });

  ipcMain.handle('settings:open', () => {
    openSettingsWindow();
  });

  ipcMain.handle('refresh:request', async () => {
    return scheduler.refreshOnce({ force: false });
  });
}
