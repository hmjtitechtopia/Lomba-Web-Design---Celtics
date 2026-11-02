/* Jejak kartu tenun untuk pointer dan sentuh; dipanggil SL.pages.
 * Modul memiliki listener, pemuatan gambar, dan animasi setiap kartu. */
(function (SL) {
  'use strict';

  const IMAGES = [
    'assets/img/tenun-01.svg', 'assets/img/tenun-02.svg', 'assets/img/tenun-03.svg',
    'assets/img/tenun-04.svg', 'assets/img/tenun-05.svg', 'assets/img/tenun-06.svg',
    'assets/img/tenun-07.svg', 'assets/img/tenun-08.svg', 'assets/img/tenun-09.svg',
    'assets/img/tenun-10.svg'
  ];
  const MIN_DIST = { pointer: 80, touch: 56 };
  const MAX_NODES = { pointer: 12, touch: 8 };
  const MAX_TILT = 7;
  const cardCleanups = new Map();
  let preloadGeneration = 0;
  let preloadImages = [];
  let preloadIdle = 0;
  let preloadOffset = 0;
  let activePointer = null;
  let tapStart = null;

  let zone = null;
  let layer = null;
  let nodes = [];          // kartu aktif, urut dari tertua
  let usable = [];         // gambar yang berhasil dimuat
  let next = 0;
  let depth = 0;
  let last = null;
  let pending = null;      // posisi pointer terbaru untuk rAF
  let raf = 0;
  let staticCard = null;   // kartu tunggal untuk prefers-reduced-motion
  const bin = SL.disposer();

  SL.probes.kartuJejakAktif = function () { return nodes.length + (staticCard ? 1 : 0); };

  function kind(e) {
    return e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'pointer';
  }

  function preload() {
    if (preloadIdle || preloadOffset >= IMAGES.length) return;
    const generation = preloadGeneration;
    function loadBatch() {
      preloadIdle = 0;
      if (generation !== preloadGeneration) return;
      IMAGES.slice(preloadOffset, preloadOffset + 4).forEach(function (src) {
        const img = new Image();
        preloadImages.push(img);
        // Callback lama tidak boleh mengisi daftar milik init berikutnya.
        img.onload = function () {
          if (generation === preloadGeneration) usable.push(src);
        };
        img.decoding = 'async';
        img.src = src;
      });
      preloadOffset += 4;
    }
    preloadIdle = window.requestIdleCallback ? window.requestIdleCallback(loadBatch, { timeout: 1000 }) : window.setTimeout(loadBatch, 32);
  }

  function removeNode(el) {
    const i = nodes.indexOf(el);
    if (i !== -1) nodes.splice(i, 1);
    const cleanup = cardCleanups.get(el);
    if (cleanup) cleanup();
    cardCleanups.delete(el);
    el.style.removeProperty('will-change');
    el.remove();
  }

  function makeCard(x, y, tilt) {
    const img = document.createElement('img');
    img.className = 'trail__card';
    img.src = usable[next % usable.length];
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    if (SL.isMobile()) {
      img.style.width = (window.innerWidth < 600 ? 120 : 150) + 'px';
      img.style.height = (window.innerWidth < 600 ? 160 : 200) + 'px';
    }
    img.style.left = x + 'px';
    img.style.top = y + 'px';
    img.style.zIndex = String(++depth);
    img.style.setProperty('--tilt', tilt + 'deg');
    next += 1;
    return img;
  }

  function animate(card, tilt) {
    card.style.willChange = 'transform, opacity';
    if (window.gsap) {
      // Transform diatur penuh oleh GSAP agar tidak berebut dengan transform CSS.
      window.gsap.set(card, { xPercent: -50, yPercent: -50, x: 0, y: 0, rotation: tilt });
      const timeline = window.gsap.timeline({ onComplete: function () { removeNode(card); } });
      cardCleanups.set(card, function () { timeline.kill(); });
      timeline.fromTo(card, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: SL.motion.dur.micro, ease: SL.motion.ease.enter })
        .to(card, { opacity: 0, duration: 0.7, ease: 'power1.in' }, 0.7);
      return;
    }
    card.classList.add('trail__card--css');
    cardCleanups.set(card, SL.on(card, 'animationend', function () { removeNode(card); }, { once: true }));
  }

  function spawn(x, y, dx, k) {
    preload();
    if (document.hidden || !usable.length) return;
    while (nodes.length >= MAX_NODES[k]) removeNode(nodes[0]);
    const sign = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
    const tilt = sign * (2 + Math.random() * (MAX_TILT - 2));
    const card = makeCard(x, y, tilt);
    nodes.push(card);
    layer.appendChild(card);
    animate(card, tilt);
  }

  function stampStatic(x, y) {
    preload();
    if (document.hidden || !usable.length) return;
    if (staticCard) staticCard.remove();
    staticCard = makeCard(x, y, 0);
    staticCard.classList.add('trail__card--static');
    layer.appendChild(staticCard);
  }

  /**
   * Posisi pointer relatif zona, dijepit ke kanvas kosong di antara teks
   * "Masa Lalu" dan "Masa Depan" agar kartu tidak menutupi teks.
   */
  function local(e) {
    const rect = zone.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top, kind: kind(e) };
    const past = zone.querySelector('.trail__side--past').getBoundingClientRect();
    const future = zone.querySelector('.trail__side--future').getBoundingClientRect();
    const half = SL.isTouch() ? 60 : 90;
    if (SL.isMobile()) {
      const width = window.innerWidth < 600 ? 120 : 150;
      const height = width * 4 / 3;
      // Sisakan ruang untuk sudut kartu saat rotasi maksimum.
      const angle = MAX_TILT * Math.PI / 180;
      const halfX = (width * Math.cos(angle) + height * Math.sin(angle)) / 2;
      const halfY = (height * Math.cos(angle) + width * Math.sin(angle)) / 2;
      p.x = clamp(p.x, halfX, rect.width - halfX);
      p.y = clamp(p.y, Math.max(halfY, past.bottom - rect.top + halfY), Math.min(rect.height - halfY, future.top - rect.top - halfY));
    } else {
      p.x = clamp(p.x, past.right - rect.left + half, future.left - rect.left - half);
    }
    return p;
  }

  function clamp(v, min, max) {
    return min > max ? (min + max) / 2 : Math.min(Math.max(v, min), max);
  }

  function flush() {
    raf = 0;
    if (!pending || SL.prefersReducedMotion()) return;
    const p = pending;
    pending = null;
    if (!last || last.kind !== p.kind) {
      last = p;
      return;
    }
    if (Math.hypot(p.x - last.x, p.y - last.y) >= MIN_DIST[p.kind]) {
      spawn(p.x, p.y, p.x - last.x, p.kind);
      last = p;
    }
  }

  function onMove(e) {
    if (!e.isPrimary) return;
    if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 10) tapStart = null;
    if (SL.prefersReducedMotion() || (kind(e) === 'touch' && activePointer !== e.pointerId)) return;
    pending = local(e);
    if (!raf) raf = requestAnimationFrame(flush);
  }

  function onDown(e) {
    if (!e.isPrimary || e.button !== 0) return;
    activePointer = e.pointerId;
    tapStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
    const p = local(e);
    last = p;
    if (!SL.prefersReducedMotion()) spawn(p.x, p.y, 0, p.kind);
  }

  function onUp(e) {
    if (!e.isPrimary || activePointer !== e.pointerId) return;
    if (SL.prefersReducedMotion() && tapStart && tapStart.id === e.pointerId && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) <= 10) {
      const p = local(e);
      stampStatic(p.x, p.y);
    }
    activePointer = null;
    tapStart = null;
    if (kind(e) === 'touch') onLeave();
  }

  function onLeave() {
    cancelAnimationFrame(raf);
    raf = 0;
    last = null;
    pending = null;
    activePointer = null;
    tapStart = null;
  }

  function updateHint() {
    const hint = zone.querySelector('.trail__hint');
    if (hint) hint.textContent = SL.isTouch() ? 'KETUK ATAU SERET DI AREA INI' : 'GERAKKAN KURSOR DI AREA INI';
  }

  function onMotionChange() {
    cancelAnimationFrame(raf);
    raf = 0;
    onLeave();
    nodes.slice().forEach(removeNode);
    if (staticCard) staticCard.remove();
    staticCard = null;
  }

  /** @param {HTMLElement} main Akar konten yang memiliki zona jejak. */
  function init(main) {
    if (zone) return;
    zone = main.querySelector('.trail');
    if (!zone) return;
    layer = zone.querySelector('.trail__layer');
    preloadGeneration += 1;
    preload();
    updateHint();
    bin.add(SL.on(zone, 'pointerdown', onDown, { passive: true }));
    bin.add(SL.on(zone, 'pointerup', onUp, { passive: true }));
    bin.add(SL.on(zone, 'pointerleave', onLeave));
    bin.add(SL.on(zone, 'pointercancel', onLeave));
    bin.add(SL.on(zone, 'pointermove', onMove, { passive: true }));
    bin.add(SL.on(SL.media.touch, 'change', updateHint));
    bin.add(SL.onResize(onMotionChange));
    bin.add(SL.on(SL.media.reduced, 'change', onMotionChange));
  }

  /** Lepas seluruh pekerjaan asinkron sebelum zona dibuang atau dipasang ulang. */
  function destroy() {
    preloadGeneration += 1;
    if (window.cancelIdleCallback) window.cancelIdleCallback(preloadIdle);
    else window.clearTimeout(preloadIdle);
    preloadIdle = 0;
    preloadOffset = 0;
    preloadImages.forEach(function (img) { img.onload = null; });
    preloadImages = [];
    usable = [];
    onMotionChange();
    nodes = [];
    next = 0;
    depth = 0;
    bin.flush();
    zone = null;
    layer = null;
    last = null;
    pending = null;
  }

  SL.cursorTrail = { init: init, destroy: destroy };
})(window.SL = window.SL || {});
