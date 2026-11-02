/* Gerak gulir narasi dan peta perjalanan; dipanggil SL.pages.
 * Konteks matchMedia memiliki animasi agar destroy mengembalikan gaya semula. */
(function (SL) {
  'use strict';

  let main = null;
  let mm = null;

  function splitWords(el) {
    if (el.dataset.splitDone) return;
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (word, i) {
      const outer = document.createElement('span');
      const inner = document.createElement('span');
      outer.className = 'word';
      inner.className = 'word__in';
      inner.textContent = word;
      outer.appendChild(inner);
      el.appendChild(outer);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.dataset.splitDone = '1';
  }

  function hero(gsap, M) {
    const boot = main.querySelector('.boot');
    if (!boot) return;
    const st = { id: 'home-hero', trigger: boot, start: 'top top', end: 'bottom top', scrub: M.scrub.tight };
    // [data-reveal] di dalamnya dikendalikan Booting; yang digerakkan hanya wadahnya.
    gsap.timeline({ scrollTrigger: st, defaults: { ease: M.ease.linear } })
      .addLabel('disperse')
      .to(boot.querySelectorAll('.boot__line'), {
        yPercent: function (i) { return -30 - i * 28; },
        xPercent: function (i) { return i % 2 ? 4 : -4; }
      }, 'disperse')
      .to(boot.querySelector('.boot__log'), { yPercent: -120, opacity: 0 }, '<')
      .to(boot.querySelector('.boot__text'), {
        scale: 0.94,
        opacity: 0.15,
        transformOrigin: '50% 0%',
        ease: 'power1.in'
      }, '<0.1');
  }

  /**
   * Pengganti garis pemisah: di setiap pertemuan dua nada, KEDUA section bergeser
   * bersama dari warna atas ke warna bawah, jadi pada titik gulir mana pun
   * keduanya berwarna sama dan tepinya tak pernah terlihat.
   * Tween hanya merender saat aktif (immediateRender: false); akhir satu
   * pertemuan = awal pertemuan berikutnya, jadi tween yang berbagi elemen tidak berebut.
   */
  function toneBlend(gsap, M) {
    const footer = document.querySelector('.site-footer');
    const tones = Array.prototype.slice.call(main.querySelectorAll('[data-tone]'));
    if (footer) tones.push(footer);
    const colors = tones.map(function (el) {
      const cs = getComputedStyle(el);
      return { backgroundColor: cs.backgroundColor, color: cs.color };
    });

    tones.forEach(function (el, i) {
      if (!i || colors[i - 1].backgroundColor === colors[i].backgroundColor) return;
      gsap.fromTo([tones[i - 1], el], colors[i - 1], Object.assign({
        ease: M.ease.linear,
        immediateRender: false,
        scrollTrigger: { id: 'home-tone-' + i, trigger: el, start: M.trigger.blendStart, end: M.trigger.blendEnd, scrub: true }
      }, colors[i]));
    });
  }

  function reveals(gsap, M) {
    main.querySelectorAll('[data-split]').forEach(function (el, index) {
      gsap.from(el.querySelectorAll('.word__in'), {
        yPercent: 115,
        rotation: 6,
        ease: M.ease.enter,
        stagger: M.stagger.word,
        scrollTrigger: { id: 'home-word-' + index, trigger: el, start: M.trigger.revealStart, end: M.trigger.revealEnd, scrub: M.scrub.tight }
      });
    });
    main.querySelectorAll('[data-anim="fade"]').forEach(function (el, index) {
      gsap.from(el, {
        y: 40,
        opacity: 0,
        ease: M.ease.enter,
        scrollTrigger: { id: 'home-fade-' + index, trigger: el, start: M.trigger.revealStart, end: M.trigger.revealEnd, scrub: M.scrub.tight }
      });
    });
  }

  /**
   * Daftar panjang memakai ScrollTrigger.batch: elemen yang masuk layar pada
   * frame yang sama dianimasikan sebagai satu kelompok dengan stagger rapi.
   */
  function lists(gsap, M, ctx) {
    const items = main.querySelectorAll('[data-anim="stagger"] > *');
    if (!items.length) return;
    gsap.set(items, { y: 40, opacity: 0 });
    // Callback batch berjalan setelah setup; daftarkan agar tween tetap dimiliki konteks.
    ctx.add('enter', function (batch) {
      gsap.to(batch, { y: 0, opacity: 1, duration: M.dur.reveal, ease: M.ease.enterStrong, stagger: M.stagger.item, overwrite: true });
    });
    ctx.add('leaveBack', function (batch) {
      gsap.to(batch, { y: 40, opacity: 0, duration: M.dur.base, ease: M.ease.transition, overwrite: true });
    });
    window.ScrollTrigger.batch(items, {
      start: 'top 90%',
      onEnter: ctx.enter,
      onLeaveBack: ctx.leaveBack
    }).forEach(function (trigger, index) {
      trigger.vars.id = 'home-list-' + index;
    });
  }

  /**
   * Bingkai tersingkap dari atas ke bawah lewat clip-path. Sisi kiri/kanan/atas
   * diberi kelonggaran negatif agar siku bingkai dan label SVG tidak terpotong.
   */
  function masks(gsap, M) {
    main.querySelectorAll('[data-anim="mask"]').forEach(function (el, index) {
      gsap.fromTo(el,
        { clipPath: function () { return 'inset(-40px -100% ' + el.offsetHeight + 'px -100%)'; } },
        {
          clipPath: 'inset(-40px -100% -40px -100%)',
          ease: M.ease.transition,
          scrollTrigger: {
            id: 'home-mask-' + index,
            trigger: el,
            start: M.trigger.revealStart,
            end: M.trigger.revealEnd,
            scrub: M.scrub.soft,
            invalidateOnRefresh: true
          }
        });
    });
  }

  function journey(gsap, M) {
    const list = main.querySelector('.journey__list');
    if (!list) return;
    const st = { id: 'home-journey', trigger: list, start: 'top 85%', end: 'clamp(bottom 65%)', scrub: M.scrub.soft };
    gsap.timeline({ scrollTrigger: st })
      .addLabel('lines')
      .from(list.querySelectorAll('.journey__line'), { scaleX: 0, transformOrigin: '0 50%', ease: M.ease.linear, stagger: M.stagger.line }, 'lines')
      .addLabel('items', 'lines+=0.05')
      .from(list.querySelectorAll('.journey__item'), { y: 50, opacity: 0, ease: M.ease.enter, stagger: M.stagger.line }, 'items');

    // Daftar sedikit miring mengikuti kecepatan gulir, lalu kembali tegak.
    // Miringnya di <ol>, bukan di .journey__name yang punya transform hover sendiri.
    const skew = gsap.quickTo(list, 'skewY', { duration: M.dur.base, ease: M.ease.enter });
    window.ScrollTrigger.create({
      id: 'home-journey-skew',
      trigger: list,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: function (self) {
        skew(gsap.utils.clamp(-3, 3, self.getVelocity() / -800));
      },
      onLeave: function () { skew(0); },
      onLeaveBack: function () { skew(0); }
    });
  }

  function depth(gsap, M) {
    main.querySelectorAll('.journey__inner, .kredit__hero, .dampak__empty').forEach(function (el, index) {
      gsap.fromTo(el, { y: 80 }, {
        y: -40,
        ease: M.ease.linear,
        scrollTrigger: { id: 'home-depth-' + index, trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  function progress(gsap, M) {
    const bar = document.getElementById('nav-progress');
    if (!bar) return;
    gsap.to(bar, {
      scaleX: 1,
      ease: M.ease.linear,
      scrollTrigger: { id: 'progress', trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
    });
  }

  /** @param {HTMLElement} root Akar narasi lintas section. */
  function init(root) {
    if (main) return;
    main = root;
    const gsap = window.gsap;
    if (!gsap || !window.ScrollTrigger) return;

    main.querySelectorAll('[data-split]').forEach(splitWords);
    mm = gsap.matchMedia();
    // Reduced-motion: tidak ada yang dipasang; matchMedia mencabut semuanya bila preferensi berubah.
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function (ctx) {
      const M = SL.motion;
      hero(gsap, M);
      toneBlend(gsap, M);
      reveals(gsap, M);
      lists(gsap, M, ctx);
      masks(gsap, M);
      journey(gsap, M);
      depth(gsap, M);
      progress(gsap, M);
    });
  }

  /** Revert seluruh animasi dan trigger milik narasi, termasuk tween dari callback batch. */
  function destroy() {
    if (mm) mm.revert();
    mm = null;
    main = null;
  }

  SL.homeSections = { init: init, destroy: destroy };
})(window.SL = window.SL || {});