'use strict';

/*
 * api.js — klien untuk server verifikasi (opsional).
 *
 * Mode server aktif jika alamatnya diset lewat salah satu:
 *   - window.FACEVERIFY_SERVER = 'http://localhost:8787'
 *   - localStorage['faceverify.server'] = 'http://localhost:8787'
 *
 * Jika tidak diset, aplikasi berjalan sepenuhnya di browser (mode lokal),
 * sehingga tetap bisa dipasang sebagai situs statis (mis. GitHub Pages).
 */

window.FaceVerifyAPI = (function () {
  function baseUrl() {
    let u = window.FACEVERIFY_SERVER;
    if (!u) { try { u = localStorage.getItem('faceverify.server'); } catch { /* abaikan */ } }
    return u ? u.replace(/\/$/, '') : null;
  }

  function userId() {
    let id;
    try {
      id = localStorage.getItem('faceverify.userId');
      if (!id) {
        id = 'u-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random());
        localStorage.setItem('faceverify.userId', id);
      }
    } catch { id = 'u-sementara'; }
    return id;
  }

  async function post(path, body) {
    const res = await fetch(baseUrl() + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { data, status: res.status });
    return data;
  }

  const toArray = (d) => Array.from(d).map(Number);

  return {
    enabled: () => Boolean(baseUrl()),
    userId,
    enroll: (descriptors) => post('/api/enroll', { userId: userId(), descriptors: descriptors.map(toArray) }),
    challenge: () => post('/api/challenge', { userId: userId() }),
    verify: (payload) => post('/api/verify', payload),
  };
})();
