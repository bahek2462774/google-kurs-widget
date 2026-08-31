import { ipcMain } from 'electron';

export function registerIpcHandlers({ store, scheduler, openSettingsWindow }) {
  ipcMain.handle('pairs:get', () => store.getPairs());

  ipcMain.handle('pairs:add', async (_event, { from, to } = {}) => {
    if (!from || !to) {
      return { error: 'Укажите обе валюты' };
    }
    const result = await store.addPair(String(from).trim(), String(to).trim());
    if (!result.error) {
      scheduler.refreshOnce({ force: true }).catch((err) => console.warn('[ipc] refresh after add failed:', err));
    }
    return result;
  });

  ipcMain.handle('pairs:remove', async (_event, { id } = {}) => {
    return store.removePair(id);
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
