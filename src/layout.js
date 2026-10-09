import { can } from './lib/db.js';

// Ikon + aksen warna per divisi (aksen sudah divalidasi colorblind-safe).
export const PAGES = {
  dashboard: { label: 'Dashboard', accent: '#7c5cff', icon: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  kasir:     { label: 'Kasir', accent: '#10b981', icon: 'M4 7h16v10H4zM4 11h16M9 15h3' },
  finance:   { label: 'Finance', accent: '#f59e0b', icon: 'M4 19V5m4 14V9m4 10V7m4 12v-6m4 6V11' },
  socmed:    { label: 'Social Media', accent: '#ec4899', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zM20 12h2M2 12h2M12 2v2M12 20v2' },
  event:     { label: 'Event', accent: '#8b5cf6', icon: 'M4 6h16v14H4zM8 3v4M16 3v4M4 10h16' },
  member:    { label: 'Member', accent: '#06b6d4', icon: 'M16 14a4 4 0 10-8 0M12 7a3 3 0 100 6 3 3 0 000-6z' },
  booking:   { label: 'Jadwal Booking', accent: '#0ea5e9', icon: 'M4 6h16v14H4zM8 3v4M16 3v4M9 14l2 2 4-4' },
  schedule:  { label: 'Penjadwalan', accent: '#3b82f6', icon: 'M4 6h16v14H4zM8 3v4M16 3v4M9 13h6M9 17h4' },
  hrd:       { label: 'HRD', accent: '#14b8a6', icon: 'M12 7a3 3 0 100 6 3 3 0 000-6zM6 20a6 6 0 1112 0' },
  prestasi:  { label: 'Prestasi & Absen', accent: '#f97316', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z' },
  docs:      { label: 'Dokumen', accent: '#f43f5e', icon: 'M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h5' },
  admin:     { label: 'Master Admin', accent: '#64748b', icon: 'M12 3l8 4v5c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7z' },
};

const SECTIONS = [
  ['Operasional', ['dashboard', 'kasir', 'booking', 'event', 'member']],
  ['Keuangan', ['finance']],
  ['Konten', ['socmed']],
  ['SDM', ['hrd', 'schedule', 'prestasi']],
  ['Arsip', ['docs']],
  ['Sistem', ['admin']],
];

// Keterhubungan antar divisi (satu divisi berelasi dengan yang lain).
export const RELATIONS = {
  dashboard: [],
  kasir: ['finance', 'member', 'event'],
  finance: ['kasir', 'event', 'admin'],
  socmed: ['event', 'member'],
  booking: ['kasir', 'event', 'finance', 'schedule'],
  event: ['kasir', 'finance', 'member', 'schedule', 'socmed', 'booking'],
  member: ['kasir', 'event', 'socmed'],
  schedule: ['hrd', 'event', 'prestasi'],
  hrd: ['schedule', 'prestasi'],
  prestasi: ['hrd', 'schedule'],
  docs: ['finance', 'event', 'socmed'],
  admin: ['finance', 'hrd', 'docs'],
};

const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const navIcon = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;

function sidebar(user, active) {
  const secs = SECTIONS.map(([title, pages]) => {
    const items = pages.filter((p) => can(user.role, p)).map((p) => {
      const m = PAGES[p];
      return `<a href="/${p}" class="nav-item ${p === active ? 'active' : ''}" style="--ac:${m.accent}">
        <span class="dot"></span>${navIcon(m.icon)}<span>${m.label}</span></a>`;
    }).join('');
    return items ? `<div class="nav-sec">${title}</div>${items}` : '';
  }).join('');

  return `<aside class="sidebar">
    <div class="brand"><span class="logo">59</span><div><strong>FiftyNineHub</strong><small>Venue Management</small></div></div>
    <nav>${secs}</nav>
    <div class="side-foot">
      <span class="avatar" style="--accent:${PAGES[active]?.accent || '#7c5cff'}">${initials(user.name)}</span>
      <div class="who"><strong>${user.name}</strong><small>${user.role}</small></div>
      <form method="post" action="/logout" style="margin-left:auto"><button class="btn ghost sm">Keluar</button></form>
    </div>
  </aside>`;
}

export function layout({ user, active, title, section = 'FiftyNineHub', body }) {
  const accent = PAGES[active]?.accent || '#7c5cff';
  return `<!doctype html><html lang="id"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} · FiftyNineHub</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%237c5cff'/%3E%3Ctext x='16' y='22' font-size='14' fill='white' text-anchor='middle' font-family='sans-serif' font-weight='bold'%3E59%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/app.css">
<script>try{var t=localStorage.getItem('fnh.theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}</script></head>
<body>
<input type="checkbox" id="drawer" hidden>
<div class="shell">
  ${sidebar(user, active)}
  <div class="content" style="--accent:${accent}">
    <header class="topbar">
      <label for="drawer" class="ic-btn burger"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></label>
      <div class="title"><div class="crumb">${section} › <b>${title}</b></div><h1>${title}</h1></div>
      <div class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input placeholder="Cari…"></div>
      <button class="ic-btn" id="themeBtn" title="Ganti tema" type="button"><svg class="i-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg><svg class="i-sun" viewBox="0 0 24 24" style="display:none"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg></button>
      <button class="ic-btn" title="Notifikasi"><span class="badge"></span><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg></button>
    </header>
    <div class="page">${body}</div>
  </div>
  <label for="drawer" class="scrim"></label>
</div>
<script src="/app.js"></script>
</body></html>`;
}

export function loginPage(error = '') {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'x', 0, '<']
    .map((k) => k === 'x' ? '<span></span>'
      : k === '<' ? `<button type="button" class="key" data-k="back">⌫</button>`
      : `<button type="button" class="key" data-k="${k}">${k}</button>`).join('');
  return `<!doctype html><html lang="id"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Masuk · FiftyNineHub</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/app.css"></head>
<body class="login-body">
<form class="login-card" id="pinForm" method="post" action="/login" autocomplete="off">
  <div class="brand center"><span class="logo lg">59</span><div class="center"><strong>FiftyNineHub</strong><small class="faint">Masuk dengan PIN 8 digit</small></div></div>
  ${error ? `<p class="err center">${error}</p>` : ''}
  <input type="hidden" name="pin" id="pinVal">
  <div class="pin-dots" id="pinDots">${Array.from({ length: 8 }, () => '<i></i>').join('')}</div>
  <div class="keypad">${keys}</div>
  <p class="hint">Demo admin: 1 2 3 4 5 6 7 8</p>
</form>
<script>
(function(){
  var pin='', val=document.getElementById('pinVal'), dots=document.getElementById('pinDots').children, form=document.getElementById('pinForm');
  function render(){ for(var i=0;i<8;i++) dots[i].className = i<pin.length?'on':''; val.value=pin; if(pin.length===8) form.submit(); }
  document.querySelector('.keypad').addEventListener('click',function(e){
    var b=e.target.closest('.key'); if(!b) return;
    if(b.dataset.k==='back') pin=pin.slice(0,-1);
    else if(pin.length<8) pin+=b.dataset.k;
    render();
  });
  document.addEventListener('keydown',function(e){
    if(e.key>='0'&&e.key<='9'&&pin.length<8){ pin+=e.key; render(); }
    else if(e.key==='Backspace'){ pin=pin.slice(0,-1); render(); }
  });
})();
</script>
</body></html>`;
}

// dipakai halaman lain
export const NAV = Object.entries(PAGES).map(([p, m]) => [p, m.label, m.icon]);
export const SECTION_OF = {};
SECTIONS.forEach(([t, ps]) => ps.forEach((p) => (SECTION_OF[p] = t)));
