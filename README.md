# MenenunSejarah: Mesin Biner Pertama

Website kompetisi TECHTOPIA Vol. 2, tema PUSAKA. Tenun Nusantara dibingkai sebagai mesin biner:
pengunjung memahami logika lungsi naik/turun, memprogram motif 12 × 12, lalu menjadikannya piagam
"Penjaga Pusaka" yang berujung ke ajakan mendukung pengrajin.

Spesifikasi: `docs/BRD.md`, `docs/PRD.md`, `docs/SRS.md` (rancangan v1.1 dengan catatan revisi implementasi).
Audit: `docs/AUDIT.md`. Perubahan/pengecualian/QA terbaru: `docs/CHANGES.md`.
Penjelasan modul dan latihan pertanyaan juri: `docs/PANDUAN-KODE.md`.

## Menjalankan

Tidak ada proses build. Buka `index.html` langsung, atau layani folder ini dengan server statis apa pun
(mis. `python -m http.server`). Seluruh situs ada di satu berkas: Beranda, Arsip, Playground, Dampak,
dan Kredit adalah section `#beranda`, `#arsip`, `#playground`, `#dampak`, `#kredit`. Menu menggulir ke
section-nya; tanpa JS tautan yang sama tetap bekerja sebagai anchor biasa.

Di DevTools, `SL.inspect()` mencetak hitungan nyata: listener terdaftar, ScrollTrigger aktif, dan
kartu jejak yang masih ada di DOM.

## Struktur

```
index.html   (satu halaman, lima section)
css/   tokens.css base.css components.css pages.css motion.css
js/    core/ (namespace, config, storage, header, router)
       features/ (boot-sequence, cursor-trail, home-sections, thread, exploded-view, weave-grid, certificate)
       main.js
assets/ fonts/ (woff2 + lisensi OFL)  img/ (10 kartu tekstur SVG)  svg/  data/credits.json
docs/  BRD, PRD, SRS, DECISIONS, RELEASE-BLOCKERS, COPY-ADDITIONS
```

## Daftar periksa kepatuhan (BRD §9, SRS §13)

| Aturan | Status | Cara cek |
|---|---|---|
| Static HTML/CSS/Vanilla JS, ≤ 10 HTML | 1 HTML | `ls *.html` |
| Tanpa React/Vue/Svelte/Angular/Node | Tidak ada `package.json` / `node_modules` | `find . -name package.json` |
| Tanpa UI library, website builder, Tailwind, Bootstrap, jQuery, Three.js | CSS ditulis manual dengan token | `<head>` tiap halaman |
| Tanpa minify/obfuscate | Semua berkas proyek terbaca dan berkomentar | buka berkas |
| Pustaka eksternal hanya GSAP + ScrollTrigger 3.12.5 via CDN | Di-pin, dengan SRI sha384 yang dihitung dari berkas CDN asli | `<script src>` |
| Navigasi `fetch()` + `history.pushState()`, tanpa white flash | **Berubah:** satu halaman, jadi tidak ada `fetch()`. Menu menggulir ke section + `history.pushState()` (Back/Forward tetap jalan), `js/core/router.js`. Perlu dikonfirmasi ke panitia bila aturan ini wajib. | klik menu |
| Cursor Trail dan Grid murni DOM | `cursor-trail.js`, `weave-grid.js` | baca kode |
| State tanpa backend via `localStorage` | skema versi 2 + validasi + fallback RAM | `js/core/storage.js` |
| Mobile-first | basis 320 px, media query `min-width` | `css/*.css` |
| Tanpa proses build / SSG | HTML ditulis langsung | tidak ada konfigurasi bundler |

Catatan: `gsap.min.js` dan `ScrollTrigger.min.js` adalah berkas minified milik pustaka CDN pihak ketiga,
bukan kode proyek (SRS §13.3). Bila panitia ragu, ini yang perlu dikonfirmasi (PRD Q-10).

## Satu halaman

Desain tidak memiliki header. `js/core/header.js` dipertahankan sebagai API kompatibilitas inert.
Lima `.page-section` tetap memiliki hook DOM; router menggulir anchor dan memperbarui history.
Benang memakai progres global lima section dan habis di dasar Kredit (SRS §10.3).

Semua modul berjalan bersamaan (`js/main.js`). Playground mengirim event `sl:motif` setiap kali motif
disimpan, dan piagam di section Dampak memperbarui dirinya tanpa memuat ulang.

## Penyimpangan yang disengaja

Tidak ada file Figma atau `MAIN.jpg` di folder ini, jadi tata letak mengikuti angka di SRS/PRD.
Keputusan yang menyimpang dari dokumen dicatat di `docs/DECISIONS.md`. Ringkasnya:

- Ada satu berkas tambahan, `js/core/config.js` (data tim), dimuat setelah `namespace.js`.
- Ada atribut `<body>` tambahan, `data-footer-tone`, karena nada footer Kredit (void) berbeda dari nada halamannya (paper).
- Ponsel < 480 px: benang disembunyikan di Playground supaya sel grid tetap ≥ 24 px.
- Garis waktu Kredit memakai "JAUH SEBELUM 1804", bukan "≈ ABAD KE-8", karena sumbernya belum ada (PRD Q-08).

## Hasil uji historis (25 Okt 2026, bukan verifikasi refaktor terbaru)

Versi satu halaman: klik kelima menu, Back peramban, buka langsung `index.html#playground`, dan sinkron
Playground → Dampak berjalan; nol galat konsol; tanpa scroll horizontal di 320, 390, 768, dan 1440 px.
Tabel di bawah berasal dari versi lima berkas dan belum diulang.

| Uji | Hasil |
|---|---|
| 5 halaman × 7 lebar (320–1920): horizontal scroll dan galat konsol | nol |
| Lighthouse mobile | Perf 96–100 · A11y 100 · BP 100 · SEO 100 · CLS ≤ 0,017 |
| 20 navigasi SPA | listener kembali ke baseline (16), ScrollTrigger tersisa `thread` saja, nol kartu jejak |
| Kartu jejak | maks 11 aktif saat gerak, 0 setelah 2 detik |
| Keyboard-only di Playground | panah, Spasi/Enter, Ctrl+Z |
| Tanpa JS / CDN diblokir / `localStorage` diblokir / `file://` / reduced-motion | konten terbaca, tanpa galat |
| Ekspor PNG sertifikat | 1520 × 960, font termuat |

Belum diuji: ponsel fisik, Safari/iOS, Firefox.
