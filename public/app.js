// JS klien minimal. Sebagian besar halaman di-render server (hemat & cepat).
// Tempat untuk peningkatan: pencarian tabel, konfirmasi, grafik ringkas.
'use strict';
document.addEventListener('submit', (e) => {
  const btn = e.target.querySelector('button[type=submit], .btn.primary');
  if (btn) { btn.disabled = true; setTimeout(() => (btn.disabled = false), 4000); }
});
