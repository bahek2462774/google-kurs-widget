import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createStore } from '../../src/main/store.js';

function makeTempConfigPath() {
  const dir = mkdtempSync(path.join(tmpdir(), 'gkw-store-test-'));
  return { dir, configPath: path.join(dir, 'config.json') };
}

test('loads defaults when no config file exists yet, and writes it', async () => {
  const { dir, configPath } = makeTempConfigPath();
  try {
    const store = createStore(configPath);
    const config = await store.load();

    assert.equal(config.refreshIntervalMinutes, 30);
    assert.equal(config.pairs.length, 2);
    assert.ok(existsSync(configPath), 'expected the default config to be written to disk');

    const onDisk = JSON.parse(readFileSync(configPath, 'utf8'));
    assert.equal(onDisk.refreshIntervalMinutes, 30);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('add/remove pair persists and round-trips through a fresh load', async () => {
  const { dir, configPath } = makeTempConfigPath();
  try {
    const store = createStore(configPath);
    await store.load();

    const added = await store.addPair('gbp', 'usd');
    assert.equal(added.error, undefined);
    assert.ok(added.pairs.some((p) => p.id === 'gbp-usd'));

    const duplicate = await store.addPair('GBP', 'USD');
    assert.ok(duplicate.error, 'adding the same pair twice should error');

    const reloaded = createStore(configPath);
    const reloadedConfig = await reloaded.load();
    assert.ok(reloadedConfig.pairs.some((p) => p.id === 'gbp-usd'), 'pair should survive reload');

    const removed = await store.removePair('gbp-usd');
    assert.ok(!removed.pairs.some((p) => p.id === 'gbp-usd'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('updatePairResult sets rate/timestamp on success and only status on failure', async () => {
  const { dir, configPath } = makeTempConfigPath();
  try {
    const store = createStore(configPath);
    await store.load();

    const fetchedAt = new Date('2026-08-31T10:32:00.000Z');
    await store.updatePairResult('usd-rub', { rate: 85.91, fetchedAt });
    const [ok] = store.getPairs().filter((p) => p.id === 'usd-rub');
    assert.equal(ok.lastRate, 85.91);
    assert.equal(ok.lastStatus, 'ok');
    assert.equal(ok.lastUpdatedAt, fetchedAt.toISOString());

    await store.updatePairResult('usd-rub', null);
    const [afterFailure] = store.getPairs().filter((p) => p.id === 'usd-rub');
    assert.equal(afterFailure.lastStatus, 'error');
    assert.equal(afterFailure.lastRate, 85.91, 'failed refresh must keep the last known rate');
    assert.equal(afterFailure.lastUpdatedAt, fetchedAt.toISOString(), 'failed refresh must not touch the timestamp');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('setRefreshIntervalMinutes validates input', async () => {
  const { dir, configPath } = makeTempConfigPath();
  try {
    const store = createStore(configPath);
    await store.load();

    const bad = await store.setRefreshIntervalMinutes(0);
    assert.ok(bad.error);

    const good = await store.setRefreshIntervalMinutes(15);
    assert.equal(good.refreshIntervalMinutes, 15);
    assert.equal(store.getConfig().refreshIntervalMinutes, 15);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('concurrent save() calls are serialized -- the last write always wins on disk', async () => {
  // Regression test for a real race found in review: overlapping save()
  // calls (e.g. a window-drag bounds update landing while a refresh-cycle
  // write is also in flight) previously raced on their temp-file rename,
  // so whichever finished last could revert config.json to a stale
  // snapshot regardless of which call captured the newer state. Firing
  // many concurrent mutate+save pairs and asserting the final on-disk
  // state matches the *last* one queued (not merely "some" one) proves
  // they're serialized in call order rather than racing.
  const { dir, configPath } = makeTempConfigPath();
  try {
    const store = createStore(configPath);
    await store.load();

    const writes = [];
    for (let i = 1; i <= 15; i++) {
      writes.push(store.setRefreshIntervalMinutes(i));
    }
    await Promise.all(writes);

    const onDisk = JSON.parse(readFileSync(configPath, 'utf8'));
    assert.equal(onDisk.refreshIntervalMinutes, 15, 'final on-disk state must match the last queued write');
    assert.equal(store.getConfig().refreshIntervalMinutes, 15);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('falls back to defaults on a corrupt config file', async () => {
  const { dir, configPath } = makeTempConfigPath();
  try {
    const fs = await import('node:fs');
    fs.writeFileSync(configPath, '{ not valid json');

    const store = createStore(configPath);
    const config = await store.load();
    assert.equal(config.refreshIntervalMinutes, 30);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
