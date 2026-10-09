'use strict';

/*
 * verify-session.js — logika sesi & tantangan acak (server-side).
 *
 * Membangun di atas verify-core.js. Semua fungsi inti murni dan bisa diuji
 * tanpa kamera. Inti keamanannya: server mengacak URUTAN WARNA kilasan tiap
 * sesi, lalu memeriksa bahwa jawaban klien memakai urutan itu. Rekaman lama
 * (replay) memakai urutan berbeda sehingga ditolak.
 */

(function (root, factory) {
  const core = (typeof require === 'function') ? require('./verify-core.js') : root.VerifyCore;
  const api = factory(core);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VerifySession = api;
})(typeof self !== 'undefined' ? self : this, function (core) {

  const DEFAULT_PALETTE = ['#00aeef', '#ec008c', '#fff200', '#ff3b3b', '#2ee66b', '#5b5bff'];
  const DEFAULT_ACTIONS = ['tengah', 'kedip', 'toleh kiri', 'toleh kanan', 'senyum'];

  // Acak urutan (Fisher–Yates). rng() mengembalikan [0,1); bisa disuntik untuk uji.
  function shuffle(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Buat tantangan acak: urutan warna kilasan + urutan aksi untuk sesi ini.
  function randomChallenge({ rng = Math.random, palette = DEFAULT_PALETTE,
                             actions = DEFAULT_ACTIONS, actionCount = 2 } = {}) {
    return {
      flashOrder: shuffle(palette, rng),
      actions: shuffle(actions, rng).slice(0, actionCount),
    };
  }

  // Periksa jawaban kilasan terhadap urutan yang dikeluarkan server.
  // samples: [{ color: [r,g,b], delta: [dr,dg,db] }, ...] searah urutan jawaban.
  // orderMatched = true hanya jika warna jawaban sama persis dan seurutan.
  function scoreChallenge(issuedFlashOrder, samples, { hexToRgb = core.hexToRgb } = {}) {
    const expected = issuedFlashOrder.map(hexToRgb);
    const orderMatched = samples.length === expected.length &&
      expected.every((c, i) => samples[i] && c.every((v, k) => v === samples[i].color[k]));
    return { orderMatched, score: core.flashScore(samples) };
  }

  // Satu upaya verifikasi, murni. Menggabungkan jarak wajah, kedipan,
  // dan urutan+kekuatan kilasan menjadi satu keputusan.
  function verifyAttempt({ reference, descriptors, blinked, flashSamples, issuedFlashOrder },
                         { threshold = 0.5, requireBlink = true, requireFlash = true,
                           flashMin = 0.15 } = {}) {
    if (!descriptors || !descriptors.length) {
      return { ok: false, reason: 'no-face', similarity: 0 };
    }
    const distance = descriptors
      .map((d) => core.euclideanDistance(reference, d))
      .reduce((a, b) => a + b, 0) / descriptors.length;

    const flash = scoreChallenge(issuedFlashOrder, flashSamples || []);

    // Urutan kilasan tidak cocok = kemungkinan rekaman ulang.
    if (requireFlash && !flash.orderMatched) {
      return { ok: false, reason: 'replay', similarity: Math.max(0, 1 - distance), distance };
    }

    const verdict = core.decide({
      distance, threshold,
      blinked: Boolean(blinked), requireBlink,
      flash: flash.score, requireFlash, flashMin,
    });
    return { ...verdict, distance, flashScore: flash.score };
  }

  // Penyimpanan referensi per pengguna (in-memory; untuk produksi ganti DB).
  class UserStore {
    constructor() { this.refs = new Map(); }
    enroll(userId, descriptors) {
      if (!descriptors || !descriptors.length) throw new Error('descriptor kosong');
      this.refs.set(userId, core.meanDescriptor(descriptors));
      return this.refs.get(userId);
    }
    reference(userId) { return this.refs.get(userId) || null; }
    has(userId) { return this.refs.has(userId); }
  }

  // Penyimpanan sesi tantangan dengan kedaluwarsa & batas percobaan.
  // now() dan idGen() bisa disuntik agar deterministik saat diuji.
  class SessionStore {
    constructor({ now = () => Date.now(), idGen, ttlMs = 60000, maxAttempts = 3 } = {}) {
      this.now = now;
      this.ttlMs = ttlMs;
      this.maxAttempts = maxAttempts;
      let n = 0;
      this.idGen = idGen || (() => `s${++n}`);
      this.sessions = new Map();
    }
    create(userId, challenge) {
      const id = this.idGen();
      this.sessions.set(id, { id, userId, challenge, createdAt: this.now(), attempts: 0 });
      return id;
    }
    // Kembalikan { session } atau { error: 'unknown' | 'expired' | 'locked' }.
    claim(id) {
      const s = this.sessions.get(id);
      if (!s) return { error: 'unknown' };
      if (this.now() - s.createdAt > this.ttlMs) { this.sessions.delete(id); return { error: 'expired' }; }
      if (s.attempts >= this.maxAttempts) return { error: 'locked' };
      s.attempts += 1;
      return { session: s };
    }
    get(id) { return this.sessions.get(id) || null; }
  }

  return {
    DEFAULT_PALETTE,
    DEFAULT_ACTIONS,
    shuffle,
    randomChallenge,
    scoreChallenge,
    verifyAttempt,
    UserStore,
    SessionStore,
  };
});
