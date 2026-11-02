// Gulir native dan tween GSAP untuk anchor; dipanggil main dan router.
(function (SL) {
  'use strict';

  let enabled = false;
  let tween = null;
  const bin = SL.disposer();

  function cancel() {
    if (tween) tween.kill();
    tween = null;
  }

  function onKey(e) {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].indexOf(e.key) !== -1) cancel();
  }

  function init() {
    if (enabled || !SL.canAnimate()) return;
    enabled = true;
    // Input pengguna mengambil alih tween anchor tanpa menghalangi gulir native.
    bin.add(SL.on(window, 'wheel', cancel, { passive: true }));
    bin.add(SL.on(window, 'touchstart', cancel, { passive: true }));
    bin.add(SL.on(window, 'keydown', onKey));
  }

  /** Gulir ke koordinat dokumen; reduced-motion selalu langsung. */
  function scrollTo(top, opt) {
    cancel();
    const smooth = (!opt || opt.smooth !== false) && !SL.prefersReducedMotion();
    if (!smooth || !enabled || !SL.canAnimate()) {
      window.scrollTo({ top: top, behavior: smooth ? 'smooth' : 'instant' });
      return;
    }
    const position = { y: window.scrollY };
    const limit = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    tween = window.gsap.to(position, {
      y: Math.min(Math.max(top, 0), limit),
      duration: SL.motion.dur.long,
      ease: SL.motion.ease.enter,
      onUpdate: function () {
        // Instant mencegah CSS scroll-behavior menambahkan animasi kedua tiap frame.
        window.scrollTo({ top: position.y, behavior: 'instant' });
        window.ScrollTrigger.update();
      },
      onComplete: function () { tween = null; }
    });
  }

  function destroy() {
    cancel();
    bin.flush();
    enabled = false;
  }

  SL.smooth = {
    init: init,
    scrollTo: scrollTo,
    destroy: destroy,
    get active() { return enabled; }
  };
})(window.SL = window.SL || {});
