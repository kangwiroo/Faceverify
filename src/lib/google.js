// Konektor Google Workspace — tempat laporan transaksi & manajerial.
//
// Memakai service account (JWT -> OAuth token) agar transaksi/laporan bisa
// ditulis ke Google Sheets dan Google Docs. Kredensial dari secret
// env.GOOGLE_SA_JSON (JSON service account) — tidak pernah di Git.
//
// Hemat D1: data laporan berat ditulis ke Sheets, bukan D1.

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function googleConfigured(env) {
  return Boolean(env.GOOGLE_SA_JSON);
}

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// Tukar service account JSON -> access token (cache di memori isolate).
let tokenCache = { token: null, exp: 0 };
async function accessToken(env, scope = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/documents') {
  if (!googleConfigured(env)) throw new Error('Google belum dikonfigurasi (GOOGLE_SA_JSON)');
  if (tokenCache.token && Date.now() < tokenCache.exp - 60000) return tokenCache.token;

  const sa = JSON.parse(env.GOOGLE_SA_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })));
  const signingInput = `${header}.${claim}`;

  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput));
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Google token ${res.status}`);
  const data = await res.json();
  tokenCache = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// Tambah baris ke Google Sheet.
export async function appendToSheet(env, spreadsheetId, range, rows) {
  const token = await accessToken(env);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ values: rows }) });
  if (!res.ok) throw new Error(`Sheets append ${res.status}`);
  return res.json();
}
