/* Singkap manifesto dan log sekali per sesi; dipanggil SL.pages.
 * HTML tetap menjadi sumber konten bila animasi gagal. */
(function (SL) {
  'use strict';

  const SEEN_KEY = 'sl_boot_seen';
  const LOG_BUDGET = 600;       // ms untuk seluruh log terminal
  const CHAR_DELAY = 18;        // ms per karakter
  const TITLE_START = 400;
  const LINE_GAP = 120;
  const LEAD_AT = 1400;
  const CTA_AT = 1900;
  const REST_AT = 2100;

  let boot = null;
  let tl = null;
  let timers = [];
  let logLines = [];
  const bin = SL.disposer();

  function at(ms, fn) {
    timers.push(setTimeout(fn, ms));
  }

  function reveal(el) {
    el.classList.add('is-in');
  }

  function fillMotifLine() {
    const out = boot.querySelector('[data-log="motif"]');
    if (!out) return;
    const data = SL.storage.readMotif();
    out.dataset.text = SL.storage.hasMotif(data)
      ? '> motif: tersimpan (' + SL.storage.identity(data.matriksBiner).idTerminal + ')'
      : '> motif: kosong';
    out.textContent = out.dataset.text;
  }

  function typeLog() {
    const total = logLines.reduce(function (n, el) { return n + el.dataset.text.length; }, 0);
    const delay = Math.min(CHAR_DELAY, LOG_BUDGET / Math.max(total, 1));
    let clock = 0;
    logLines.forEach(function (el) {
      const text = el.dataset.text;
      el.textContent = '';
      for (let i = 1; i <= text.length; i++) {
        at(clock + i * delay, function () { el.textContent = text.slice(0, i); });
      }
      clock += text.length * delay;
    });
  }

  function finish() {
    if (!boot) return;
    if (tl) {
      // Lompat ke keadaan akhir; onComplete tidak dipanggil ulang karena tl dikosongkan dulu.
      const t = tl;
      tl = null;
      t.progress(1).kill();
    }
    timers.forEach(clearTimeout);
    timers = [];
    logLines.forEach(function (el) { el.textContent = el.dataset.text; });
    boot.classList.add('is-done');
    const skip = boot.querySelector('.boot__skip');
    if (skip) skip.hidden = true;
    bin.flush();
  }

  function onKey(e) {
    if (e.key === 'Escape') finish();
  }

  function typeLogInto(timeline) {
    const total = logLines.reduce(function (n, el) { return n + el.dataset.text.length; }, 0);
    const perChar = Math.min(CHAR_DELAY, LOG_BUDGET / Math.max(total, 1)) / 1000;
    logLines.forEach(function (el, i) {
      const text = el.dataset.text;
      const typed = { n: 0 };
      el.textContent = '';
      timeline.to(typed, {
        n: text.length,
        duration: text.length * perChar,
        ease: 'none',
        onUpdate: function () { el.textContent = text.slice(0, Math.round(typed.n)); }
      }, i ? '>' : 'log');
    });
  }

  /**
   * Urutan Booting sebagai satu timeline berlabel (≈ 2,6 dtk, di bawah anggaran 3 dtk).
   * Gaya awal tersembunyi berasal dari CSS (motion.css); fromTo menegaskannya
   * agar timeline tidak bergantung pada urutan muat stylesheet.
   */
  function playTimeline() {
    const gsap = window.gsap;
    const M = SL.motion;
    tl = gsap.timeline({ defaults: { ease: M.ease.enterStrong }, onComplete: finish });
    tl.addLabel('log', 0);
    typeLogInto(tl);
    tl.addLabel('title', TITLE_START / 1000)
      .fromTo(boot.querySelectorAll('.boot__mask'),
        // y: 0 menetralkan translateY(105%) dari CSS yang dibaca GSAP sebagai piksel.
        { y: 0, yPercent: 105, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: M.dur.reveal, stagger: LINE_GAP / 1000 }, 'title')
      .addLabel('lead', LEAD_AT / 1000)
      .fromTo(boot.querySelectorAll('[data-reveal="lead"]'),
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: M.dur.base, ease: M.ease.enter }, 'lead')
      .addLabel('cta', CTA_AT / 1000)
      .fromTo(boot.querySelectorAll('[data-reveal="cta"]'),
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: M.dur.base, ease: M.ease.enter }, 'cta')
      .fromTo(boot.querySelectorAll('[data-reveal="rest"]'),
        { opacity: 0 },
        { opacity: 1, duration: M.dur.base, ease: M.ease.transition }, 'cta+=' + (REST_AT - CTA_AT) / 1000);
  }

  function play() {
    if (SL.canAnimate()) {
      playTimeline();
    } else {
      // Cadangan tanpa GSAP: kelas .is-in memicu transisi CSS pada jadwal yang sama.
      const lines = boot.querySelectorAll('.boot__mask');
      typeLog();
      lines.forEach(function (el, i) {
        at(TITLE_START + i * LINE_GAP, function () { reveal(el); });
      });
      at(LEAD_AT, function () { boot.querySelectorAll('[data-reveal="lead"]').forEach(reveal); });
      at(CTA_AT, function () { boot.querySelectorAll('[data-reveal="cta"]').forEach(reveal); });
      at(REST_AT, function () { boot.querySelectorAll('[data-reveal="rest"]').forEach(reveal); });
      at(REST_AT + 600, finish);
    }

    const skip = boot.querySelector('.boot__skip');
    skip.hidden = false;
    bin.add(SL.on(skip, 'click', finish));
    bin.add(SL.on(document, 'keydown', onKey));
  }

  /** @param {HTMLElement} main Akar konten manifesto. */
  function init(main) {
    if (boot) return;
    boot = main.querySelector('.boot');
    if (!boot) return;
    fillMotifLine();
    logLines = Array.from(boot.querySelectorAll('[data-log]'));
    logLines.forEach(function (el) { el.dataset.text = el.dataset.text || el.textContent; });

    const seen = SL.storage.session.get(SEEN_KEY) === '1';
    SL.storage.session.set(SEEN_KEY, '1');
    if (seen || SL.prefersReducedMotion()) {
      finish();
      return;
    }
    play();
  }

  /** Batalkan timeline, jadwal cadangan, dan listener milik manifesto. */
  function destroy() {
    if (tl) tl.kill();
    tl = null;
    timers.forEach(clearTimeout);
    timers = [];
    bin.flush();
    boot = null;
    logLines = [];
  }

  SL.bootSequence = { init: init, destroy: destroy };
})(window.SL = window.SL || {});
