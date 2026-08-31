import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatLastUpdated, formatRate, latestSuccessfulUpdate } from '../../src/renderer/shared/format.js';

test('formatLastUpdated: no date -> shows a loading state, not a dead-end message', () => {
  assert.equal(formatLastUpdated(null), 'Загрузка…');
  assert.equal(formatLastUpdated(undefined), 'Загрузка…');
  assert.equal(formatLastUpdated('not-a-date'), 'Загрузка…');
});

test('formatLastUpdated: formats HH:MM, zero-padded', () => {
  const d = new Date('2026-08-31T07:05:00');
  assert.equal(formatLastUpdated(d), 'Обновлено: 07:05');
});

test('formatRate: formats with a comma decimal separator', () => {
  assert.equal(formatRate(85.9106529), '85,91');
  assert.equal(formatRate(null), '—');
  assert.equal(formatRate(NaN), '—');
});

test('latestSuccessfulUpdate: returns null when nothing has ever succeeded', () => {
  const pairs = [
    { lastStatus: 'pending', lastUpdatedAt: null },
    { lastStatus: 'pending', lastUpdatedAt: null }
  ];
  assert.equal(latestSuccessfulUpdate(pairs), null);
});

test('latestSuccessfulUpdate: picks the max timestamp among successful pairs', () => {
  const pairs = [
    { lastStatus: 'ok', lastUpdatedAt: '2026-08-31T10:00:00.000Z' },
    { lastStatus: 'ok', lastUpdatedAt: '2026-08-31T10:30:00.000Z' }
  ];
  assert.equal(latestSuccessfulUpdate(pairs).toISOString(), '2026-08-31T10:30:00.000Z');
});

test('latestSuccessfulUpdate: a pair currently in error state still counts its prior success', () => {
  // Regression test for a real bug found in review: filtering on the pair's
  // *current* lastStatus made the footer wrongly regress to "never updated"
  // as soon as any pair's next refresh failed, even though lastUpdatedAt
  // (only ever written on success) proves it updated successfully before.
  const pairs = [
    { lastStatus: 'error', lastUpdatedAt: '2026-08-31T10:00:00.000Z' },
    { lastStatus: 'pending', lastUpdatedAt: null }
  ];
  const result = latestSuccessfulUpdate(pairs);
  assert.ok(result, 'a prior successful update must still be reported even if the pair is now in error state');
  assert.equal(result.toISOString(), '2026-08-31T10:00:00.000Z');
});
