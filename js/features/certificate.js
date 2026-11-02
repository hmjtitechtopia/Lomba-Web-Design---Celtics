// Piagam dari motif tersimpan dan ekspor PNG; lifecycle dipanggil SL.pages.
(function (SL) {
  'use strict';

  const W = 1520;
  const H = 960;
  const COLORS = {
    void: '#0D0D0D', ivory: '#F5F2EB', paper: '#FCF9F2', red: '#D91604',
    brass: '#C4A661', brassInk: '#7A5C14', concrete: '#A6A6A6', ash: '#6C6B67'
  };
  const FONTS = ['120px Anton', '34px "Playfair Display"', 'italic 34px "Playfair Display"', '22px "JetBrains Mono"', '700 22px "JetBrains Mono"'];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let root = null;
  let data = null;
  let ident = null;
  let urls = [];
  let generation = 0;
  const pendingButtons = new Set();
  const bin = SL.disposer();

  function setText(name, text) {
    root.querySelectorAll('[data-out="' + name + '"]').forEach(function (el) { el.textContent = text; });
  }

  function formatDate(iso) {
    const date = new Date(iso);
    const safe = Number.isFinite(date.getTime()) ? date : new Date();
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      .format(safe).replace('.', '').toUpperCase();
  }

  function countOnes(matrix) {
    return matrix.reduce(function (sum, row) {
      return sum + row.reduce(function (a, b) { return a + b; }, 0);
    }, 0);
  }

  /** Perangko: matriks motif pengunjung sebagai piksel. */
  function drawStamp(svg, matrix) {
    const n = matrix.length;
    svg.setAttribute('viewBox', '0 0 ' + n + ' ' + n);
    const rects = [];
    matrix.forEach(function (row, r) {
      row.forEach(function (v, c) {
        if (v !== 1) return;
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', c);
        rect.setAttribute('y', r);
        rect.setAttribute('width', 1);
        rect.setAttribute('height', 1);
        rects.push(rect);
      });
    });
    svg.replaceChildren.apply(svg, rects);
  }

  function renderPartner() {
    const cfg = SL.config || {};
    const line = root.querySelector('[data-partner-line]');
    // Tanpa mitra nyata tombol tetap nonaktif di HTML; tautan hanya dibuat bila data tersedia.
    if (cfg.mitraUrl && cfg.mitraNama) {
      const cta = document.createElement('a');
      cta.className = 'btn btn--primary';
      cta.setAttribute('data-partner', '');
      cta.href = cfg.mitraUrl;
      cta.target = '_blank';
      cta.rel = 'noopener noreferrer';
      cta.textContent = '[ DUKUNG PENGRAJIN → ]';
      root.querySelector('[data-partner]').replaceWith(cta);
      line.textContent = 'Mitra Pengrajin: ' + cfg.mitraNama + (cfg.mitraDaerah ? ', ' + cfg.mitraDaerah : '');
    }
    const team = root.querySelector('[data-team]');
    if (team) {
      if (cfg.namaTim) team.textContent = 'Dirancang oleh ' + cfg.namaTim;
      else team.remove();
    }
  }

  function render() {
    const m = data.matriksBiner;
    const naik = countOnes(m);
    const n = m.length;
    setText('nomor', ident.nomorPiagam);
    setText('nama', data.metadata.namaPenenun);
    setText('id', ident.idTerminal);
    setText('kode', ident.kodeMotif);
    setText('checksum', ident.checksum);
    setText('chk16', ident.checksum16);
    setText('tanggal', formatDate(data.metadata.tanggal));
    setText('ukuran', n + ' × ' + n);
    setText('naik', String(naik));
    setText('turun', String(n * n - naik));
    setText('lokasi', SL.storage.available ? 'DI PERANGKAT INI' : 'SEMENTARA (SESI INI)');
    setText('blok', 'MATRIKS-SONGKET-' + n);

    const lines = root.querySelector('[data-out="baris"]');
    lines.replaceChildren.apply(lines, m.slice(0, 3).map(function (row) {
      const li = document.createElement('li');
      li.textContent = row.join(' ');
      return li;
    }));
    drawStamp(root.querySelector('.cert__stamp-grid'), m);
  }

  function setMessage(text) {
    setText('pesan', text);
  }

  function text(ctx, value, x, y, font, color, align) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.fillText(value, x, y);
  }

  function hairline(ctx, x1, y, x2) {
    ctx.fillStyle = COLORS.brass;
    ctx.fillRect(x1, y, x2 - x1, 2);
  }

  function paintCanvas(data, ident) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const m = data.matriksBiner;
    const n = m.length;
    const mono = '22px "JetBrains Mono", monospace';
    const monoBold = '700 22px "JetBrains Mono", monospace';

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 8;
    ctx.strokeStyle = COLORS.void;
    ctx.strokeRect(4, 4, W - 8, H - 8);

    text(ctx, 'KODEKS PRESERVASI NUSANTARA', 64, 84, mono, COLORS.void);
    text(ctx, 'LEMBAR PIAGAM DIGITAL', W - 64, 84, mono, COLORS.void, 'right');
    hairline(ctx, 64, 108, W - 64);
    text(ctx, 'PENJAGA PUSAKA', 60, 300, '120px Anton, Impact, sans-serif', COLORS.void);
    text(ctx, 'Dengan ini menenun masa lalu ke masa depan.', 64, 362, 'italic 34px "Playfair Display", Georgia, serif', COLORS.void);

    // Blok terminal
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(64, 410, 860, 330);
    const tx = 96;
    text(ctx, 'TERMINAL REKAMAN // NODE: PERANGKAT-INI', tx, 456, mono, COLORS.concrete);
    text(ctx, 'NAMA PENJAGA', tx, 510, mono, COLORS.concrete);
    text(ctx, data.metadata.namaPenenun, tx + 260, 510, monoBold, COLORS.ivory);
    text(ctx, 'ID MOTIF', tx, 550, mono, COLORS.concrete);
    text(ctx, ident.idTerminal, tx + 260, 550, monoBold, COLORS.ivory);
    text(ctx, 'MOTIF BINER', tx, 590, mono, COLORS.concrete);
    m.slice(0, 3).forEach(function (row, i) {
      text(ctx, row.join(' '), tx + 260, 590 + i * 34, mono, COLORS.ivory);
    });
    text(ctx, 'CHECKSUM (FNV-1A)', tx, 712, mono, COLORS.concrete);
    text(ctx, ident.checksum, tx + 260, 712, monoBold, COLORS.ivory);

    // Perangko berisi motif
    const sx = 1060;
    const sy = 150;
    ctx.fillStyle = COLORS.ivory;
    ctx.fillRect(sx, sy, 396, 456);
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.void;
    ctx.strokeRect(sx + 10, sy + 10, 376, 436);
    ctx.setLineDash([]);
    const cell = Math.floor(312 / n);
    const gx = sx + (396 - cell * n) / 2;
    const gy = sy + 40;
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(gx, gy, cell * n, cell * n);
    ctx.fillStyle = COLORS.red;
    m.forEach(function (row, r) {
      row.forEach(function (v, c) {
        if (v === 1) ctx.fillRect(gx + c * cell, gy + r * cell, cell, cell);
      });
    });
    text(ctx, 'POS PUSAKA // ' + n + ' × ' + n, sx + 198, gy + cell * n + 44, mono, COLORS.void, 'center');
    text(ctx, 'ARSIP BINER', sx + 198, gy + cell * n + 76, monoBold, COLORS.void, 'center');

    // Cap pos
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.ash;
    ctx.arc(1010, 640, 84, 0, Math.PI * 2);
    ctx.stroke();
    text(ctx, 'MenenunSejarah', 1010, 616, '700 18px "JetBrains Mono", monospace', COLORS.ash, 'center');
    text(ctx, formatDate(data.metadata.tanggal), 1010, 652, monoBold, COLORS.ash, 'center');
    text(ctx, 'TERCAP', 1010, 686, '18px "JetBrains Mono", monospace', COLORS.ash, 'center');

    // Kaki
    hairline(ctx, 64, 790, W - 64);
    ctx.beginPath();
    ctx.fillStyle = COLORS.brass;
    ctx.arc(116, 866, 44, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'SL', 116, 862, '32px Anton, Impact, sans-serif', COLORS.void, 'center');
    text(ctx, '2026', 116, 890, '700 16px "JetBrains Mono", monospace', COLORS.void, 'center');
    text(ctx, '[ MenenunSejarah · TECHTOPIA VOL. 2 ]', 184, 858, mono, COLORS.void);
    if (SL.config && SL.config.namaTim) {
      text(ctx, 'Dirancang oleh ' + SL.config.namaTim, 184, 892, '22px "Playfair Display", Georgia, serif', COLORS.void);
    }
    text(ctx, 'Piagam simbolis, bukan dokumen resmi.', W - 64, 892, 'italic 24px "Playfair Display", Georgia, serif', COLORS.void, 'right');

    return canvas;
  }

  /** Teks kanvas baru akurat setelah font benar-benar siap. */
  function makeBlob(snapshot) {
    const loads = document.fonts ? FONTS.map(function (f) { return document.fonts.load(f); }) : [];
    const ready = document.fonts ? Promise.all(loads).then(function () { return document.fonts.ready; }) : Promise.resolve();
    return ready.catch(function () { /* font cadangan tetap dipakai */ }).then(function () {
      const canvas = paintCanvas(snapshot.data, snapshot.ident);
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('Kanvas gagal diubah menjadi PNG'));
        }, 'image/png');
      });
    });
  }

  function fileName(identity) {
    return 'penjaga-pusaka-' + identity.idTerminal + '.png';
  }

  function download(blob, identity) {
    const url = URL.createObjectURL(blob);
    urls.push(url);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(identity);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      urls = urls.filter(function (u) { return u !== url; });
    }, 1000);
  }

  function beginExport(btn) {
    btn.disabled = true;
    pendingButtons.add(btn);
    // Motif dapat diganti atau dihapus selama font dan PNG disiapkan.
    return {
      generation: generation,
      data: {
        metadata: Object.assign({}, data.metadata),
        matriksBiner: data.matriksBiner.map(function (row) { return row.slice(); })
      },
      ident: Object.assign({}, ident)
    };
  }

  function isCurrent(snapshot) {
    return root !== null && snapshot.generation === generation;
  }

  function finishExport(btn, snapshot) {
    if (!isCurrent(snapshot)) return;
    pendingButtons.delete(btn);
    btn.disabled = false;
  }

  function onDownload(btn) {
    const snapshot = beginExport(btn);
    setMessage('Menyiapkan PNG…');
    makeBlob(snapshot)
      .then(function (blob) {
        if (!isCurrent(snapshot)) return;
        download(blob, snapshot.ident);
        setMessage('PNG diunduh: ' + fileName(snapshot.ident));
      })
      .catch(function () {
        if (isCurrent(snapshot)) setMessage('PNG gagal dibuat. Coba tekan UNDUH PNG sekali lagi.');
      })
      .then(function () { finishExport(btn, snapshot); });
  }

  function onShare(btn) {
    const snapshot = beginExport(btn);
    makeBlob(snapshot)
      .then(function (blob) {
        if (!isCurrent(snapshot)) return;
        const file = new File([blob], fileName(snapshot.ident), { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator.share({
            files: [file],
            title: 'Piagam Penjaga Pusaka',
            text: 'Motif ' + snapshot.ident.idTerminal + ', ditenun di MenenunSejarah.'
          }).then(function () {
            if (isCurrent(snapshot)) setMessage('Sertifikat dibagikan.');
          });
        }
        download(blob, snapshot.ident);
        setMessage('Peramban ini belum bisa membagikan berkas, jadi PNG diunduh sebagai gantinya.');
        return null;
      })
      .catch(function (err) {
        if (!isCurrent(snapshot) || (err && err.name === 'AbortError')) return;
        setMessage('Sertifikat gagal dibagikan. Coba lagi, atau pakai UNDUH PNG.');
      })
      .then(function () { finishExport(btn, snapshot); });
  }

  function onAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled || !ident) return;
    if (btn.dataset.action === 'unduh') onDownload(btn);
    else if (btn.dataset.action === 'bagikan') onShare(btn);
  }

  /** Baca motif tersimpan dan tampilkan keadaan kosong atau piagam. */
  function refresh() {
    data = SL.storage.readMotif();
    const ready = SL.storage.hasMotif(data);
    const empty = root.querySelector('[data-state="empty"]');
    const changed = empty.hidden !== ready;
    empty.hidden = ready;
    root.querySelector('[data-state="ready"]').hidden = !ready;
    // Tinggi section berubah; posisi pemicu gulir di bawahnya perlu dihitung ulang.
    if (changed && window.ScrollTrigger) window.ScrollTrigger.refresh();
    if (!ready) {
      ident = null;
      setText('chk16', '—');
      return;
    }
    const saved = new Date(data.metadata.tanggal);
    ident = SL.storage.identity(data.matriksBiner, Number.isFinite(saved.getTime()) ? saved : new Date());
    render();
  }

  /** Cap pos dihentak saat piagam pertama kali terlihat. */
  function stampWhenVisible() {
    const postmark = root.querySelector('.cert__postmark');
    if (SL.prefersReducedMotion() || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      postmark.classList.add('is-stamped');
      io.disconnect();
    }, { threshold: 0.6 });
    io.observe(postmark);
    bin.add(function () { io.disconnect(); });
  }

  function init(main) {
    if (root) return;
    root = main.querySelector('.dampak');
    if (!root) return;
    renderPartner();
    setText('sys', window.gsap && SL.storage.available ? 'SYS_NORMAL' : 'SYS_LITE');
    refresh();
    stampWhenVisible();
    bin.add(SL.on(root, 'click', onAction));
    bin.add(SL.on(document, 'sl:motif', refresh));
  }

  function destroy() {
    generation += 1;
    pendingButtons.forEach(function (btn) { btn.disabled = false; });
    pendingButtons.clear();
    urls.forEach(function (url) { URL.revokeObjectURL(url); });
    urls = [];
    bin.flush();
    root = null;
    data = null;
    ident = null;
  }

  SL.certificate = { init: init, destroy: destroy };
})(window.SL = window.SL || {});
