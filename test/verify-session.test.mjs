// Uji logika sesi & tantangan acak. Tanpa kamera, tanpa jaringan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const S = require('../verify-session.js');
const core = require('../verify-core.js');

// RNG deterministik untuk uji (urutan angka tetap).
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const ref = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.1);
const genuine = ref.map((v) => v + 0.01);          // jarak kecil -> wajah sama
const impostor = ref.map((v, i) => v + (i % 2 ? 0.1 : -0.1)); // jarak besar -> beda

// Bangun sampel kilasan yang "hidup" (delta searah warna) untuk urutan tertentu.
const liveSamples = (order) => order.map((hex) => {
  const c = core.hexToRgb(hex);
  return { color: c, delta: c.map((v) => (v - 128) * 0.1) };
});

/* ---------- shuffle & tantangan ---------- */

test('shuffle: hasil permutasi (isi sama, tak ada yang hilang)', () => {
  const a = [1, 2, 3, 4, 5];
  const b = S.shuffle(a, seeded(7));
  assert.deepEqual([...b].sort(), [...a].sort());
});

test('shuffle: deterministik dengan rng yang sama', () => {
  assert.deepEqual(S.shuffle([1, 2, 3, 4], seeded(42)), S.shuffle([1, 2, 3, 4], seeded(42)));
});

test('randomChallenge: flashOrder memuat seluruh palet, teracak', () => {
  const c = S.randomChallenge({ rng: seeded(1) });
  assert.deepEqual([...c.flashOrder].sort(), [...S.DEFAULT_PALETTE].sort());
  assert.equal(c.actions.length, 2);
});

/* ---------- scoreChallenge ---------- */

test('scoreChallenge: urutan benar + wajah hidup -> cocok & skor tinggi', () => {
  const order = S.DEFAULT_PALETTE;
  const r = S.scoreChallenge(order, liveSamples(order));
  assert.equal(r.orderMatched, true);
  assert.ok(r.score > 0.5);
});

test('scoreChallenge: urutan terbalik (replay) -> tidak cocok', () => {
  const order = S.DEFAULT_PALETTE;
  const replay = liveSamples([...order].reverse()); // warna datang dengan urutan lain
  assert.equal(S.scoreChallenge(order, replay).orderMatched, false);
});

/* ---------- verifyAttempt ---------- */

const order = S.DEFAULT_PALETTE;

test('verifyAttempt: wajah sama + kedip + kilasan benar -> lolos', () => {
  const r = S.verifyAttempt({ reference: ref, descriptors: [genuine], blinked: true,
    flashSamples: liveSamples(order), issuedFlashOrder: order });
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'ok');
});

test('verifyAttempt: wajah beda -> gagal no-match', () => {
  const r = S.verifyAttempt({ reference: ref, descriptors: [impostor], blinked: true,
    flashSamples: liveSamples(order), issuedFlashOrder: order });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-match');
});

test('verifyAttempt: tidak berkedip -> gagal no-blink', () => {
  const r = S.verifyAttempt({ reference: ref, descriptors: [genuine], blinked: false,
    flashSamples: liveSamples(order), issuedFlashOrder: order });
  assert.equal(r.reason, 'no-blink');
});

test('verifyAttempt: urutan kilasan salah (replay) -> gagal replay', () => {
  const r = S.verifyAttempt({ reference: ref, descriptors: [genuine], blinked: true,
    flashSamples: liveSamples([...order].reverse()), issuedFlashOrder: order });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'replay');
});

test('verifyAttempt: tanpa wajah -> no-face', () => {
  const r = S.verifyAttempt({ reference: ref, descriptors: [], blinked: true,
    flashSamples: [], issuedFlashOrder: order });
  assert.equal(r.reason, 'no-face');
});

/* ---------- UserStore ---------- */

test('UserStore: enroll menyimpan rata-rata descriptor', () => {
  const u = new S.UserStore();
  u.enroll('a', [[0, 10], [2, 30]]);
  assert.deepEqual(u.reference('a'), [1, 20]);
  assert.equal(u.has('a'), true);
  assert.equal(u.reference('x'), null);
});

/* ---------- SessionStore ---------- */

test('SessionStore: kedaluwarsa setelah ttl', () => {
  let t = 1000;
  const store = new S.SessionStore({ now: () => t, ttlMs: 500 });
  const id = store.create('a', {});
  t = 1400; assert.ok(store.claim(id).session);  // masih hidup
  t = 1700; assert.equal(store.claim(id).error, 'expired');
});

test('SessionStore: terkunci setelah batas percobaan', () => {
  const store = new S.SessionStore({ now: () => 0, ttlMs: 10000, maxAttempts: 2 });
  const id = store.create('a', {});
  assert.ok(store.claim(id).session); // 1
  assert.ok(store.claim(id).session); // 2
  assert.equal(store.claim(id).error, 'locked'); // 3
});

test('SessionStore: id tak dikenal', () => {
  const store = new S.SessionStore();
  assert.equal(store.claim('xxx').error, 'unknown');
});
