// Token gerak bersama untuk modul animasi dan navigasi anchor.
(function (SL) {
  'use strict';

  SL.motion = {
    /** Masuk: cepat di awal, mendarat halus. Transisi: simetris. */
    ease: {
      enter: 'power3.out',
      enterStrong: 'expo.out',
      transition: 'power2.inOut',
      linear: 'none'
    },

    /** Detik. Dipakai timeline non-scrub (hover, micro-interaction, boot). */
    dur: {
      micro: 0.25,
      base: 0.6,
      reveal: 0.9,
      long: 1.2
    },

    stagger: {
      word: 0.06,
      line: 0.1,
      item: 0.08
    },

    /**
     * Kelambatan scrub (detik) antara posisi gulir dan animasi.
     * Nilai kecil menjaga respons saat gulir native berubah cepat.
     */
    scrub: {
      tight: 0.6,
      soft: 1
    },

    /** Posisi ScrollTrigger bersama: kapan elemen mulai dan selesai tersingkap. */
    trigger: {
      revealStart: 'top 88%',
      revealEnd: 'clamp(top 55%)',
      blendStart: 'top bottom',
      blendEnd: 'clamp(top 35%)'
    },

    /** Tombol magnetis: seberapa jauh tombol mengikuti kursor (rasio jarak). */
    magnet: {
      strength: 0.3,
      dur: 0.5
    }
  };
})(window.SL = window.SL || {});
