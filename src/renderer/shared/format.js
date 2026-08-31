export function formatLastUpdated(date) {
  if (!date) return 'Ещё не обновлялось';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return 'Ещё не обновлялось';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `Обновлено: ${hh}:${mm}`;
}

export function formatRate(rate) {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return '—';
  return rate.toFixed(2).replace('.', ',');
}

export function latestSuccessfulUpdate(pairs) {
  // `lastUpdatedAt` is only ever written on a successful fetch (see
  // store.js#updatePairResult, which leaves it untouched on failure) --
  // so its presence alone already means "this pair updated successfully
  // at some point". Filtering on the pair's *current* lastStatus as well
  // would wrongly hide that history the moment a later refresh fails,
  // making the footer regress to "never updated" even though it has.
  const dates = pairs
    .filter((p) => p.lastUpdatedAt)
    .map((p) => new Date(p.lastUpdatedAt).getTime())
    .filter((t) => !Number.isNaN(t));
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates));
}
