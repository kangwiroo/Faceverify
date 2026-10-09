// Uji integrasi server: enroll -> challenge -> verify, lewat HTTP sungguhan.
// Tanpa kamera: descriptor dibuat dari angka. Tanpa jaringan luar: localhost.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { server } = require('../server/server.js');
const core = require('../verify-core.js');

let base;
before(async () => {
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const post = async (path, body) => {
  const res = await fetch(base + path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const ref = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.1);
const genuine = ref.map((v) => v + 0.01);
const impostor = ref.map((v, i) => v + (i % 2 ? 0.1 : -0.1));
const liveSamples = (order) => order.map((hex) => {
  const c = core.hexToRgb(hex);
  return { color: c, delta: c.map((v) => (v - 128) * 0.1) };
});

test('alur lengkap: enroll, challenge, verifikasi wajah asli -> lolos', async () => {
  assert.equal((await post('/api/enroll', { userId: 'budi', descriptors: [ref] })).body.ok, true);
  const ch = (await post('/api/challenge', { userId: 'budi' })).body;
  assert.equal(ch.flashOrder.length, 6);
  const v = await post('/api/verify', {
    challengeId: ch.challengeId, descriptors: [genuine], blinked: true,
    flashSamples: liveSamples(ch.flashOrder),
  });
  assert.equal(v.body.ok, true);
  assert.equal(v.body.reason, 'ok');
});

test('wajah orang lain -> ditolak', async () => {
  await post('/api/enroll', { userId: 'budi', descriptors: [ref] });
  const ch = (await post('/api/challenge', { userId: 'budi' })).body;
  const v = await post('/api/verify', {
    challengeId: ch.challengeId, descriptors: [impostor], blinked: true,
    flashSamples: liveSamples(ch.flashOrder),
  });
  assert.equal(v.body.ok, false);
  assert.equal(v.body.reason, 'no-match');
});

test('replay dengan urutan warna lama -> ditolak', async () => {
  await post('/api/enroll', { userId: 'budi', descriptors: [ref] });
  const ch = (await post('/api/challenge', { userId: 'budi' })).body;
  // Penyerang mengirim rekaman dengan urutan warna yang bukan urutan sesi ini.
  const v = await post('/api/verify', {
    challengeId: ch.challengeId, descriptors: [genuine], blinked: true,
    flashSamples: liveSamples([...ch.flashOrder].reverse()),
  });
  assert.equal(v.body.ok, false);
  assert.equal(v.body.reason, 'replay');
});

test('referensi tidak pernah dikirim ke klien', async () => {
  await post('/api/enroll', { userId: 'budi', descriptors: [ref] });
  const ch = (await post('/api/challenge', { userId: 'budi' }));
  assert.equal(JSON.stringify(ch.body).includes('reference'), false);
  assert.equal(ch.body.descriptor, undefined);
});

test('challenge untuk user tak terdaftar -> 404', async () => {
  const r = await post('/api/challenge', { userId: 'tidak-ada' });
  assert.equal(r.status, 404);
});

test('descriptor tidak valid saat enroll -> 400', async () => {
  const r = await post('/api/enroll', { userId: 'x', descriptors: [[1, 2, 3]] });
  assert.equal(r.status, 400);
});

test('batas percobaan: sesi terkunci setelah 3 upaya', async () => {
  await post('/api/enroll', { userId: 'budi', descriptors: [ref] });
  const ch = (await post('/api/challenge', { userId: 'budi' })).body;
  const attempt = () => post('/api/verify', {
    challengeId: ch.challengeId, descriptors: [impostor], blinked: true,
    flashSamples: liveSamples(ch.flashOrder),
  });
  await attempt(); await attempt(); await attempt();
  const locked = await attempt();
  assert.equal(locked.status, 409);
  assert.equal(locked.body.reason, 'locked');
});
