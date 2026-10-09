// Pembungkus tipis untuk D1.
export const all = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).all().then((r) => r.results || []);
export const first = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).first();
export const run = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).run();

// Peran dan halaman yang boleh diaksesnya.
export const ROLES = {
  master_admin: ['dashboard', 'kasir', 'finance', 'socmed', 'event', 'member', 'schedule', 'hrd', 'prestasi', 'admin'],
  kasir: ['dashboard', 'kasir', 'member', 'event'],
  finance: ['dashboard', 'finance', 'event'],
  socmed: ['dashboard', 'socmed', 'event'],
  hrd: ['dashboard', 'hrd', 'schedule', 'prestasi'],
  staff: ['dashboard', 'schedule', 'prestasi'],
};

export const can = (role, page) => (ROLES[role] || []).includes(page);
