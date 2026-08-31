import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createScheduler } from '../../src/main/scheduler.js';

function makeFakeStore(initialPairs, config = {}) {
  let pairs = initialPairs.map((p) => ({ lastRate: null, lastUpdatedAt: null, lastStatus: 'pending', ...p }));
  const cfg = { refreshIntervalMinutes: 30, locale: 'ru', ...config };
  return {
    getPairs: () => pairs.map((p) => ({ ...p })),
    getConfig: () => ({ ...cfg }),
    async updatePairResult(id, result) {
      const pair = pairs.find((p) => p.id === id);
      if (!pair) return;
      if (result) {
        pair.lastRate = result.rate;
        pair.lastUpdatedAt = result.fetchedAt.toISOString();
        pair.lastStatus = 'ok';
      } else {
        pair.lastStatus = 'error';
      }
    }
  };
}

test('refreshOnce skips a second call within minGapMs unless forced', async () => {
  const store = makeFakeStore([{ id: 'a', from: 'USD', to: 'RUB' }]);
  let calls = 0;
  const fetchRate = async () => {
    calls++;
    return { rate: 1, fetchedAt: new Date() };
  };
  const scheduler = createScheduler({ store, fetchRate, minGapMs: 10_000, delayBetweenPairsMs: 0 });

  const first = await scheduler.refreshOnce();
  assert.equal(first.skipped, false);

  const second = await scheduler.refreshOnce();
  assert.equal(second.skipped, true);
  assert.equal(second.reason, 'too-soon');
  assert.equal(calls, 1, 'the too-soon call must not have triggered another fetch');
});

test('refreshOnce with force:true bypasses the minGap guard', async () => {
  const store = makeFakeStore([{ id: 'a', from: 'USD', to: 'RUB' }]);
  let calls = 0;
  const fetchRate = async () => {
    calls++;
    return { rate: 1, fetchedAt: new Date() };
  };
  const scheduler = createScheduler({ store, fetchRate, minGapMs: 10_000, delayBetweenPairsMs: 0 });

  await scheduler.refreshOnce();
  const forced = await scheduler.refreshOnce({ force: true });
  assert.equal(forced.skipped, false);
  assert.equal(calls, 2);
});

test('refreshOnce refuses to run concurrently with itself (mutex)', async () => {
  const store = makeFakeStore([{ id: 'a', from: 'USD', to: 'RUB' }]);
  let resolveFetch;
  const gate = new Promise((resolve) => {
    resolveFetch = resolve;
  });
  let calls = 0;
  const fetchRate = async () => {
    calls++;
    await gate;
    return { rate: 1, fetchedAt: new Date() };
  };
  const scheduler = createScheduler({ store, fetchRate, minGapMs: 0, delayBetweenPairsMs: 0 });

  const inFlight = scheduler.refreshOnce({ force: true });
  // The mutex flag is set synchronously before the first await inside
  // refreshOnce, so this second call -- issued while the first is still
  // pending on the fetch gate -- must observe it and skip immediately.
  const rejected = await scheduler.refreshOnce({ force: true });
  assert.equal(rejected.skipped, true);
  assert.equal(rejected.reason, 'already-refreshing');

  resolveFetch();
  await inFlight;
  assert.equal(calls, 1, 'only the first call should have actually fetched');
});

test('refreshOnce updates every pair and calls onRatesUpdated exactly once with the final state', async () => {
  const store = makeFakeStore([
    { id: 'usd-rub', from: 'USD', to: 'RUB' },
    { id: 'eur-rub', from: 'EUR', to: 'RUB' }
  ]);
  const fetchRate = async (from) => ({ rate: from === 'USD' ? 85.91 : 92.5, fetchedAt: new Date() });
  let onRatesUpdatedCalls = 0;
  let lastPayload = null;
  const scheduler = createScheduler({
    store,
    fetchRate,
    delayBetweenPairsMs: 0,
    onRatesUpdated: (pairs) => {
      onRatesUpdatedCalls++;
      lastPayload = pairs;
    }
  });

  await scheduler.refreshOnce({ force: true });

  assert.equal(onRatesUpdatedCalls, 1);
  assert.equal(lastPayload.length, 2);
  assert.ok(lastPayload.every((p) => p.lastStatus === 'ok'));
});

test('a pair that fails to fetch gets status "error" without blocking the other pairs', async () => {
  const store = makeFakeStore([
    { id: 'usd-rub', from: 'USD', to: 'RUB' },
    { id: 'eur-rub', from: 'EUR', to: 'RUB' }
  ]);
  const fetchRate = async (from) => (from === 'USD' ? null : { rate: 92.5, fetchedAt: new Date() });
  const scheduler = createScheduler({ store, fetchRate, delayBetweenPairsMs: 0 });

  const result = await scheduler.refreshOnce({ force: true });
  assert.equal(result.skipped, false);

  const pairs = store.getPairs();
  assert.equal(pairs.find((p) => p.id === 'usd-rub').lastStatus, 'error');
  assert.equal(pairs.find((p) => p.id === 'eur-rub').lastStatus, 'ok');
});
