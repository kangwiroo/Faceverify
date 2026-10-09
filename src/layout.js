import { ROLES, can } from './lib/db.js';

export const NAV = [
  ['dashboard', 'Dashboard', 'M3 12l9-8 9 8M5 10v10h14V10'],
  ['kasir', 'Kasir', 'M4 7h16v10H4z M8 7v10'],
  ['finance', 'Finance', 'M4 19V5m4 14V9m4 10V7m4 12v-6m4 6V11'],
  ['socmed', 'Social Media', 'M12 8a4 4 0 100 8 4 4 0 000-8z M20 12h2M2 12h2'],
  ['event', 'Event', 'M4 6h16v14H4z M8 3v4M16 3v4M4 10h16'],
  ['member', 'Member', 'M16 14a4 4 0 10-8 0 M12 7a3 3 0 100 6 3 3 0 000-6z'],
  ['schedule', 'Penjadwalan', 'M4 6h16v14H4z M8 3v4M16 3v4M9 14h6'],
  ['hrd', 'HRD', 'M12 7a3 3 0 100 6 3 3 0 000-6z M6 20a6 6 0 1112 0'],
  ['prestasi', 'Prestasi & Absen', 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z'],
  ['admin', 'Master Admin', 'M12 3l8 4v5c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7z'],
];

export function layout({ user, active, title, body }) {
  const items = NAV.filter(([page]) => can(user.role, page)).map(([page, label, d]) => `
    <a href="/${page}" class="nav-item ${page === active ? 'active' : ''}">
      <svg viewBox="0 0 24 24"><path d="${d}"/></svg><span>${label}</span>
    </a>`).join('');

  return `<!doctype html><html lang="id"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · FiftyNineHub</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%236d28d9'/%3E%3Ctext x='16' y='22' font-size='15' fill='white' text-anchor='middle' font-family='sans-serif' font-weight='bold'%3E59%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="/app.css"></head>
<body>
<div class="shell">
  <aside class="sidebar">
    <div class="brand"><span class="logo">59</span><div><strong>FiftyNineHub</strong><small>Venue Management</small></div></div>
    <nav>${items}</nav>
    <div class="side-foot">
      <div class="who"><strong>${user.name}</strong><small>${user.role}</small></div>
      <form method="post" action="/logout"><button class="btn ghost sm">Keluar</button></form>
    </div>
  </aside>
  <main class="content">
    <header class="topbar"><h1>${title}</h1></header>
    <div class="page">${body}</div>
  </main>
</div>
<script src="/app.js"></script>
</body></html>`;
}

export function loginPage(error = '') {
  return `<!doctype html><html lang="id"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Masuk · FiftyNineHub</title><link rel="stylesheet" href="/app.css"></head>
<body class="login-body">
<form class="login-card" method="post" action="/login">
  <div class="brand center"><span class="logo lg">59</span><strong>FiftyNineHub</strong></div>
  <p class="muted center">Sistem manajemen venue</p>
  ${error ? `<p class="err">${error}</p>` : ''}
  <label>Email<input name="email" type="email" value="admin@fiftynine.id" required></label>
  <label>Kata sandi<input name="password" type="password" value="admin123" required></label>
  <button class="btn primary">Masuk</button>
  <p class="hint">Demo: admin@fiftynine.id / admin123</p>
</form></body></html>`;
}
