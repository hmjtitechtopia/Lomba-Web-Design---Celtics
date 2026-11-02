// Namespace dan lifecycle listener yang dipakai main serta modul fitur.
(function (SL) {
  'use strict';

  let activeListeners = 0;

  /**
   * Pasang listener dan kembalikan fungsi pelepasnya.
   * @param {EventTarget} el
   * @param {string} type
   * @param {Function} fn
   * @param {object} [opts]
   * @returns {Function} off
   */
  SL.on = function (el, type, fn, opts) {
    el.addEventListener(type, fn, opts);
    activeListeners += 1;
    let attached = true;
    return function off() {
      if (!attached) return;
      el.removeEventListener(type, fn, opts);
      attached = false;
      activeListeners -= 1;
    };
  };

  /**
   * Kumpulan disposer untuk satu modul: tambah, lalu lepas semuanya sekaligus.
   * @returns {{add: Function, flush: Function}}
   */
  SL.disposer = function () {
    let list = [];
    return {
      add: function (off) { list.push(off); return off; },
      flush: function () {
        list.forEach(function (off) { off(); });
        list = [];
      }
    };
  };

  SL.media = {
    touch: window.matchMedia('(hover: none), (pointer: coarse)'),
    mobile: window.matchMedia('(max-width: 899px)'),
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)')
  };

  SL.isTouch = function () { return SL.media.touch.matches; };
  SL.isMobile = function () { return SL.media.mobile.matches; };
  SL.prefersReducedMotion = function () { return SL.media.reduced.matches; };

  const resizeSubscribers = new Set();
  let resizeFrame = 0;
  let viewportWidth = window.innerWidth;
  let viewportOrientation = orientation();
  let stopResize = null;

  function orientation() {
    const screenOrientation = window.screen && window.screen.orientation;
    return screenOrientation ? screenOrientation.type + ':' + screenOrientation.angle : window.orientation;
  }

  function dispatchResize() {
    resizeFrame = 0;
    const width = window.innerWidth;
    const nextOrientation = orientation();
    // Bilah alamat dan keyboard hanya mengubah tinggi, bukan layout lebar.
    if (width === viewportWidth && nextOrientation === viewportOrientation) return;
    const detail = {
      width: width,
      previousWidth: viewportWidth,
      orientation: nextOrientation,
      previousOrientation: viewportOrientation
    };
    viewportWidth = width;
    viewportOrientation = nextOrientation;
    window.dispatchEvent(new CustomEvent('sl:layout', { detail: detail }));
    resizeSubscribers.forEach(function (fn) { fn(detail); });
  }

  function queueResize() {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(dispatchResize);
  }

  /** Satu rAF bersama; callback menerima detail sl:layout. Mengembalikan off(). */
  SL.onResize = function (fn) {
    resizeSubscribers.add(fn);
    if (!stopResize) {
      viewportWidth = window.innerWidth;
      viewportOrientation = orientation();
      const offResize = SL.on(window, 'resize', queueResize, { passive: true });
      const offOrientation = SL.on(window, 'orientationchange', queueResize, { passive: true });
      const screenOrientation = window.screen && window.screen.orientation;
      const offScreen = screenOrientation ? SL.on(screenOrientation, 'change', queueResize) : null;
      stopResize = function () {
        offResize();
        offOrientation();
        if (offScreen) offScreen();
      };
    }
    return function () {
      resizeSubscribers.delete(fn);
      if (resizeSubscribers.size || !stopResize) return;
      stopResize();
      stopResize = null;
      cancelAnimationFrame(resizeFrame);
      resizeFrame = 0;
    };
  };

  let stopLayout = null;
  SL.layout = {
    init: function () {
      if (!stopLayout) stopLayout = SL.onResize(function () {});
    },
    destroy: function () {
      if (stopLayout) stopLayout();
      stopLayout = null;
    }
  };

  /** GSAP + ScrollTrigger termuat dan gerak tidak dibatasi pengguna. */
  SL.canAnimate = function () {
    return Boolean(window.gsap && window.ScrollTrigger) && !SL.prefersReducedMotion();
  };

  /** Penyimpanan RAM bila localStorage diblokir (mode privat). */
  SL.memory = {};

  /** Modul yang ingin dihitung pada SL.inspect() mendaftarkan fungsi hitung di sini. */
  SL.probes = {};

  /**
   * Cetak hitungan nyata untuk juri yang membuka DevTools.
   * @returns {object}
   */
  SL.inspect = function () {
    const report = {
      halaman: document.body.dataset.page,
      listenerTerdaftar: activeListeners,
      scrollTrigger: window.ScrollTrigger ? window.ScrollTrigger.getAll().map(function (t) { return t.vars.id || '(tanpa id)'; }) : 'GSAP tidak termuat',
      router: SL.router && SL.router.enabled ? 'aktif (gulir ke section + pushState)' : 'nonaktif (anchor biasa)'
    };
    Object.keys(SL.probes).forEach(function (key) { report[key] = SL.probes[key](); });
    console.table(report);
    return report;
  };
})(window.SL = window.SL || {});
