// Navigasi anchor satu halaman; dipanggil main setelah ScrollTrigger siap.
(function (SL) {
  'use strict';

  let enabled = false;
  let restoration = null;
  const bin = SL.disposer();

  function targetOf(hash) {
    try {
      const id = decodeURIComponent(hash.replace(/^#/, ''));
      return id ? document.getElementById(id) : null;
    } catch (err) {
      // Hash luar bisa memuat escape yang terpotong.
      return null;
    }
  }

  /** Section halaman dapat fokus di judulnya agar pembaca layar ikut pindah. */
  function focusSection(target) {
    if (!target.classList.contains('page-section')) return;
    const heading = Array.from(target.querySelectorAll('h1, h2')).find(function (el) {
      return el.getClientRects().length > 0 && window.getComputedStyle(el).visibility === 'visible';
    });
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }

  /**
   * Gulir ke elemen ber-id.
   * @param {string} hash
   * @param {{smooth:boolean}} [opt]
   * @returns {boolean} true bila target ditemukan
   */
  function scrollToHash(hash, opt) {
    const target = targetOf(hash);
    if (!target) return false;
    const top = target.getBoundingClientRect().top + window.scrollY;
    const section = target.closest('.page-section');
    if (section && SL.thread && SL.thread.setScene) {
      const index = ['beranda', 'arsip', 'playground', 'dampak', 'kredit'].indexOf(section.id);
      if (index !== -1) SL.thread.setScene(index);
    }
    SL.smooth.scrollTo(top, opt);
    focusSection(target);
    return true;
  }

  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    // Skip link dibiarkan pada perilaku bawaan: ia memindahkan fokus ke <main>.
    if (!a || a.classList.contains('skip-link') || a.hasAttribute('download')) return;
    if (a.target && a.target.toLowerCase() !== '_self') return;
    if (!targetOf(a.hash)) return;
    e.preventDefault();
    if (a.hash !== location.hash) history.pushState({ hash: a.hash }, '', a.hash);
    scrollToHash(a.hash);
  }

  function onPopState() {
    if (!scrollToHash(location.hash || '#beranda')) SL.smooth.scrollTo(0, { smooth: false });
  }

  /** Muat awal dengan #hash: tunggu pin ScrollTrigger terpasang agar posisinya benar. */
  function onLoad() {
    if (location.hash) scrollToHash(location.hash, { smooth: false });
  }

  /**
   * @param {string} hash mis. "#playground"
   */
  function go(hash) {
    if (!enabled) {
      location.hash = hash;
      return;
    }
    if (!targetOf(hash)) return;
    if (hash !== location.hash) history.pushState({ hash: hash }, '', hash);
    scrollToHash(hash);
  }

  function init() {
    if (enabled || location.protocol === 'file:' || !('pushState' in history)) return;
    enabled = true;
    SL.router.enabled = true;
    restoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    bin.add(SL.on(document, 'click', onClick));
    bin.add(SL.on(window, 'popstate', onPopState));
    if (document.readyState === 'complete') onLoad();
    else bin.add(SL.on(window, 'load', onLoad));
  }

  function destroy() {
    bin.flush();
    if (enabled) history.scrollRestoration = restoration;
    enabled = false;
    SL.router.enabled = false;
  }

  SL.router = { init: init, destroy: destroy, go: go, enabled: false };
})(window.SL = window.SL || {});
