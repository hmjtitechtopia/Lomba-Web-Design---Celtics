// Editor matriks biner dan penyimpanan debounce; lifecycle dipanggil SL.pages.
(function (SL) {
  'use strict';

  const SIZE = 12;
  const HISTORY_MAX = 50;
  const SAVE_DELAY = 300;
  const WEAVE_STEP = 120;

  /** Preset bernama geometris netral, bukan nama motif tradisional (BRD D-04). */
  const PRESETS = {
    'belah-ketupat': function (r, c, n) {
      const d = Math.abs(r - (n - 1) / 2) + Math.abs(c - (n - 1) / 2);
      return Math.floor(d) % 4 === 0 ? 1 : 0;
    },
    zigzag: function (r, c) {
      const wave = r % 4 < 2 ? r % 4 : 4 - (r % 4);
      return (c + wave) % 4 === 0 ? 1 : 0;
    },
    'papan-catur': function (r, c) {
      return (Math.floor(r / 2) + Math.floor(c / 2)) % 2;
    },
    silang: function (r, c, n) {
      return r === c || r + c === n - 1 ? 1 : 0;
    }
  };

  let root = null;
  let grid = null;
  let cells = [];            // cells[r][c] → <button>
  let rows = [];             // rows[r] → { bits, count, hex, li }
  let matrix = [];
  let past = [];
  let future = [];
  let focus = { r: 0, c: 0 };
  let activeRow = -1;
  let paintValue = null;
  let saveTimer = 0;
  let weaveTimer = 0;
  let nameInput = null;
  const bin = SL.disposer();

  function blank(n) {
    const m = [];
    for (let r = 0; r < n; r++) m.push(new Array(n).fill(0));
    return m;
  }

  function clone(m) {
    return m.map(function (row) { return row.slice(); });
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function out(name) {
    return root.querySelector('[data-out="' + name + '"]');
  }

  function announce(text) {
    const status = document.getElementById('sr-status');
    if (status) status.textContent = text;
  }

  function paintCell(r, c) {
    const v = matrix[r][c];
    const cell = cells[r][c];
    cell.classList.toggle('cell--on', v === 1);
    cell.textContent = String(v);
    cell.setAttribute('aria-label', 'Baris ' + (r + 1) + ', kolom ' + (c + 1) + ', ' + v + ', ' + (v === 1 ? 'benang naik' : 'benang turun'));
  }

  function paintRow(r) {
    const bits = matrix[r].join('');
    const hexWidth = Math.ceil(SIZE / 4);
    rows[r].bits.textContent = bits;
    rows[r].count.textContent = String(matrix[r].reduce(function (a, b) { return a + b; }, 0));
    rows[r].hex.textContent = '0x' + parseInt(bits, 2).toString(16).toUpperCase().padStart(hexWidth, '0');
  }

  function paintSummary() {
    const total = SIZE * SIZE;
    const naik = matrix.reduce(function (sum, row) {
      return sum + row.reduce(function (a, b) { return a + b; }, 0);
    }, 0);
    out('naik').textContent = String(naik);
    out('turun').textContent = String(total - naik);
    out('kerapatan').textContent = (naik / total * 100).toFixed(1) + '%';
    root.classList.toggle('is-empty', naik === 0);
  }

  function paintAll() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) paintCell(r, c);
      paintRow(r);
    }
    paintSummary();
  }

  function setActiveRow(r) {
    if (r === activeRow) return;
    if (activeRow !== -1) rows[activeRow].li.classList.remove('is-active');
    activeRow = r;
    if (r !== -1) rows[r].li.classList.add('is-active');
  }

  function setCursor(r, c) {
    out('kursor').textContent = r === null ? '—' : 'X:' + pad2(c + 1) + ' Y:' + pad2(r + 1);
    root.querySelectorAll('.pg__ruler-num.is-active').forEach(function (el) { el.classList.remove('is-active'); });
    if (r === null) return;
    const col = root.querySelector('.pg__ruler-num[data-col="' + c + '"]');
    if (col) col.classList.add('is-active');
  }

  function setCell(r, c, v) {
    if (matrix[r][c] === v) return;
    matrix[r][c] = v;
    paintCell(r, c);
    paintRow(r);
    paintSummary();
    setActiveRow(r);
    scheduleSave();
  }

  function updateHistoryButtons() {
    root.querySelector('[data-action="undo"]').disabled = past.length === 0;
    root.querySelector('[data-action="redo"]').disabled = future.length === 0;
  }

  function remember() {
    past.push(clone(matrix));
    if (past.length > HISTORY_MAX) past.shift();
    future = [];
    updateHistoryButtons();
  }

  function replaceMatrix(next, message) {
    remember();
    matrix = next;
    paintAll();
    scheduleSave();
    if (message) announce(message);
  }

  function undo() {
    if (!past.length) return;
    future.push(clone(matrix));
    matrix = past.pop();
    paintAll();
    scheduleSave();
    updateHistoryButtons();
    announce('Langkah dibatalkan');
  }

  function redo() {
    if (!future.length) return;
    past.push(clone(matrix));
    matrix = future.pop();
    paintAll();
    scheduleSave();
    updateHistoryButtons();
    announce('Langkah diulang');
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    SL.storage.writeMotif(matrix, nameInput ? nameInput.value : '');
    const banner = root.querySelector('[data-banner="storage"]');
    if (banner) banner.hidden = SL.storage.available;
    // Piagam di section Dampak ikut diperbarui tanpa memuat ulang.
    document.dispatchEvent(new CustomEvent('sl:motif'));
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DELAY);
  }

  function flushSave() {
    if (saveTimer) save();
  }

  function fromPreset(name) {
    const fn = PRESETS[name];
    return matrix.map(function (row, r) {
      return row.map(function (v, c) { return fn(r, c, SIZE); });
    });
  }

  function stopWeave() {
    clearInterval(weaveTimer);
    weaveTimer = 0;
    root.querySelectorAll('.is-weaving').forEach(function (el) { el.classList.remove('is-weaving'); });
    const btn = root.querySelector('[data-action="tenun"]');
    if (btn) btn.disabled = false;
  }

  /** Tenun: sorot baris demi baris seperti pakan yang dilempar satu per satu. */
  function weave() {
    stopWeave();
    const btn = root.querySelector('[data-action="tenun"]');
    if (SL.prefersReducedMotion()) {
      announce('Seluruh ' + SIZE + ' baris ditenun');
      return;
    }
    btn.disabled = true;
    let r = 0;
    weaveTimer = setInterval(function () {
      root.querySelectorAll('.is-weaving').forEach(function (el) { el.classList.remove('is-weaving'); });
      if (r >= SIZE) {
        stopWeave();
        announce('Seluruh ' + SIZE + ' baris ditenun');
        return;
      }
      grid.children[r].classList.add('is-weaving');
      rows[r].li.classList.add('is-weaving');
      r += 1;
    }, WEAVE_STEP);
  }

  function onAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    if (action === 'simpan') {
      save();
      return;
    }
    if (action === 'tenun') weave();
    else if (action === 'undo') undo();
    else if (action === 'redo') redo();
    else if (action === 'bersihkan') replaceMatrix(blank(SIZE), 'Kanvas dibersihkan');
    else if (action === 'balik') {
      replaceMatrix(matrix.map(function (row) { return row.map(function (v) { return 1 - v; }); }), 'Motif dibalik');
    } else if (action === 'acak') {
      replaceMatrix(matrix.map(function (row) { return row.map(function () { return Math.random() < 0.5 ? 1 : 0; }); }), 'Motif diacak');
    } else if (action === 'cermin') {
      replaceMatrix(matrix.map(function (row) {
        return row.map(function (v, c) { return c < SIZE / 2 ? v : row[SIZE - 1 - c]; });
      }), 'Sisi kiri dicerminkan ke kanan');
    } else if (action === 'preset' && PRESETS[btn.dataset.preset]) {
      replaceMatrix(fromPreset(btn.dataset.preset), 'Preset ' + btn.textContent.trim().toLowerCase() + ' dipasang');
    }
  }

  function cellOf(target) {
    const cell = target && target.closest ? target.closest('.cell') : null;
    if (!cell || !grid.contains(cell)) return null;
    return { r: Number(cell.dataset.r), c: Number(cell.dataset.c), el: cell };
  }

  function moveFocus(r, c) {
    const nr = Math.min(Math.max(r, 0), SIZE - 1);
    const nc = Math.min(Math.max(c, 0), SIZE - 1);
    cells[focus.r][focus.c].tabIndex = -1;
    focus = { r: nr, c: nc };
    const el = cells[nr][nc];
    el.tabIndex = 0;
    el.focus();
  }

  function onPointerDown(e) {
    const hit = cellOf(e.target);
    if (!hit || e.button > 0) return;
    e.preventDefault();
    cells[focus.r][focus.c].tabIndex = -1;
    focus = { r: hit.r, c: hit.c };
    hit.el.tabIndex = 0;
    hit.el.focus({ preventScroll: true });
    remember();
    paintValue = 1 - matrix[hit.r][hit.c];
    setCell(hit.r, hit.c, paintValue);
    grid.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    const hit = cellOf(paintValue === null ? e.target : document.elementFromPoint(e.clientX, e.clientY));
    if (!hit) return;
    setCursor(hit.r, hit.c);
    if (paintValue !== null) setCell(hit.r, hit.c, paintValue);
  }

  function onPointerUp(e) {
    paintValue = null;
    if (grid.hasPointerCapture(e.pointerId)) grid.releasePointerCapture(e.pointerId);
  }

  function onPointerLeave() {
    if (paintValue === null && !grid.contains(document.activeElement)) setCursor(null);
  }

  /** Aktivasi dari keyboard atau pembaca layar datang sebagai click dengan detail 0. */
  function onClick(e) {
    if (e.detail !== 0) return;
    const hit = cellOf(e.target);
    if (!hit) return;
    remember();
    setCell(hit.r, hit.c, 1 - matrix[hit.r][hit.c]);
  }

  function onGridKey(e) {
    const keys = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]
    };
    if (keys[e.key]) {
      e.preventDefault();
      moveFocus(focus.r + keys[e.key][0], focus.c + keys[e.key][1]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveFocus(focus.r, 0);
    } else if (e.key === 'End') {
      e.preventDefault();
      moveFocus(focus.r, SIZE - 1);
    }
  }

  function onDocKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
    if (e.target.closest && e.target.closest('input, textarea')) return;
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  }

  function onFocusIn(e) {
    const hit = cellOf(e.target);
    if (!hit) return;
    // Fokus bisa datang dari Tab atau klik; roving tabindex mengikuti sel yang difokus.
    if (hit.r !== focus.r || hit.c !== focus.c) {
      cells[focus.r][focus.c].tabIndex = -1;
      focus = { r: hit.r, c: hit.c };
      hit.el.tabIndex = 0;
    }
    setCursor(hit.r, hit.c);
    setActiveRow(hit.r);
  }

  function buildGrid() {
    const ruler = root.querySelector('.pg__ruler');
    const labels = root.querySelector('.pg__row-labels');
    const list = root.querySelector('.readout__list');
    const rulerNums = [];
    const labelNums = [];
    const rowEls = [];
    const items = [];

    cells = [];
    rows = [];
    for (let r = 0; r < SIZE; r++) {
      const row = document.createElement('div');
      row.className = 'pg__row';
      row.setAttribute('role', 'row');
      cells.push([]);
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.setAttribute('role', 'gridcell');
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.tabIndex = r === 0 && c === 0 ? 0 : -1;
        row.appendChild(cell);
        cells[r].push(cell);
      }
      rowEls.push(row);

      const label = document.createElement('span');
      label.className = 'pg__row-num';
      label.textContent = pad2(r + 1);
      labelNums.push(label);

      const num = document.createElement('span');
      num.className = 'pg__ruler-num';
      num.dataset.col = String(r);
      num.textContent = pad2(r + 1);
      rulerNums.push(num);

      items.push(buildReadoutRow(r));
    }
    grid.replaceChildren.apply(grid, rowEls);
    ruler.replaceChildren.apply(ruler, rulerNums);
    labels.replaceChildren.apply(labels, labelNums);
    list.replaceChildren.apply(list, items);
    grid.setAttribute('aria-rowcount', String(SIZE));
    grid.setAttribute('aria-colcount', String(SIZE));
  }

  function span(cls, text) {
    const el = document.createElement('span');
    el.className = cls;
    if (text) el.textContent = text;
    return el;
  }

  function buildReadoutRow(r) {
    const li = document.createElement('li');
    li.className = 'readout__row';
    const bits = span('readout__bits');
    const count = span('readout__count');
    const hex = span('readout__hex');
    li.append(
      span('readout__label', 'R' + pad2(r + 1)),
      span('readout__sep', '|'),
      bits,
      span('readout__sep', '|'),
      count,
      hex
    );
    rows.push({ li: li, bits: bits, count: count, hex: hex });
    return li;
  }

  function restore() {
    const data = SL.storage.readMotif();
    if (data && data.gridSize === SIZE) {
      matrix = clone(data.matriksBiner);
      if (nameInput && data.metadata.namaPenenun !== 'Pengunjung') nameInput.value = data.metadata.namaPenenun;
    } else {
      matrix = blank(SIZE);
    }
  }

  function init(main) {
    if (root) return;
    root = main.querySelector('.pg');
    if (!root) return;
    grid = root.querySelector('.pg__grid');
    nameInput = root.querySelector('#nama-penjaga');

    out('bits').textContent = String(SIZE * SIZE);
    buildGrid();
    restore();
    paintAll();
    setCursor(null);
    past = [];
    future = [];
    updateHistoryButtons();

    const banner = root.querySelector('[data-banner="storage"]');
    if (banner) banner.hidden = SL.storage.available;

    bin.add(SL.on(grid, 'pointerdown', onPointerDown));
    bin.add(SL.on(grid, 'pointermove', onPointerMove));
    bin.add(SL.on(grid, 'pointerup', onPointerUp));
    bin.add(SL.on(grid, 'pointercancel', onPointerUp));
    bin.add(SL.on(grid, 'pointerleave', onPointerLeave));
    bin.add(SL.on(grid, 'click', onClick));
    bin.add(SL.on(grid, 'keydown', onGridKey));
    bin.add(SL.on(grid, 'focusin', onFocusIn));
    bin.add(SL.on(root, 'click', onAction));
    bin.add(SL.on(document, 'keydown', onDocKey));
    if (nameInput) bin.add(SL.on(nameInput, 'input', scheduleSave));
  }

  function destroy() {
    if (!root) return;
    stopWeave();
    flushSave();
    bin.flush();
    root = null;
    grid = null;
    nameInput = null;
    cells = [];
    rows = [];
    activeRow = -1;
    paintValue = null;
    focus = { r: 0, c: 0 };
  }

  SL.weaveGrid = { init: init, destroy: destroy };
})(window.SL = window.SL || {});
