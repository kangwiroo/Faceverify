// Pembungkus tipis untuk D1.
export const all = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).all().then((r) => r.results || []);
export const first = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).first();
export const run = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).run();

// Peran dan halaman yang boleh diaksesnya.
export const ROLES = {
  master_admin: ['dashboard', 'kasir', 'finance', 'socmed', 'event', 'member', 'schedule', 'hrd', 'prestasi', 'docs', 'admin'],
  kasir: ['dashboard', 'kasir', 'member', 'event', 'docs'],
  finance: ['dashboard', 'finance', 'event', 'docs'],
  socmed: ['dashboard', 'socmed', 'event', 'docs'],
  hrd: ['dashboard', 'hrd', 'schedule', 'prestasi', 'docs'],
  staff: ['dashboard', 'schedule', 'prestasi', 'docs'],
};

export const can = (role, page) => (ROLES[role] || []).includes(page);
