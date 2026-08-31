const pairsList = document.getElementById('pairsList');
const addPairForm = document.getElementById('addPairForm');
const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');
const pairError = document.getElementById('pairError');
const catalogSelect = document.getElementById('catalogSelect');

const intervalForm = document.getElementById('intervalForm');
const intervalInput = document.getElementById('intervalInput');
const intervalError = document.getElementById('intervalError');

let currentPairs = [];
let catalog = [];
let draggedId = null;

function pairIdFromCode(pairCode) {
  return `${pairCode.slice(0, 3).toLowerCase()}-${pairCode.slice(3, 6).toLowerCase()}`;
}

function renderCatalogSelect() {
  const trackedIds = new Set(currentPairs.map((p) => p.id));
  const available = catalog.filter((c) => !trackedIds.has(pairIdFromCode(c.pair)));

  catalogSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent =
    available.length > 0 ? '— выбрать из списка (например USD - RUB) —' : '— все пары из списка уже добавлены —';
  catalogSelect.appendChild(placeholder);

  for (const { pair } of available) {
    const option = document.createElement('option');
    option.value = pair;
    option.textContent = `${pair.slice(0, 3)} - ${pair.slice(3, 6)}`;
    catalogSelect.appendChild(option);
  }
}

catalogSelect.addEventListener('change', () => {
  const pair = catalogSelect.value;
  if (!pair) return;
  fromInput.value = pair.slice(0, 3);
  toInput.value = pair.slice(3, 6);
  catalogSelect.value = '';
});

function handleDragStart(event, id) {
  draggedId = id;
  event.dataTransfer.effectAllowed = 'move';
  event.currentTarget.classList.add('dragging');
}

function handleDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
  draggedId = null;
}

function handleDragOver(event) {
  event.preventDefault();
  const li = event.currentTarget;
  if (li.dataset.id === draggedId) return;
  const rect = li.getBoundingClientRect();
  const before = event.clientY - rect.top < rect.height / 2;
  const draggedEl = pairsList.querySelector(`[data-id="${draggedId}"]`);
  if (!draggedEl) return;
  li.parentNode.insertBefore(draggedEl, before ? li : li.nextSibling);
}

async function handleDrop(event) {
  event.preventDefault();
  const ids = Array.from(pairsList.children).map((li) => li.dataset.id);
  const result = await window.api.reorderPairs(ids);
  if (result?.pairs) {
    currentPairs = result.pairs;
    renderPairs(currentPairs);
  }
}

function renderPairs(pairs) {
  currentPairs = pairs;
  pairsList.innerHTML = '';
  for (const pair of pairs) {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.id = pair.id;
    li.addEventListener('dragstart', (e) => handleDragStart(e, pair.id));
    li.addEventListener('dragend', handleDragEnd);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('drop', handleDrop);

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'pair-label';
    label.textContent = `${pair.from} → ${pair.to}`;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Удалить';
    removeBtn.addEventListener('click', async () => {
      const result = await window.api.removePair(pair.id);
      renderPairs(result.pairs);
      renderCatalogSelect();
    });

    li.appendChild(handle);
    li.appendChild(label);
    li.appendChild(removeBtn);
    pairsList.appendChild(li);
  }
  renderCatalogSelect();
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
  const [pairs, interval, pairsCatalog] = await Promise.all([
    window.api.getPairs(),
    window.api.getInterval(),
    window.api.getCatalog()
  ]);
  catalog = pairsCatalog;
  renderPairs(pairs);
  intervalInput.value = interval;
}

init();
