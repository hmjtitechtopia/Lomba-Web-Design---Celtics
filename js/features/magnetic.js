/* Respons magnetis tombol utama untuk pointer halus; dipanggil SL.pages.
 * Transform GSAP terpisah dari translate CSS agar efek tekan tidak berebut. */
(function (SL) {
  'use strict';

  const SELECTOR = '.btn--primary:not([disabled]):not([aria-disabled="true"])';

  let mm = null;

  function attach(btn, gsap, M) {
    const opts = { duration: M.magnet.dur, ease: M.ease.enter };
    const toX = gsap.quickTo(btn, 'x', opts);
    const toY = gsap.quickTo(btn, 'y', opts);
    const bin = SL.disposer();

    bin.add(SL.on(btn, 'pointermove', function (e) {
      const r = btn.getBoundingClientRect();
      toX((e.clientX - (r.left + r.width / 2)) * M.magnet.strength);
      toY((e.clientY - (r.top + r.height / 2)) * M.magnet.strength);
    }));
    bin.add(SL.on(btn, 'pointerleave', function () {
      toX(0);
      toY(0);
    }));
    return function () {
      bin.flush();
      // quickTo menyimpan tween yang dapat dilanjutkan oleh event berikutnya.
      toX.tween.kill();
      toY.tween.kill();
    };
  }

  /** @param {HTMLElement} main Akar tombol yang memakai respons magnetis. */
  function init(main) {
    if (mm) return;
    const gsap = window.gsap;
    if (!gsap) return;
    mm = gsap.matchMedia();
    mm.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', function () {
      const offs = Array.prototype.map.call(main.querySelectorAll(SELECTOR), function (btn) {
        return attach(btn, gsap, SL.motion);
      });
      return function () { offs.forEach(function (off) { off(); }); };
    });
  }

  /** Kembalikan transform dan lepas listener sesuai konteks media. */
  function destroy() {
    if (mm) mm.revert();
    mm = null;
  }

  SL.magnetic = { init: init, destroy: destroy };
})(window.SL = window.SL || {});
