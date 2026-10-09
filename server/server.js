'use strict';

/*
 * FaceVerify — server verifikasi (tanpa dependensi, Node bawaan).
 *
 * Keputusan dibuat di SINI, bukan di browser:
 *  - referensi wajah disimpan di server, tidak pernah dikirim ke klien;
 *  - urutan warna kilasan diacak server tiap sesi (crypto) dan diperiksa
 *    saat verifikasi, sehingga rekaman lama (replay) tertolak;
 *  - ada kedaluwarsa sesi dan batas percobaan.
 *
 * Browser tetap mengekstrak descriptor dengan face-api lalu mengirimnya.
 * Catatan: ekstraksi di klien masih bisa dipalsukan oleh penyerang teknis;
 * langkah penguatan berikutnya adalah memindah deteksi wajah ke server.
 *
 * Jalankan:  node server/server.js   (default port 8787)
 */

const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { randomChallenge, verifyAttempt, UserStore, SessionStore } = require('../verify-session.js');

const PORT = process.env.PORT || 8787;

const cryptoRng = () => crypto.randomBytes(4).readUInt32BE(0) / 2 ** 32;
const users = new UserStore();
const sessions = new SessionStore({
  idGen: () => crypto.randomBytes(12).toString('hex'),
  ttlMs: 60000,
  maxAttempts: 3,
});

const send = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(body);
};

function readJson(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) { reject(new Error('payload terlalu besar')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error('json tidak valid')); }
    });
    req.on('error', reject);
  });
}

const isDescriptor = (d) => Array.isArray(d) && d.length === 128 && d.every((x) => typeof x === 'number');

const routes = {
  // Daftarkan wajah referensi. { userId, descriptors: number[128][] }
  'POST /api/enroll': async (req, res, body) => {
    const { userId, descriptors } = body;
    if (!userId || !Array.isArray(descriptors) || !descriptors.every(isDescriptor)) {
      return send(res, 400, { error: 'userId dan descriptors[128] wajib diisi' });
    }
    users.enroll(userId, descriptors);
    send(res, 200, { ok: true, userId });
  },

  // Minta tantangan acak untuk satu sesi verifikasi. { userId }
  'POST /api/challenge': async (req, res, body) => {
    const { userId } = body;
    if (!users.has(userId)) return send(res, 404, { error: 'wajah referensi belum terdaftar' });
    const challenge = randomChallenge({ rng: cryptoRng });
    const challengeId = sessions.create(userId, challenge);
    // Kirim hanya yang perlu dijalankan klien; referensi tetap di server.
    send(res, 200, { challengeId, flashOrder: challenge.flashOrder, actions: challenge.actions });
  },

  // Verifikasi. { challengeId, descriptors, blinked, flashSamples }
  'POST /api/verify': async (req, res, body) => {
    const { challengeId, descriptors, blinked, flashSamples } = body;
    const claim = sessions.claim(challengeId);
    if (claim.error) {
      const msg = { unknown: 'sesi tidak ditemukan', expired: 'sesi kedaluwarsa', locked: 'terlalu banyak percobaan' };
      return send(res, 409, { error: msg[claim.error], reason: claim.error });
    }
    const session = claim.session;
    const reference = users.reference(session.userId);
    const result = verifyAttempt(
      { reference, descriptors, blinked, flashSamples, issuedFlashOrder: session.challenge.flashOrder },
      { threshold: Number(body.threshold) || 0.5, requireBlink: true, requireFlash: true },
    );
    send(res, 200, {
      ok: result.ok,
      reason: result.reason,
      similarity: Number((result.similarity ?? 0).toFixed(4)),
      attemptsLeft: Math.max(0, sessions.maxAttempts - session.attempts),
    });
  },
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });

  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) return send(res, 404, { error: 'rute tidak ditemukan' });

  try {
    const body = await readJson(req);
    await handler(req, res, body);
  } catch (err) {
    send(res, 400, { error: err.message || 'permintaan tidak valid' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`FaceVerify server di http://localhost:${PORT}`));
}

module.exports = { server };
