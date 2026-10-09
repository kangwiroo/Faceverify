'use strict';

/* ===== Tema gelap/terang ===== */
(function () {
  const root = document.documentElement;
  const btn = document.getElementById('themeBtn');
  const sync = () => {
    const dark = (root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    const moon = btn && btn.querySelector('.i-moon'), sun = btn && btn.querySelector('.i-sun');
    if (moon && sun) { moon.style.display = dark ? 'none' : ''; sun.style.display = dark ? '' : 'none'; }
  };
  if (btn) btn.addEventListener('click', () => {
    const cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('fnh.theme', next); } catch (e) {}
    sync();
  });
  sync();
})();

/* ===== Nama file terpilih di unggah dokumen ===== */
document.addEventListener('change', (e) => {
  if (e.target.matches('input[type=file]')) {
    const f = e.target.files[0];
    const lbl = e.target.closest('.dropzone')?.querySelector('.dz-name');
    if (lbl) lbl.textContent = f ? `${f.name} · ${(f.size / 1024).toFixed(0)} KB` : 'Pilih atau jatuhkan berkas';
  }
});

/* ===== Cegah klik ganda submit ===== */
document.addEventListener('submit', (e) => {
  const btn = e.target.querySelector('button[type=submit], .btn.accent, .btn.primary');
  if (btn) { btn.disabled = true; setTimeout(() => (btn.disabled = false), 5000); }
});
