import { formatLastUpdated, formatRate, latestSuccessfulUpdate } from '../shared/format.js';

const pairsList = document.getElementById('pairsList');
const footer = document.getElementById('footer');
const gearBtn = document.getElementById('gearBtn');

function render(pairs) {
  pairsList.innerHTML = '';

  if (!pairs || pairs.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-hint';
    li.textContent = 'Добавьте пару в настройках';
    pairsList.appendChild(li);
  } else {
    for (const pair of pairs) {
      const li = document.createElement('li');
      li.className = `pair-row status-${pair.lastStatus || 'pending'}`;

      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = `${pair.from} → ${pair.to}`;

      const value = document.createElement('span');
      value.className = 'value';
      value.textContent = pair.lastRate != null ? formatRate(pair.lastRate) : pair.lastStatus === 'error' ? 'ошибка' : '…';

      li.appendChild(label);
      li.appendChild(value);
      pairsList.appendChild(li);
    }
  }

  footer.textContent = formatLastUpdated(latestSuccessfulUpdate(pairs || []));
}

gearBtn.addEventListener('click', () => {
  window.api.openSettings();
});

// Rely solely on the main process pushing state (once when this window's
// script finishes loading, and again after every refresh cycle) rather than
// separately pulling via getPairs() -- a pull could land mid-refresh-cycle
// (after some pairs are updated but not all) and paint a misleadingly
// "partially updated" snapshot with a stale footer timestamp.
window.api.onRatesUpdated(render);
