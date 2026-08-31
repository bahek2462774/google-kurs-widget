function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Orchestrates periodic + manual refresh cycles. Framework-agnostic:
 * `store` and `fetchRate` are injected, so this is unit-testable without
 * booting Electron or hitting the network.
 */
export function createScheduler({
  store,
  fetchRate,
  onRatesUpdated,
  minGapMs = 60_000,
  delayBetweenPairsMs = 1500
}) {
  let timer = null;
  let lastRefreshAt = 0;
  let refreshing = false;

  async function refreshOnce({ force = false } = {}) {
    if (refreshing) return { skipped: true, reason: 'already-refreshing' };
    const now = Date.now();
    if (!force && now - lastRefreshAt < minGapMs) {
      return { skipped: true, reason: 'too-soon' };
    }

    refreshing = true;
    lastRefreshAt = now;
    try {
      const pairs = store.getPairs();
      const locale = store.getConfig().locale;
      for (const pair of pairs) {
        const result = await fetchRate(pair.from, pair.to, { locale });
        await store.updatePairResult(pair.id, result);
        if (delayBetweenPairsMs > 0) await sleep(delayBetweenPairsMs);
      }
      onRatesUpdated?.(store.getPairs());
      return { skipped: false };
    } finally {
      refreshing = false;
    }
  }

  function scheduleTimer() {
    if (timer) clearInterval(timer);
    const minutes = store.getConfig().refreshIntervalMinutes;
    timer = setInterval(() => {
      refreshOnce().catch((err) => console.warn('[scheduler] refresh failed:', err));
    }, minutes * 60 * 1000);
  }

  function start() {
    scheduleTimer();
    refreshOnce({ force: true }).catch((err) => console.warn('[scheduler] initial refresh failed:', err));
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function restart() {
    scheduleTimer();
  }

  return { start, stop, restart, refreshOnce };
}
