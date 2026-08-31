import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_CONFIG = {
  pairs: [
    { id: 'usd-rub', from: 'USD', to: 'RUB', lastRate: null, lastUpdatedAt: null, lastStatus: 'pending' },
    { id: 'eur-rub', from: 'EUR', to: 'RUB', lastRate: null, lastUpdatedAt: null, lastStatus: 'pending' }
  ],
  refreshIntervalMinutes: 30,
  window: { x: null, y: null, width: 260, height: 160 },
  locale: 'ru'
};

function pairId(from, to) {
  return `${from.toLowerCase()}-${to.toLowerCase()}`;
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

export function createStore(configPath) {
  let config = cloneDefaults();

  // Serializes all writes: two `save()` calls close together (e.g. a window
  // drag firing several bounds updates while a scheduled refresh is also
  // writing) must never race each other's temp-file-write-then-rename, or
  // whichever rename lands second silently reverts config.json to a stale
  // snapshot regardless of which call captured newer in-memory state.
  // Chaining onto this promise guarantees writes happen one at a time, in
  // call order, so the very last write always reflects the most current
  // config -- no locking library needed for a single-process app.
  let writeChain = Promise.resolve();

  async function load() {
    try {
      const raw = await fs.readFile(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      config = {
        ...cloneDefaults(),
        ...parsed,
        pairs: Array.isArray(parsed.pairs) ? parsed.pairs : cloneDefaults().pairs,
        window: { ...cloneDefaults().window, ...(parsed.window || {}) }
      };
    } catch {
      config = cloneDefaults();
      await save();
    }
    return config;
  }

  async function writeToDisk() {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${configPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf8');
    await fs.rename(tmpPath, configPath);
  }

  function save() {
    const result = writeChain.then(writeToDisk, writeToDisk);
    // Keep the queue alive even if this write failed, so one bad write
    // doesn't permanently wedge every subsequent save() -- the failure
    // itself still propagates to whoever awaited `result`.
    writeChain = result.catch(() => {});
    return result;
  }

  function getConfig() {
    return config;
  }

  function getPairs() {
    // Return a snapshot, not the live mutable array -- callers must never
    // observe (or accidentally hold a reference into) an in-progress mutation.
    return JSON.parse(JSON.stringify(config.pairs));
  }

  async function addPair(from, to) {
    const id = pairId(from, to);
    if (config.pairs.some((p) => p.id === id)) {
      return { error: 'Пара уже добавлена', pairs: getPairs() };
    }
    config.pairs.push({
      id,
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      lastRate: null,
      lastUpdatedAt: null,
      lastStatus: 'pending'
    });
    await save();
    return { pairs: getPairs() };
  }

  async function removePair(id) {
    config.pairs = config.pairs.filter((p) => p.id !== id);
    await save();
    return { pairs: getPairs() };
  }

  async function reorderPairs(orderedIds) {
    const byId = new Map(config.pairs.map((p) => [p.id, p]));
    // Only accept a permutation of the pairs we actually have -- ignore
    // unknown ids (stale IPC payload from a settings window that hasn't
    // re-synced yet), and silently keep any pair missing from the given
    // order at the end rather than dropping it.
    const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(reordered.map((p) => p.id));
    const remaining = config.pairs.filter((p) => !seen.has(p.id));
    config.pairs = [...reordered, ...remaining];
    await save();
    return { pairs: getPairs() };
  }

  async function updatePairResult(id, result) {
    const pair = config.pairs.find((p) => p.id === id);
    if (!pair) return;
    if (result) {
      pair.lastRate = result.rate;
      pair.lastUpdatedAt = result.fetchedAt.toISOString();
      pair.lastStatus = 'ok';
    } else {
      pair.lastStatus = 'error';
    }
    await save();
  }

  async function setRefreshIntervalMinutes(minutes) {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value < 1) {
      return { error: 'Интервал должен быть числом не меньше 1 минуты' };
    }
    config.refreshIntervalMinutes = Math.round(value);
    await save();
    return { refreshIntervalMinutes: config.refreshIntervalMinutes };
  }

  async function setWindowBounds(bounds) {
    config.window = { ...config.window, ...bounds };
    await save();
  }

  return {
    load,
    save,
    getConfig,
    getPairs,
    addPair,
    removePair,
    reorderPairs,
    updatePairResult,
    setRefreshIntervalMinutes,
    setWindowBounds
  };
}
