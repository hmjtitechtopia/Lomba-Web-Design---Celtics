// Penyimpanan motif dan identitas FNV-1a untuk grid, benang, dan sertifikat.
(function (SL) {
  'use strict';

  const KEY = 'sandi_leluhur_data';
  const VERSION = 2;
  const GRID_SIZES = [8, 12, 16];
  const NAME_MAX = 32;
  const DEFAULT_NAME = 'Pengunjung';
  const DEFAULT_BITS = [1, 0, 1, 1, 0, 0, 1, 0];

  /**
   * Uji apakah sebuah Storage benar-benar bisa ditulis.
   * Safari mode privat lama melempar saat setItem, bukan saat diakses.
   * @param {string} type 'localStorage' | 'sessionStorage'
   * @returns {Storage|null}
   */
  function probe(type) {
    try {
      const store = window[type];
      const testKey = '__sl_probe__';
      store.setItem(testKey, '1');
      store.removeItem(testKey);
      return store;
    } catch (err) {
      return null;
    }
  }

  const local = { store: probe('localStorage'), pending: new Set(), failed: false };
  const session = { store: probe('sessionStorage'), pending: new Set(), failed: false };

  function read(channel, key) {
    // Tulisan yang gagal lebih baru daripada salinan lama di Storage.
    if (channel.store && !channel.pending.has(key)) {
      try {
        const value = channel.store.getItem(key);
        if (value !== null) SL.memory[key] = value;
        else delete SL.memory[key];
        return value;
      } catch (err) {
        channel.failed = true;
      }
    }
    return Object.prototype.hasOwnProperty.call(SL.memory, key) ? SL.memory[key] : null;
  }

  function write(channel, key, value) {
    SL.memory[key] = String(value);
    if (!channel.store) return false;
    try {
      channel.store.setItem(key, value);
      channel.pending.delete(key);
      channel.failed = false;
      return true;
    } catch (err) {
      channel.pending.add(key);
      channel.failed = true;
      return false;
    }
  }

  /**
   * Hash FNV-1a 32-bit.
   * @param {string} str
   * @returns {number} bilangan tak bertanda 32-bit
   */
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /**
   * Identitas motif. Pola yang sama selalu menghasilkan ID yang sama.
   * @param {number[][]} matrix
   * @param {Date} [date]
   */
  function identity(matrix, date) {
    const input = matrix.map(function (row) { return row.join(''); }).join('|');
    const hex8 = fnv1a(input).toString(16).toUpperCase().padStart(8, '0');
    const hex6 = hex8.slice(-6);
    const year = (date || new Date()).getFullYear();
    return {
      hex8: hex8,
      hex6: hex6,
      idTerminal: 'SL-' + hex6,
      nomorPiagam: 'PUSAKA-' + year + '-' + hex6,
      kodeMotif: '0x' + hex6,
      checksum: '0x' + hex8,
      checksum16: '0x' + hex8.slice(-4)
    };
  }

  /**
   * Bersihkan nama: buang karakter kontrol, trim, potong 32, kosong → Pengunjung.
   * @param {string} raw
   * @returns {string}
   */
  function sanitizeName(raw) {
    const clean = String(raw || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim().slice(0, NAME_MAX).trim();
    return clean || DEFAULT_NAME;
  }

  function isValid(data) {
    if (!data || data.version !== VERSION) return false;
    if (GRID_SIZES.indexOf(data.gridSize) === -1) return false;
    if (!data.metadata || typeof data.metadata.namaPenenun !== 'string') return false;
    const m = data.matriksBiner;
    if (!Array.isArray(m) || m.length !== data.gridSize) return false;
    return m.every(function (row) {
      return Array.isArray(row) && row.length === data.gridSize && row.every(function (v) { return v === 0 || v === 1; });
    });
  }

  /**
   * Baca motif tersimpan. Data rusak diabaikan tanpa galat.
   * @returns {object|null}
   */
  function readMotif() {
    const raw = read(local, KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return isValid(data) ? data : null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Simpan motif dalam skema versi 2.
   * @param {number[][]} matrix
   * @param {string} name
   * @returns {object} payload yang disimpan
   */
  function writeMotif(matrix, name) {
    const now = new Date();
    const payload = {
      version: VERSION,
      metadata: {
        namaPenenun: sanitizeName(name),
        tanggal: now.toISOString(),
        idTerminal: identity(matrix, now).idTerminal
      },
      gridSize: matrix.length,
      matriksBiner: matrix.map(function (row) { return row.slice(); })
    };
    write(local, KEY, JSON.stringify(payload));
    return payload;
  }

  /** Motif dianggap ada bila tersimpan dan minimal satu benang naik. */
  function hasMotif(data) {
    return Boolean(data) && data.matriksBiner.some(function (row) { return row.indexOf(1) !== -1; });
  }

  /**
   * Bit untuk kolom angka benang: motif pengunjung bila ada, bila tidak pola bawaan.
   * @returns {number[]}
   */
  function readBits() {
    const data = readMotif();
    if (!hasMotif(data)) return DEFAULT_BITS.slice();
    return data.matriksBiner.reduce(function (all, row) { return all.concat(row); }, []);
  }

  SL.storage = {
    KEY: KEY,
    get available() { return Boolean(local.store) && !local.failed && local.pending.size === 0; },
    fnv1a: fnv1a,
    identity: identity,
    sanitizeName: sanitizeName,
    readMotif: readMotif,
    writeMotif: writeMotif,
    hasMotif: hasMotif,
    readBits: readBits,
    session: {
      get: function (key) { return read(session, key); },
      set: function (key, value) { return write(session, key, value); }
    }
  };
})(window.SL = window.SL || {});
