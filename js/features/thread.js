/** Benang persisten: lima section berbagi rentang progres yang sama besar. */
(function (SL) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SECTIONS = ['beranda', 'arsip', 'playground', 'dampak', 'kredit'];
  const BAND = 60;
  let layer = null;
  let svg = null;
  let fibers = null;
  let shuttle = null;
  let completeLabel = null;
  let digits = [];
  let sections = [];
  let bounds = [];
  let disposers = null;
  let height = 0;
  let maxScroll = 0;
  let currentIndex = 0;
  let progress = 0;
  let complete = false;
  let fallbackReady = false;
  let raf = 0;
  let resizeTimer = 0;
  let fallbackTimer = 0;
  let jump = null;
  let generation = 0;

  function node(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    return el;
  }

  function clamp(value) { return Math.max(0, Math.min(1, value)); }

  function fiberPath(cx, amplitude, phase) {
    const points = [];
    for (let y = 0; y <= height + 6; y += 6) {
      const x = cx + amplitude * Math.sin(y / 46 * Math.PI * 2 + phase);
      points.push(x.toFixed(1) + ' ' + y);
    }
    return 'M' + points.join(' L');
  }

  function refreshBits() {
    const bits = SL.storage.readBits();
    digits.forEach(function (digit, i) {
      const bit = bits[i % bits.length] === 1 ? 1 : 0;
      digit.el.textContent = String(bit);
      digit.el.classList.toggle('thread__digit--one', bit === 1);
    });
  }

  function build() {
    const width = layer.clientWidth;
    height = layer.clientHeight;
    if (!width || !height) return;
    const cx = width / 2;
    const amplitude = layer.classList.contains('is-wide') ? Math.min(width * 0.04, 12) : Math.min(width * 0.12, 5);
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    fibers = node('g', { class: 'thread__fibers' });
    for (let i = 0; i < 3; i++) {
      fibers.appendChild(node('path', {
        class: 'thread__fiber thread__fiber--' + (i === 2 ? 'brass' : 'red'),
        d: fiberPath(cx, amplitude, i * Math.PI * 2 / 3)
      }));
    }
    const parts = [fibers];
    digits = [];
    const count = SL.isMobile() ? 24 : 56;
    for (let i = 0; i < count; i++) {
      const y = height / count * (i + 0.5);
      const el = node('text', { class: 'thread__digit', x: cx, y: y + 4 });
      digits.push({ el: el, y: y, opacity: '' });
      parts.push(el);
    }
    shuttle = node('circle', { class: 'thread__shuttle', cx: cx, cy: 0, r: SL.isMobile() ? 4 : 5 });
    parts.push(shuttle);
    svg.replaceChildren.apply(svg, parts);
    refreshBits();
    render();
  }

  function documentTop(el) {
    let top = 0;
    for (let parent = el; parent; parent = parent.offsetParent) top += parent.offsetTop;
    return top;
  }

  function measure() {
    if (!layer) return;
    bounds = sections.map(documentTop);
    maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    schedule();
  }

  function scrollProgress() {
    const y = Math.max(0, window.scrollY);
    if (!maxScroll) {
      currentIndex = fallbackReady ? 4 : 0;
      return fallbackReady ? 1 : 0;
    }
    currentIndex = 0;
    for (let i = 1; i < bounds.length; i++) {
      if (y >= bounds[i]) currentIndex = i;
    }
    if (y >= maxScroll - 1) {
      currentIndex = 4;
      return 1;
    }
    const start = bounds[currentIndex] || 0;
    const end = currentIndex === 4 ? maxScroll : bounds[currentIndex + 1];
    const local = end > start ? clamp((y - start) / (end - start)) : 0;
    return (currentIndex + local) / 5;
  }

  function updatePage() {
    const page = currentIndex === 0 ? 'home' : SECTIONS[currentIndex];
    layer.dataset.page = page;
    const hero = document.querySelector('.boot');
    const wide = currentIndex === 0 && !SL.isMobile() && hero && window.scrollY < hero.offsetHeight * 0.6;
    if (Boolean(wide) !== layer.classList.contains('is-wide')) {
      layer.classList.toggle('is-wide', Boolean(wide));
      build();
    }
  }

  function render() {
    if (!svg) return;
    const remaining = 1 - progress;
    if (remaining <= 0.04) complete = true;
    else if (complete && remaining > 0.08) complete = false;
    layer.classList.toggle('is-complete', complete);
    const front = remaining <= 0.04 ? 0 : 0.85 * height * remaining;
    svg.style.setProperty('--front', front + 'px');
    shuttle.style.transform = 'translateY(' + (remaining <= 0.04 ? -12 : front) + 'px)';
    digits.forEach(function (digit) {
      const t = front === 0 ? 1 : clamp((digit.y - front + BAND) / (BAND * 2));
      const opacity = (t * t * (3 - 2 * t)).toFixed(2);
      if (opacity !== digit.opacity) {
        digit.el.setAttribute('opacity', opacity);
        digit.opacity = opacity;
      }
    });
  }

  function tick(time) {
    raf = 0;
    if (!layer) return;
    const target = scrollProgress();
    if (jump && !SL.prefersReducedMotion()) {
      const elapsed = clamp((time - jump.start) / 600);
      const eased = elapsed * elapsed * (3 - 2 * elapsed);
      progress = jump.from + (target - jump.from) * eased;
      if (elapsed === 1) jump = null;
    } else {
      jump = null;
      progress = target;
    }
    updatePage();
    render();
    if (jump) schedule();
  }

  function schedule() {
    if (layer && !raf) raf = requestAnimationFrame(tick);
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = 0;
      if (!layer) return;
      build();
      measure();
    }, 150);
  }

  function onTransitionEnd(event) {
    if (event.target === layer && event.propertyName === 'width') build();
  }

  function onReducedMotion() {
    jump = null;
    schedule();
  }

  function setScene(index) {
    if (!layer || !Number.isInteger(index) || index < 0 || index > 4) return;
    if (!SL.prefersReducedMotion() && (Math.abs(index - currentIndex) > 1 || index < currentIndex)) {
      jump = { from: progress, start: performance.now() };
    }
    schedule();
  }

  function startFallback() {
    if (fallbackTimer || fallbackReady) return;
    fallbackTimer = setTimeout(function () {
      fallbackTimer = 0;
      fallbackReady = true;
      measure();
    }, 1500);
  }

  function init() {
    if (layer) return;
    layer = document.getElementById('thread-layer');
    svg = document.getElementById('thread-svg');
    if (!layer || !svg) { layer = null; svg = null; return; }
    const token = ++generation;
    sections = SECTIONS.map(function (name) { return document.querySelector('.page-section[data-section="' + name + '"]'); });
    if (sections.some(function (section) { return !section; })) { layer = null; svg = null; return; }
    disposers = SL.disposer();
    layer.setAttribute('aria-hidden', 'true');
    completeLabel = document.createElement('span');
    completeLabel.className = 'thread__complete';
    completeLabel.setAttribute('aria-hidden', 'true');
    completeLabel.textContent = 'SELESAI DITENUN';
    layer.appendChild(completeLabel);
    build();
    measure();
    disposers.add(SL.on(window, 'scroll', schedule, { passive: true }));
    disposers.add(SL.on(window, 'sl:layout', onResize));
    disposers.add(SL.on(window, 'sl:motif', refreshBits));
    disposers.add(SL.on(SL.media.reduced, 'change', onReducedMotion));
    disposers.add(SL.on(layer, 'transitionend', onTransitionEnd));
    if (window.ScrollTrigger) {
      window.ScrollTrigger.addEventListener('refresh', measure);
      disposers.add(function () { window.ScrollTrigger.removeEventListener('refresh', measure); });
    }
    if (document.fonts) {
      disposers.add(SL.on(document.fonts, 'loadingdone', measure));
      document.fonts.ready.then(function () { if (generation === token && layer) measure(); });
    }
    if (document.readyState === 'complete') startFallback();
    else disposers.add(SL.on(window, 'load', startFallback, { once: true }));
  }

  function destroy() {
    generation++;
    if (disposers) disposers.flush();
    disposers = null;
    cancelAnimationFrame(raf);
    clearTimeout(resizeTimer);
    clearTimeout(fallbackTimer);
    raf = resizeTimer = fallbackTimer = 0;
    if (svg) { svg.replaceChildren(); svg.style.removeProperty('--front'); }
    if (completeLabel) completeLabel.remove();
    if (layer) {
      layer.classList.remove('is-complete', 'is-wide');
      delete layer.dataset.page;
    }
    layer = svg = fibers = shuttle = completeLabel = null;
    digits = sections = bounds = [];
    height = maxScroll = currentIndex = progress = 0;
    complete = fallbackReady = false;
    jump = null;
  }

  SL.thread = { init: init, setScene: setScene, destroy: destroy };
})(window.SL = window.SL || {});
