const pairsList = document.getElementById('pairsList');
const addPairForm = document.getElementById('addPairForm');
const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');
const pairError = document.getElementById('pairError');

const intervalForm = document.getElementById('intervalForm');
const intervalInput = document.getElementById('intervalInput');
const intervalError = document.getElementById('intervalError');

function renderPairs(pairs) {
  pairsList.innerHTML = '';
  for (const pair of pairs) {
    const li = document.createElement('li');

    const label = document.createElement('span');
    label.textContent = `${pair.from} → ${pair.to}`;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Удалить';
    removeBtn.addEventListener('click', async () => {
      const result = await window.api.removePair(pair.id);
      renderPairs(result.pairs);
    });

    li.appendChild(label);
    li.appendChild(removeBtn);
    pairsList.appendChild(li);
  }
}

addPairForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  pairError.textContent = '';
  const from = fromInput.value.trim().toUpperCase();
  const to = toInput.value.trim().toUpperCase();
  if (!from || !to) return;

  const result = await window.api.addPair(from, to);
  if (result.error) {
    pairError.textContent = result.error;
    return;
  }
  fromInput.value = '';
  toInput.value = '';
  renderPairs(result.pairs);
});

intervalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  intervalError.textContent = '';
  const minutes = Number(intervalInput.value);
  const result = await window.api.setInterval(minutes);
  if (result.error) {
    intervalError.textContent = result.error;
  }
});

async function init() {
  const [pairs, interval] = await Promise.all([window.api.getPairs(), window.api.getInterval()]);
  renderPairs(pairs);
  intervalInput.value = interval;
}

init();
