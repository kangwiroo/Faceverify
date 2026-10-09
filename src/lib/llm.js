// Gateway LLM round-robin untuk Nemotron Ultra (atau model OpenAI-compatible apa pun).
//
// Key dibaca dari env.LLM_API_KEYS (dipisah koma) — DISIMPAN SEBAGAI SECRET,
// tidak pernah di Git. Hanya LLM_ACTIVE_KEYS pertama yang dipakai bergiliran,
// sisanya cadangan. Dipakai SEMINIMAL mungkin (hanya penjadwalan).

let rrIndex = 0; // penghitung round-robin per-isolate

function keyPool(env) {
  const all = (env.LLM_API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean);
  const active = Math.max(1, parseInt(env.LLM_ACTIVE_KEYS || '20', 10));
  return all.slice(0, active);
}

export function llmConfigured(env) {
  return keyPool(env).length > 0 && Boolean(env.LLM_BASE_URL);
}

// Panggil chat completion. Memilih key bergiliran, gagal -> coba key berikutnya.
export async function chat(env, messages, { temperature = 0.2, maxTokens = 800, json = false } = {}) {
  const keys = keyPool(env);
  if (!keys.length) throw new Error('LLM belum dikonfigurasi (LLM_API_KEYS kosong)');

  const body = {
    model: env.LLM_MODEL || 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  };

  let lastErr;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[rrIndex % keys.length];
    rrIndex = (rrIndex + 1) % keys.length;
    try {
      const res = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) { lastErr = new Error(`LLM ${res.status}`); continue; }
      if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    } catch (err) { lastErr = err; }
  }
  throw lastErr || new Error('Semua key LLM gagal');
}
