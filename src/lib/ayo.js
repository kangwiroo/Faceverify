// Konektor Ayo Indonesia — SUMBER KEBENARAN untuk booking & transaksi.
//
// Hemat D1/R2: data Ayo TIDAK diduplikasi ke D1. Diambil on-demand dan
// di-cache di Cloudflare Cache API (edge, gratis) dengan TTL pendek.
//
// CATATAN: endpoint & bentuk respons di bawah adalah placeholder. Ganti
// dengan API Ayo resmi milikmu saat menyempurnakan di lokal. Token diambil
// dari secret env.AYO_TOKEN (tidak pernah di Git).

export function ayoConfigured(env) {
  return Boolean(env.AYO_BASE_URL && env.AYO_TOKEN);
}

// GET ke Ayo dengan cache edge (default 60 detik).
async function ayoGet(env, path, { ttl = 60 } = {}) {
  if (!ayoConfigured(env)) throw new Error('Ayo belum dikonfigurasi (AYO_BASE_URL / AYO_TOKEN)');
  const url = `${env.AYO_BASE_URL.replace(/\/$/, '')}${path}`;
  const cacheKey = new Request(url, { headers: { 'x-fnh-cache': '1' } });
  const cache = caches.default;

  const hit = await cache.match(cacheKey);
  if (hit) return hit.json();

  const res = await fetch(url, { headers: { authorization: `Bearer ${env.AYO_TOKEN}`, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Ayo ${res.status}`);
  const data = await res.json();

  // simpan ke cache edge
  const cached = new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttl}` } });
  await cache.put(cacheKey, cached);
  return data;
}

// Pembungkus berorientasi domain. Sesuaikan path dengan API Ayo resmi.
export const ayo = {
  bookings: (env, { date } = {}) => ayoGet(env, `/v1/bookings${date ? `?date=${date}` : ''}`, { ttl: 60 }),
  transactions: (env, { from, to } = {}) => ayoGet(env, `/v1/transactions?from=${from || ''}&to=${to || ''}`, { ttl: 120 }),
  members: (env) => ayoGet(env, `/v1/members`, { ttl: 300 }),
  venues: (env) => ayoGet(env, `/v1/venues`, { ttl: 600 }),
};
