/* Titik masuk semua modul; dijalankan setelah classic script defer.
 * Shell dan fitur dilepas bersama saat pagehide dan dipulihkan lewat bfcache. */
(function (SL) {
  'use strict';

  const MODULES = [
    'bootSequence', 'cursorTrail', 'homeSections',
    'explodedView', 'weaveGrid', 'certificate', 'magnetic'
  ];

  let active = [];

  let isRunning = false;

  SL.pages = {
    init: function () {
      if (active.length) return;
      const main = document.getElementById('konten');
      active = MODULES.filter(function (name) { return SL[name]; });
      active.forEach(function (name) {
        SL[name].init(main);
      });
    },
    destroy: function () {
      active.slice().reverse().forEach(function (name) { SL[name].destroy(); });
      active = [];
    }
  };

  function start() {
    const root = document.documentElement;
    if (window.gsap && window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
    } else {
      root.classList.add('no-gsap');
    }
    if (isRunning) return;
    isRunning = true;
    SL.layout.init();
    SL.smooth.init();
    SL.pages.init();
    // Ukuran interval benang baru sah setelah pin Arsip terpasang.
    SL.thread.init();
    // Modul membuat trigger tidak urut halaman (Beranda dulu, pin Arsip belakangan);
    // urutkan agar trigger di bawah pin ikut menghitung jarak pin-nya.
    if (window.ScrollTrigger) {
      window.ScrollTrigger.sort();
      // Font yang selesai ditukar mengubah tinggi judul; ukur ulang posisi trigger.
      if (document.fonts) document.fonts.ready.then(function () {
        if (isRunning) window.ScrollTrigger.refresh();
      });
    }
    // Router terakhir: lompatan awal ke #hash butuh pin ScrollTrigger yang sudah terpasang.
    SL.router.init();

  }

  function suspend() {
    if (!isRunning) return;
    isRunning = false;
    SL.router.destroy();
    SL.thread.destroy();
    SL.pages.destroy();
    SL.smooth.destroy();
    SL.layout.destroy();
  }

  start();
  SL.on(window, 'pagehide', suspend);
  SL.on(window, 'pageshow', function (event) {
    if (event.persisted) start();
  });
})(window.SL = window.SL || {});
