/* Urai alat tenun dan tahun Arsip saat gulir; dipanggil SL.pages.
 * Pin hanya desktop, sedangkan reduced-motion mempertahankan informasi statis. */
(function (SL) {
  'use strict';

  const PARTS = ['lungsi', 'penggulung-lungsi', 'sisir', 'gulungan-kain'];
  const YEAR_FROM = 2026;
  const YEAR_TO = 1804;

  let stage = null;
  let year = null;
  let mm = null;
  let current = -1;
  const bin = SL.disposer();

  function partIndex(progress) {
    return Math.min(PARTS.length - 1, Math.floor(progress * PARTS.length));
  }

  function updateYear(p) {
    year.textContent = String(Math.round(YEAR_FROM + (YEAR_TO - YEAR_FROM) * p));
  }

  function setPart(index) {
    if (index === current) return;
    current = index;
    const name = PARTS[index];
    stage.querySelectorAll('.part').forEach(function (el) {
      const on = el.dataset.part === name;
      el.classList.toggle('is-active', on);
      el.classList.toggle('is-visually-hidden', stage.classList.contains('is-staged') && !on);
    });
    stage.querySelectorAll('[data-label-part]').forEach(function (label) {
      label.classList.toggle('is-active', label.dataset.labelPart === name);
    });
    stage.querySelectorAll('[data-part-group]').forEach(function (g) {
      g.classList.toggle('is-highlight', g.dataset.partGroup === name);
    });
    stage.querySelectorAll('.arsip__marker').forEach(function (btn) {
      if (btn.dataset.target === name) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  }

  /**
   * Satu label per bagian, masing-masing 1 satuan waktu, sehingga progres
   * timeline sejajar dengan partIndex(): bagian yang terurai = bagian yang aktif.
   */
  function explode(tl) {
    const ease = SL.motion.ease.transition;
    return tl
      .addLabel('lungsi', 0)
      .to('.loom__label-line', { strokeDashoffset: 0, stagger: 0.1, duration: 0.8, ease: ease }, 'lungsi')
      .addLabel('penggulung-lungsi', 1)
      .to('#penggulung-lungsi', { x: -60, y: -60, duration: 0.9, ease: ease }, 'penggulung-lungsi')
      .addLabel('sisir', 2)
      .to('#sisir', { x: 120, y: -80, rotation: -6, transformOrigin: '50% 50%', duration: 0.9, ease: ease }, 'sisir')
      .addLabel('gulungan-kain', 3)
      .to('#gulungan-kain', { x: 90, y: 90, duration: 0.9, ease: ease }, 'gulungan-kain')
      .to({}, { duration: 0.1 }, '>');
  }

  function onMarker(e) {
    const btn = e.target.closest('.arsip__marker');
    const st = window.ScrollTrigger && window.ScrollTrigger.getById('exploded');
    if (!btn) return;
    const i = PARTS.indexOf(btn.dataset.target);
    if (i < 0) return;
    if (!stage.classList.contains('is-staged')) {
      const article = stage.querySelector('[data-part="' + PARTS[i] + '"]');
      const visual = stage.querySelector('.arsip__visual');
      const inset = window.innerWidth < 900 ? visual.getBoundingClientRect().height + 24 : 0;
      const top = article.getBoundingClientRect().top + window.scrollY - inset;
      if (SL.smooth) SL.smooth.scrollTo(top);
      else window.scrollTo({ top: top, behavior: 'auto' });
      return;
    }
    if (!st) return;
    const top = st.start + (st.end - st.start) * (i / PARTS.length + 0.04);
    SL.smooth.scrollTo(top);
  }

  function desktop() {
    stage.classList.add('is-staged');
    updateYear(0);
    setPart(0);
    const tl = window.gsap.timeline({
      scrollTrigger: {
        id: 'exploded',
        trigger: '#arsip-stage',
        start: 'top top',
        end: '+=300%',
        pin: true,
        scrub: SL.motion.scrub.soft,
        anticipatePin: 1,
        onUpdate: function (self) {
          updateYear(self.progress);
          setPart(partIndex(self.progress));
        }
      }
    });
    explode(tl);
    return function () {
      stage.classList.remove('is-staged');
      stage.querySelectorAll('.part').forEach(function (el) {
        el.classList.remove('is-active', 'is-visually-hidden');
      });
      stage.querySelectorAll('[data-part-group]').forEach(function (group) { group.classList.remove('is-highlight'); });
      stage.querySelectorAll('.arsip__marker').forEach(function (marker) { marker.removeAttribute('aria-current'); });
      current = -1;
      year.textContent = String(YEAR_TO);
    };
  }

  function mobileLayout() {
    const block = year.closest('.arsip__year');
    const parent = block.parentNode;
    const next = block.nextSibling;
    stage.querySelector('.arsip__visual').append(block);
    return function () { parent.insertBefore(block, next); };
  }

  function mobile() {
    const articles = Array.from(stage.querySelectorAll('.part'));
    const visual = stage.querySelector('.arsip__visual');
    updateYear(0);
    setPart(0);
    const tl = window.gsap.timeline({
      scrollTrigger: {
        id: 'exploded',
        trigger: articles[0],
        endTrigger: articles[articles.length - 1],
        start: function () { return 'top top+=' + (visual.offsetHeight + 24); },
        end: function () { return 'bottom top+=' + (visual.offsetHeight + 24); },
        invalidateOnRefresh: true,
        scrub: SL.motion.scrub.soft,
        onUpdate: function (self) {
          updateYear(self.progress);
          // Ambang mengikuti posisi artikel, bukan empat durasi buatan.
          const threshold = visual.getBoundingClientRect().bottom + 24;
          let index = 0;
          articles.forEach(function (article, i) {
            if (article.getBoundingClientRect().top <= threshold + 1) index = i;
          });
          setPart(index);
        }
      }
    });
    tl.to('#sisir', { x: 30, y: -24, rotation: -4, transformOrigin: '50% 50%' }, 0)
      .to('#penggulung-lungsi', { y: -30 }, 0)
      .to('#gulungan-kain', { y: 30 }, 0);
    return function () {
      stage.querySelectorAll('.part, [data-label-part]').forEach(function (el) {
        el.classList.remove('is-active', 'is-visually-hidden');
      });
      stage.querySelectorAll('[data-part-group]').forEach(function (group) { group.classList.remove('is-highlight'); });
      stage.querySelectorAll('.arsip__marker').forEach(function (marker) { marker.removeAttribute('aria-current'); });
      current = -1;
      year.textContent = String(YEAR_TO);
    };
  }

  /** @param {HTMLElement} main Akar Arsip; pin hanya berlaku di desktop tanpa reduksi gerak. */
  function init(main) {
    if (stage) return;
    stage = main.querySelector('#arsip-stage');
    if (!stage) return;
    year = stage.querySelector('.arsip__year-num');
    bin.add(SL.on(stage, 'click', onMarker));
    if (!window.gsap || !window.ScrollTrigger) return;

    mm = window.gsap.matchMedia();
    mm.add('(max-width: 899px)', mobileLayout);
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', desktop);
    mm.add('(max-width: 899px) and (prefers-reduced-motion: no-preference)', mobile);
  }

  /** Revert konteks media sebelum referensi stage dilepas. */
  function destroy() {
    if (mm) mm.revert();
    mm = null;
    bin.flush();
    stage = null;
    year = null;
    current = -1;
  }

  SL.explodedView = { init: init, destroy: destroy };
})(window.SL = window.SL || {});
