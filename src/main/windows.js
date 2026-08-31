import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function clampBoundsToVisibleArea(bounds) {
  const displays = screen.getAllDisplays();
  const fits = displays.some((d) => {
    const area = d.workArea;
    return (
      bounds.x >= area.x &&
      bounds.y >= area.y &&
      bounds.x + bounds.width <= area.x + area.width &&
      bounds.y + bounds.height <= area.y + area.height
    );
  });
  if (fits) return bounds;

  const primary = screen.getPrimaryDisplay().workArea;
  return {
    x: primary.x + primary.width - bounds.width - 20,
    y: primary.y + 20,
    width: bounds.width,
    height: bounds.height
  };
}

function validDimension(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function createWidgetWindow({ preloadPath, savedWindow, onMoveResize, onReady }) {
  // Guards against a hand-edited or corrupted config.json (e.g. a negative
  // or NaN width/height, which `|| fallback` alone would not catch since
  // negative numbers are truthy in JS) reaching BrowserWindow's constructor.
  const width = validDimension(savedWindow?.width, 260);
  const height = validDimension(savedWindow?.height, 160);

  let bounds;
  if (savedWindow?.x == null || savedWindow?.y == null) {
    const primary = screen.getPrimaryDisplay().workArea;
    bounds = { x: primary.x + primary.width - width - 20, y: primary.y + 20, width, height };
  } else {
    bounds = clampBoundsToVisibleArea({ x: savedWindow.x, y: savedWindow.y, width, height });
  }

  const win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/widget/index.html'));

  if (onReady) {
    win.webContents.once('did-finish-load', onReady);
  }

  if (onMoveResize) {
    // Debounced: a drag fires 'moved' at native OS event frequency, and
    // each call ends up triggering a config.json write -- no need to
    // persist every intermediate position, only where the window settles.
    let debounceTimer = null;
    const emit = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onMoveResize(win.getBounds()), 400);
    };
    win.on('moved', emit);
    win.on('resized', emit);
  }

  return win;
}

export function createSettingsWindow({ preloadPath, parent }) {
  const win = new BrowserWindow({
    width: 440,
    height: 520,
    resizable: false,
    title: 'Настройки — Google Kurs Widget',
    parent,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/settings/index.html'));
  return win;
}
