const $ = (s) => document.querySelector(s);
const root = document.documentElement;
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICON = {
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  zip:'<path d="M4 4h16v16H4z"/><path d="M10 4v3h4V4M10 7v3h4V7M10 10v3h4v-3M10 13v3h4v-3M12 16v2"/>',
  extract:'<path d="M4 4h16v16H4z"/><path d="M10 4v3h4V4M10 7v3h4V7M10 10v3h4v-3M10 13v3h4v-3M12 13v6m-3-3 3 3 3-3"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
  x:'<path d="M18 6L6 18M6 6l12 12"/>',
  left:'<path d="M15 18l-6-6 6-6"/>', right:'<path d="M9 18l6-6-6-6"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  play:'<path d="M5 3l14 9-14 9z"/>',
  music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  folderplus:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/>',
  folderup:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 16v-5M9.5 13.5L12 11l2.5 2.5"/>',
  share:'<path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
  decompile:'<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="m10 8-3 4 3 4M14 8l3 4-3 4"/>',
  palette:'<circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.9-4.5-9-10-9z"/>'
};
const svg = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;
document.querySelectorAll('[data-i]').forEach((e) => e.insertAdjacentHTML('afterbegin', svg(e.dataset.i, +e.dataset.s || 18)));

const EXT = {
  image:'png jpg jpeg gif webp svg bmp avif ico', video:'mp4 webm mov m4v ogv mkv', audio:'mp3 wav ogg flac m4a aac',
  pdf:'pdf', text:'txt md json js ts css html htm xml csv log yml yaml ini py java c cpp h cs go rs sh bat ps1 sql toml cfg conf'
};
const ARCHIVE_EXTENSIONS = [
  '.tar.bz2', '.tar.gz', '.tar.xz', '.7z', '.arj', '.bz2', '.cab', '.chm', '.cpio',
  '.cramfs', '.deb', '.dmg', '.fat', '.hfs', '.iso', '.lha', '.lzh', '.lzma', '.nsis',
  '.jar', '.ntfs', '.rar', '.rpm', '.squashfs', '.tar', '.taz', '.tbz', '.tbz2', '.tgz', '.tlz',
  '.txz', '.udf', '.vhd', '.vhdx', '.wim', '.xar', '.xz', '.z', '.zip'
];
const isArchiveFile = (name) => ARCHIVE_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension));
const isJarFile = (name) => name.toLowerCase().endsWith('.jar');
const CODE_LANGUAGES = {
  bash:'bash', bat:'dos', c:'c', cjs:'javascript', conf:'ini', cpp:'cpp', cs:'csharp', css:'css',
  diff:'diff', dockerfile:'dockerfile', go:'go', graphql:'graphql', h:'c', hpp:'cpp', htm:'xml', html:'xml',
  ini:'ini', java:'java', js:'javascript', json:'json', jsonc:'json', kt:'kotlin', kts:'kotlin',
  less:'less', lua:'lua', makefile:'makefile', md:'markdown', mjs:'javascript', nim:'nim',
  php:'php', pl:'perl', properties:'ini', ps1:'powershell', py:'python', pyw:'python',
  r:'r', rb:'ruby', rs:'rust', scss:'scss', sh:'bash', sql:'sql', swift:'swift',
  cfg:'ini', toml:'ini', ts:'typescript', tsx:'typescript', vb:'vbnet', xml:'xml', xhtml:'xml',
  yaml:'yaml', yml:'yaml', zsh:'bash',
};
const codeLanguage = (name) => {
  const extension = name.split('.').pop().toLowerCase();
  return CODE_LANGUAGES[extension] || null;
};
const syntaxLanguageLoads = new Map();
async function loadCodeLanguage(language) {
  if (window.hljs.getLanguage(language)) return true;
  if (!syntaxLanguageLoads.has(language)) {
    syntaxLanguageLoads.set(language, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/languages/' + encodeURIComponent(language) + '.min.js';
      script.onload = () => window.hljs.getLanguage(language)
        ? resolve()
        : reject(new Error('The syntax highlighter did not register ' + language));
      script.onerror = () => reject(new Error('Could not load the ' + language + ' syntax highlighter'));
      document.head.append(script);
    }).catch((err) => {
      syntaxLanguageLoads.delete(language);
      throw err;
    }));
  }
  try {
    await syntaxLanguageLoads.get(language);
    return true;
  } catch (err) {
    toast(err.message + '; showing plain text instead.', 'err');
    return false;
  }
}
async function setPreviewText(pre, text, name) {
  const language = codeLanguage(name);
  if (!language || !await loadCodeLanguage(language)) { pre.textContent = text; return; }
  pre.classList.add('code-preview', 'language-' + language);
  pre.innerHTML = window.hljs.highlight(text, { language, ignoreIllegals: true }).value;
}
const COL = { image:'#22d3ee', video:'#f472b6', audio:'#fbbf24', pdf:'#f43f5e', text:'#34d399', file:'#a78bfa', dir:'#fbbf24' };
const kind = (n) => { const e = n.split('.').pop().toLowerCase(); for (const k in EXT) if (EXT[k].split(' ').includes(e)) return k; return 'file'; };
const fmt = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n/1024).toFixed(1) + ' KB' : n < 1073741824 ? (n/1048576).toFixed(1) + ' MB' : (n/1073741824).toFixed(2) + ' GB';
const fmtDur = (s) => s < 60 ? Math.ceil(s) + 's' : s < 3600 ? Math.floor(s/60) + 'm ' + String(Math.floor(s%60)).padStart(2,'0') + 's' : Math.floor(s/3600) + 'h ' + String(Math.floor(s%3600/60)).padStart(2,'0') + 'm';
let speedBits = LS.get('vault-bits') === '1';
function fmtSpeed(bps) {
  let v = bps, i = 0, base = 1024, units = ['B/s','KB/s','MB/s','GB/s'];
  if (speedBits) { v *= 8; base = 1000; units = ['bps','Kbps','Mbps','Gbps']; }
  while (v >= base && i < 3) { v /= base; i++; }
  return [i === 0 ? String(Math.round(v)) : v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2), units[i]];
}
const fmtS = (b) => fmtSpeed(b).join(' ');
const join = (...p) => p.filter(Boolean).join('/');
const urlFor = (a, rel) => '/api/' + a + '?path=' + encodeURIComponent(rel);
const JSONH = { 'Content-Type': 'application/json' };

function toast(m, t) {
  const e = document.createElement('div'); e.className = 'toast ' + (t || '');
  e.innerHTML = '<div class="tt"></div><div class="tm"></div><i class="tp"></i>';
  e.querySelector('.tt').textContent = t === 'err' ? 'ERROR' : 'NOTICE';
  e.querySelector('.tm').textContent = m;
  $('#toasts').append(e);
  setTimeout(() => { e.classList.add('out'); setTimeout(() => e.remove(), 260); }, 3500);
}

/* ================= Cloudflare Access popup (email code) ================= */
let needAccess = false, accessPending = null;
function accessLogin() {
  // call this straight from a click/submit handler (before any await) or the browser blocks the popup
  const w = window.open('', 'vault-access', 'width=480,height=700');
  if (!w) return Promise.reject(new Error('Popup blocked: allow popups for this site, then try again'));
  try { if (w.location.href === 'about:blank') w.location.href = '/api/access-ok'; } catch {}   // already on Cloudflare's page: leave it alone
  if (accessPending) return accessPending;
  accessPending = new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(async () => {
      try {
        const r = await fetch('/api/access-ok', { method: 'HEAD', credentials: 'same-origin', redirect: 'manual', cache: 'no-store' });
        if (r.type !== 'opaqueredirect' && r.ok) { clearInterval(iv); accessPending = null; needAccess = false; try { w.close(); } catch {} return resolve(); }
      } catch {}
      if (Date.now() - t0 > 10 * 60 * 1000) { clearInterval(iv); accessPending = null; reject(new Error('Cloudflare verification timed out')); }
    }, 1500);
  });
  return accessPending;
}
const ACCESS_ERR = 'Cloudflare verification required';

async function api(url, opts = {}, prompt = true) {
  let r;
  try { r = await fetch(url, { credentials: 'same-origin', redirect: 'manual', ...opts }); }
  catch { throw new Error('Network error'); }
  if (r.type === 'opaqueredirect') {            // Cloudflare Access is asking for its email code
    needAccess = true;
    if (!prompt) throw new Error(ACCESS_ERR);
    await accessLogin();
    return api(url, opts, false);
  }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') { showLogin(); throw new Error('Session expired'); }
  if (!r.ok) throw new Error(d.error || r.statusText);
  return d;
}

/* ================= theme / hue ================= */
const THEMES = [['Mono', 200], ['Cyan', 185], ['Green', 145], ['Violet', 268], ['Red', 352], ['Amber', 42], ['Pink', 322]];
let themeIdx = (+LS.get('vault-theme') || 0) % THEMES.length, hue = 200;
$('#themename').textContent = THEMES[themeIdx][0];
$('#theme').onclick = () => {
  themeIdx = (themeIdx + 1) % THEMES.length; LS.set('vault-theme', themeIdx);
  $('#themename').textContent = THEMES[themeIdx][0];
};

/* ================= background particles ================= */
const bg = $('#bg'), bctx = bg.getContext('2d'), mouse = { x: -999, y: -999 };
let P = [];
function sizeBg() {
  bg.width = innerWidth; bg.height = innerHeight;
  const n = Math.min(90, Math.floor(innerWidth * innerHeight / 17000));
  P = Array.from({ length: n }, () => ({ x: Math.random() * bg.width, y: Math.random() * bg.height, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.4 + .4 }));
}
addEventListener('resize', sizeBg); sizeBg();
function drawBg() {
  const W = bg.width, H = bg.height; bctx.clearRect(0, 0, W, H);
  for (const p of P) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
    bctx.fillStyle = `hsla(${hue},100%,70%,.55)`; bctx.beginPath(); bctx.arc(p.x, p.y, p.r, 0, 6.283); bctx.fill();
  }
  bctx.lineWidth = 1;
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    for (let j = i + 1; j < P.length; j++) {
      const b = P[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
      if (d < 14400) { bctx.strokeStyle = `hsla(${hue},100%,65%,${(1 - d / 14400) * .22})`; bctx.beginPath(); bctx.moveTo(a.x, a.y); bctx.lineTo(b.x, b.y); bctx.stroke(); }
    }
    const mx = a.x - mouse.x, my = a.y - mouse.y, md = mx * mx + my * my;
    if (md < 25600) { bctx.strokeStyle = `hsla(${hue},100%,70%,${(1 - md / 25600) * .5})`; bctx.beginPath(); bctx.moveTo(a.x, a.y); bctx.lineTo(mouse.x, mouse.y); bctx.stroke(); }
  }
}
let mraf = 0;
addEventListener('pointermove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (!mraf) mraf = requestAnimationFrame(() => { document.body.style.setProperty('--mx', mouse.x + 'px'); document.body.style.setProperty('--my', mouse.y + 'px'); mraf = 0; });
});

/* ================= live network graphs ================= */
const HISTN = 120;
const mkG = (key, numId, unitId) => ({ key, nEl: $(numId), uEl: $(unitId), arr: Array(HISTN).fill(0), v: 0, target: 0, peak: 0, n: '', u: '' });
const G = { down: mkG('down', '#dnum', '#dunit'), up: mkG('up', '#unum', '#uunit') };
const GRAPH_COLORS = {
  down: { line: '#58c8ff', fill: 'rgba(88,200,255,.2)', halo: 'rgba(88,200,255,.15)' },
  up: { line: '#ffb454', fill: 'rgba(255,180,84,.2)', halo: 'rgba(255,180,84,.15)' },
};
let graphMax = 65536;
let lastPoll = performance.now(), ping = 0, fps = 0, uptimeS = 0, NET = { totalUp: 0, totalDown: 0, activeUp: 0, activeDown: 0 };

function sizeCanvas(cv) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [c, w, h];
}
function drawNetworkGraph(ts) {
  const canvas = $('#gnet');
  if (!canvas.clientWidth) return;
  const [c, W, H] = sizeCanvas(canvas); c.clearRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1;
  for (let i = 1; i < 4; i++) { const y = Math.round(H * i / 4) + .5; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  const n = Math.min(G.down.arr.length, G.up.arr.length);
  if (n < 2) return;
  const t = Math.min(1, Math.max(0, (ts - lastPoll) / 1000)), dx = W / (n - 1), shift = (1 - t) * 2 * dx;
  const maximum = Math.max(65536, ...G.down.arr, ...G.up.arr);
  graphMax += (maximum - graphMax) * .08;
  const X = (i) => W - (n - 1 - i) * dx + shift, Y = (v) => H - 3 - (v / graphMax) * (H - 14);
  for (const g of [G.down, G.up]) {
    const colors = GRAPH_COLORS[g.key], arr = g.arr;
    c.beginPath(); c.moveTo(0, Y(arr[0])); c.lineTo(X(0), Y(arr[0]));
    for (let i = 1; i < n; i++) {
      const x0 = X(i - 1), y0 = Y(arr[i - 1]), x1 = X(i), y1 = Y(arr[i]);
      c.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    }
    c.lineTo(X(n - 1), Y(arr[n - 1]));
    c.lineWidth = 2; c.strokeStyle = colors.line; c.shadowColor = colors.line; c.shadowBlur = 9; c.stroke(); c.shadowBlur = 0;
    c.lineTo(X(n - 1), H); c.lineTo(0, H); c.closePath();
    const gr = c.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, colors.fill); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fill();
    const fi = Math.max(0, n - 1 - shift / dx), i0 = Math.floor(fi), i1 = Math.min(n - 1, i0 + 1), fr = fi - i0;
    const value = arr[i0] + (arr[i1] - arr[i0]) * fr, y = Y(value), pulse = 4 + Math.sin(ts / 220) * 1.5;
    c.beginPath(); c.arc(W - 4, y, pulse + 3, 0, 6.283); c.fillStyle = colors.halo; c.fill();
    c.beginPath(); c.arc(W - 4, y, 3, 0, 6.283); c.fillStyle = colors.line; c.fill();
  }
  c.fillStyle = 'rgba(255,255,255,.35)'; c.font = '10px ui-monospace,Consolas,monospace'; c.textAlign = 'right'; c.fillText(fmtS(graphMax), W - 6, 12); c.textAlign = 'left';
}
function paintNums() {
  for (const g of Object.values(G)) {
    g.v += (g.target - g.v) * .2; if (g.v < 1 && g.target < 1) g.v = 0;
    const [n, u] = fmtSpeed(g.v);
    if (n !== g.n) { g.nEl.textContent = n; g.n = n; }
    if (u !== g.u) { g.uEl.textContent = u; g.u = u; }
  }
}
function paintStats() {
  $('#dpeak').textContent = fmtS(G.down.peak); $('#upeak').textContent = fmtS(G.up.peak);
  $('#dtot').textContent = fmt(NET.totalDown); $('#utot').textContent = fmt(NET.totalUp);
  $('#dact').textContent = NET.activeDown; $('#uact').textContent = NET.activeUp;
  const act = NET.activeDown + NET.activeUp > 0;
  $('#netstate').classList.toggle('live', act);
  $('#nettext').textContent = act ? NET.activeUp + ' UP / ' + NET.activeDown + ' DOWN ACTIVE' : 'IDLE';
  $('#pingv').textContent = ping + ' ms'; $('#fpsv').textContent = fps; $('#uptv').textContent = fmtDur(uptimeS);
  const disk = NET.diskActivity;
  if (disk && Number.isFinite(disk.activePercent)) {
    const activePercent = Math.max(0, Math.min(100, disk.activePercent));
    $('#disk-activity-fill').style.width = activePercent + '%';
    $('#disk-activity-pct').textContent = Math.round(activePercent) + '%';
  } else {
    $('#disk-activity-fill').style.width = '0%';
    $('#disk-activity-pct').textContent = '--%';
  }
  $('#disk-activity-rate').textContent = disk && Number.isFinite(disk.readBytesPerSec) && Number.isFinite(disk.writeBytesPerSec)
    ? 'READ ' + fmtS(disk.readBytesPerSec) + ' · WRITE ' + fmtS(disk.writeBytesPerSec)
    : 'READ -- · WRITE --';
}
document.querySelectorAll('.big').forEach((b) => (b.onclick = () => { speedBits = !speedBits; LS.set('vault-bits', speedBits ? '1' : '0'); paintStats(); }));

let pollGen = 0;
function startPolling() {
  const gen = ++pollGen;
  (async () => {
    while (gen === pollGen) {
      const t0 = performance.now();
      try {
        const s = await api('/api/stats', {}, false);
        if (gen !== pollGen) return;
        ping = Math.round(performance.now() - t0); lastPoll = performance.now(); uptimeS = s.uptime;
        for (const g of Object.values(G)) {
          const a = s[g.key]; g.arr = a; const n = a.length;
          g.target = ((a[n - 1] || 0) + (a[n - 2] || 0)) / 2; g.peak = Math.max(g.peak, ...a);
        }
        NET = { totalUp: s.totalUp, totalDown: s.totalDown, activeUp: s.activeUp, activeDown: s.activeDown, diskActivity: s.diskActivity };
        paintStats();
      } catch {}
      await new Promise((r) => setTimeout(r, document.hidden ? 3000 : 1000));
    }
  })();
}
const stopPolling = () => { pollGen++; };

let explorerMode = LS.get('vault-explorer-mode') === 'expanded';
function updateExplorerMode() {
  document.body.classList.toggle('explorer-mode', explorerMode);
  $('#explorer-toggle').textContent = explorerMode ? 'Collapse' : 'Expand';
  LS.set('vault-explorer-mode', explorerMode ? 'expanded' : 'collapsed');
}

/* ================= main frame loop ================= */
let appVisible = false, frames = 0, lastFps = performance.now(), lastHueSet = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  frames++; if (ts - lastFps >= 1000) { fps = Math.round(frames * 1000 / (ts - lastFps)); frames = 0; lastFps = ts; }
  const tv = THEMES[themeIdx][1];
  hue = tv == null ? (reduceMotion ? 200 : (ts / 80) % 360) : tv;
  if (ts - lastHueSet > 32) { root.style.setProperty('--hue', hue.toFixed(1)); lastHueSet = ts; }
  if (!reduceMotion) drawBg();
  if (appVisible) {
    paintNums();
    if (!$('#p-net').classList.contains('col')) drawNetworkGraph(ts);
  }
}
requestAnimationFrame(loop);
setInterval(() => { $('#clock').textContent = new Date().toLocaleTimeString([], { hour12: false }); }, 1000);
document.querySelectorAll('.panel[id]').forEach((panel) => {
  if (LS.get('vault-panel-' + panel.id) === 'collapsed') panel.classList.add('col');
});
updateExplorerMode();
document.querySelectorAll('.ph').forEach((h) => (h.onclick = (e) => {
  if (e.target.closest('button,a,input,select')) return;
  const panel = h.parentElement;
  panel.classList.toggle('col');
  LS.set('vault-panel-' + panel.id, panel.classList.contains('col') ? 'collapsed' : 'expanded');
  updateExplorerMode();
}));
$('#explorer-toggle').onclick = () => {
  explorerMode = !explorerMode;
  updateExplorerMode();
};

/* ================= auth ================= */
function showLogin() {
  appVisible = false; stopPolling(); document.body.classList.remove('in-app');
  $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); closePreview();
}
$('#lf').onsubmit = async (e) => {
  e.preventDefault(); $('#lerr').textContent = '';
  try {
    // popup must open straight from this submit (before any await) so the browser doesn't block it
    if (needAccess) { $('#lerr').textContent = 'Enter the Cloudflare code in the popup window…'; await accessLogin(); $('#lerr').textContent = ''; }
    await api('/api/login', { method:'POST', headers: JSONH, body: JSON.stringify({ username: $('#u').value, password: $('#p').value }) });
    $('#p').value = ''; init();
  } catch (err) { $('#lerr').textContent = err.message; }
};
$('#lo').onclick = async () => { await api('/api/logout', { method:'POST' }); showLogin(); };

/* ================= state + navigation ================= */
let cwd = '', items = [], list = [], pl = [], view = LS.get('vault-file-view') === 'list' ? 'list' : 'grid', cur = -1;
let archiveView = null;
const selected = new Set();
let selectionAnchor = null;
let copyClipboard = null;
let folderSizeGeneration = 0;
const MOVE_ITEMS_TYPE = 'application/x-vault-items';
let suppressCardClickUntil = 0;

const hashPath = () => {
  try { return location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent).filter(Boolean).join('/'); } catch { return ''; }
};
const go = (p) => { location.hash = '#/' + p.split('/').filter(Boolean).map(encodeURIComponent).join('/'); };
addEventListener('hashchange', () => {
  if ($('#app').classList.contains('hidden')) return;
  cwd = hashPath(); selected.clear(); selectionAnchor = null; $('#q').value = ''; closePreview(); refresh(true);
});

function sortedItems(query) {
  const sort = $('#sort').value;
  const compare = sort === 'name' ? (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })
    : sort === 'size' ? (a, b) => b.size - a.size
    : (a, b) => new Date(b.modified) - new Date(a.modified);
  return items.filter((item) => item.name.toLowerCase().includes(query))
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'dir' ? -1 : 1) || compare(a, b));
}

function applyView() {
  LS.set('vault-file-view', view);
  $('#files').classList.toggle('list', view === 'list');
  $('#vg').classList.toggle('on', view === 'grid'); $('#vl').classList.toggle('on', view === 'list');
}
function enableMoveDropTarget(element, destination) {
  element.ondragover = (e) => {
    if (!e.dataTransfer.types.includes(MOVE_ITEMS_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    element.classList.add('drop-target');
  };
  element.ondragleave = (e) => {
    if (!element.contains(e.relatedTarget)) element.classList.remove('drop-target');
  };
  element.ondrop = (e) => {
    if (!e.dataTransfer.types.includes(MOVE_ITEMS_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    suppressCardClickUntil = Date.now() + 500;
    element.classList.remove('drop-target');
    try {
      moveItems(JSON.parse(e.dataTransfer.getData(MOVE_ITEMS_TYPE)), destination);
    } catch {
      toast('Could not read dragged items', 'err');
    }
  };
}
$('#vg').onclick = () => { view = 'grid'; applyView(); };
$('#vl').onclick = () => { view = 'list'; applyView(); };
$('#q').oninput = () => renderSearchResults(); $('#sort').onchange = () => render(false);
addEventListener('keydown', (e) => {
  if (!$('#dlg').classList.contains('hidden')) { if (e.key === 'Escape') $('#dcancel').click(); return; }
  if (!$('#share-dialog').classList.contains('hidden')) { if (e.key === 'Escape') $('#share-close').click(); return; }
  if (!$('#modal').classList.contains('hidden')) {
    if (e.key === 'Escape') closePreview();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
    return;
  }
  if ($('#app').classList.contains('hidden')) return;
  const target = e.target;
  if (target instanceof Element && (target.isContentEditable || target.closest('input,textarea,select,[contenteditable="true"]'))) return;
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); $('#q').focus(); return; }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'c' && selected.size) {
    e.preventDefault();
    copyClipboard = { from: cwd, items: items.filter((item) => selected.has(item.name)).map((item) => item.name) };
    toast('Copied ' + copyClipboard.items.length + (copyClipboard.items.length === 1 ? ' item' : ' items') + ' to Vault clipboard');
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'v' && copyClipboard) {
    e.preventDefault();
    pasteItems(copyClipboard, cwd);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    selected.clear();
    for (const item of list) selected.add(item.name);
    selectionAnchor = list[0] ? list[0].name : null;
    updateSelectionActions();
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size) {
    e.preventDefault();
    $('#delete-selected').click();
    return;
  }
  if (e.key === 'Escape' && selected.size) {
    selected.clear();
    selectionAnchor = null;
    updateSelectionActions();
    return;
  }
  if (e.key === 'Enter' && selected.size === 1) {
    const item = items.find((file) => selected.has(file.name));
    if (!item || !list.includes(item)) return;
    e.preventDefault();
    if (item.type === 'dir') go(join(cwd, item.name));
    else if (isJarFile(item.name)) openPreview(pl.indexOf(item));
    else if (isArchiveFile(item.name)) openArchiveView(item);
    else openPreview(pl.indexOf(item));
  }
});

function renderCrumbs() {
  const c = $('#crumbs'); c.textContent = '';
  const parts = cwd ? cwd.split('/') : [];
  const all = [];
  if (archiveView && parts[0] === '@archive') {
    const archiveRoot = parts.slice(0, 2).join('/');
    all.push(['~', archiveView.sourcePath], [archiveView.name, archiveRoot]);
    parts.slice(2).forEach((part, i) => all.push([part, parts.slice(0, i + 3).join('/')]));
  } else {
    all.push(['~', '']);
    parts.forEach((part, i) => all.push([part, parts.slice(0, i + 1).join('/')]));
  }
  all.forEach(([label, p], i) => {
    if (i) { const s = document.createElement('span'); s.className = 'sep'; s.textContent = '/'; c.append(s); }
    const last = i === all.length - 1;
    const b = document.createElement(last ? 'span' : 'button');
    b.className = 'crumb' + (last ? ' cur' : ''); b.textContent = label;
    if (!last) {
      b.onclick = () => {
        if (Date.now() < suppressCardClickUntil) return;
        if (archiveView && p === archiveView.sourcePath) exitArchiveView();
        else go(p);
      };
      enableMoveDropTarget(b, p);
    }
    c.append(b);
  });
}

function render(anim) {
  list = sortedItems($('#q').value.trim().toLowerCase());
  for (const name of selected) if (!items.some((f) => f.name === name)) selected.delete(name);
  if (selectionAnchor && !items.some((f) => f.name === selectionAnchor)) selectionAnchor = null;
  pl = list.filter((f) => f.type === 'file');
  const box = $('#files'); box.textContent = '';
  list.forEach((f, i) => box.append(card(f, i, anim)));
  const nd = items.filter((f) => f.type === 'dir').length, nf = items.length - nd;
  $('#empty').classList.toggle('hidden', list.length > 0);
  $('#empty').textContent = items.length ? 'No items match your search.' : 'This folder is empty. Drop something in.';
  $('#count').textContent = [nd && nd + (nd === 1 ? ' folder' : ' folders'), nf && nf + (nf === 1 ? ' file' : ' files')].filter(Boolean).join(' / ');
  renderCrumbs(); updateSelectionActions();
}

function renderSearchResults() {
  const query = $('#q').value.trim().toLowerCase();
  const box = $('#files');
  const cards = new Map([...box.querySelectorAll('.card')].map((element) => [element.dataset.name, element]));
  const oldPositions = new Map();
  for (const element of box.querySelectorAll('.card:not([hidden])'))
    oldPositions.set(element.dataset.name, element.getBoundingClientRect());

  list = sortedItems(query);
  pl = list.filter((item) => item.type === 'file');
  const visibleNames = new Set(list.map((item) => item.name));
  for (const element of box.querySelectorAll('.card'))
    element.hidden = !visibleNames.has(element.dataset.name);

  for (const item of list) {
    const element = cards.get(item.name);
    if (element) box.append(element);
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) {
    for (const element of box.querySelectorAll('.card:not([hidden])')) {
      const previous = oldPositions.get(element.dataset.name);
      const current = element.getBoundingClientRect();
      if (!previous) {
        element.animate(
          [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: 180, easing: 'ease-out' }
        );
      } else if (previous.left !== current.left || previous.top !== current.top) {
        element.animate(
          [
            { transform: `translate(${previous.left - current.left}px, ${previous.top - current.top}px)` },
            { transform: 'translate(0, 0)' },
          ],
          { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }
        );
      }
    }
  }

  $('#empty').classList.toggle('hidden', list.length > 0);
  $('#empty').textContent = items.length ? 'No items match your search.' : 'This folder is empty. Drop something in.';
  updateSelectionActions();
}

async function loadFolderSizes(folderPath, generation) {
  const folders = list.filter((item) => item.type === 'dir');
  if (!folders.length) return;
  try {
    const result = await api('/api/folder-sizes', {
      method:'POST',
      headers: JSONH,
      body: JSON.stringify({ path: folderPath, folders: folders.map((item) => item.name) })
    });
    if (generation !== folderSizeGeneration || cwd !== folderPath) return;
    for (const entry of result.sizes) {
      const item = items.find((candidate) => candidate.name === entry.name && candidate.type === 'dir');
      const cardElement = [...$('#files').querySelectorAll('.card')]
        .find((candidate) => candidate.dataset.name === entry.name);
      if (!item || !cardElement) continue;
      const modified = new Date(item.modified).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
      cardElement.querySelector('.meta').textContent = 'Folder · ' + fmt(entry.size) + ' · ' + modified;
    }
  } catch (e) {
    if (generation !== folderSizeGeneration || cwd !== folderPath) return;
    $('#files').querySelectorAll('.card').forEach((cardElement) => {
      const item = items.find((candidate) => candidate.name === cardElement.dataset.name && candidate.type === 'dir');
      if (!item) return;
      const modified = new Date(item.modified).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
      cardElement.querySelector('.meta').textContent = 'Folder · Size unavailable · ' + modified;
    });
    toast('Could not calculate folder sizes: ' + e.message, 'err');
  }
}

function updateSelectionActions() {
  const count = selected.size;
  $('#selection-actions').classList.toggle('hidden', count === 0);
  $('#selected-count').textContent = count + ' selected';
  $('#files').querySelectorAll('.card').forEach((el) => {
    const isSelected = selected.has(el.dataset.name);
    el.classList.toggle('selected', isSelected);
    const mark = el.querySelector('.selection-mark');
    mark.classList.toggle('checked', isSelected);
    mark.setAttribute('aria-pressed', String(isSelected));
    mark.setAttribute('aria-label', (isSelected ? 'Deselect ' : 'Select ') + el.dataset.name);
  });
}

function selectCard(f, e) {
  const index = list.indexOf(f);
  if (e.shiftKey) {
    const anchorIndex = selectionAnchor ? list.findIndex((item) => item.name === selectionAnchor) : -1;
    if (!e.ctrlKey && !e.metaKey) selected.clear();
    if (anchorIndex < 0) { selected.add(f.name); selectionAnchor = f.name; }
    else {
      const start = Math.min(anchorIndex, index), end = Math.max(anchorIndex, index);
      for (let i = start; i <= end; i++) selected.add(list[i].name);
    }
  } else if (e.ctrlKey || e.metaKey) {
    if (selected.has(f.name)) selected.delete(f.name);
    else selected.add(f.name);
    selectionAnchor = f.name;
  } else {
    selected.clear();
    selectionAnchor = f.name;
    updateSelectionActions();
    return false;
  }
  updateSelectionActions();
  return true;
}

function card(f, i, anim) {
  const isDir = f.type === 'dir', rel = join(cwd, f.name), k = isDir ? 'dir' : kind(f.name);
  const el = document.createElement('div'); el.className = 'card' + (anim ? ' in' : '') + (selected.has(f.name) ? ' selected' : ''); el.style.setProperty('--i', Math.min(i, 24));
  el.dataset.name = f.name;
  if (!isDir && isArchiveFile(f.name))
    el.title = isJarFile(f.name)
      ? 'Click to preview; choose Decompile to browse Java source in a temporary workspace'
      : 'Click to browse in a temporary workspace; use the extract action to create a regular folder';
  el.draggable = true;
  el.ondragstart = (e) => {
    if (e.target.closest('button,a')) { e.preventDefault(); return; }
    const names = selected.has(f.name) ? [...selected] : [f.name];
    e.dataTransfer.setData(MOVE_ITEMS_TYPE, JSON.stringify({ from: cwd, items: names }));
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  };
  el.ondragend = () => {
    suppressCardClickUntil = Date.now() + 300;
    el.classList.remove('dragging');
    $('#files').querySelectorAll('.drop-target').forEach((target) => target.classList.remove('drop-target'));
  };
  if (isDir) {
    enableMoveDropTarget(el, rel);
  }
  el.onclick = (e) => {
    if (Date.now() < suppressCardClickUntil) { e.preventDefault(); return; }
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      selectCard(f, e);
      return;
    }
    if (isDir) go(rel);
    else if (isJarFile(f.name)) openPreview(pl.indexOf(f));
    else if (isArchiveFile(f.name)) openArchiveView(f);
    else openPreview(pl.indexOf(f));
  };
  const mark = document.createElement('button');
  mark.type = 'button';
  mark.className = 'selection-mark';
  mark.setAttribute('aria-pressed', String(selected.has(f.name)));
  mark.setAttribute('aria-label', (selected.has(f.name) ? 'Deselect ' : 'Select ') + f.name);
  mark.onclick = (e) => {
    e.stopPropagation();
    if (e.shiftKey && selectionAnchor) selectCard(f, e);
    else {
      if (selected.has(f.name)) selected.delete(f.name);
      else selected.add(f.name);
      selectionAnchor = f.name;
      updateSelectionActions();
    }
  };
  const th = document.createElement('div'); th.className = 'thumb'; th.style.setProperty('--c', COL[k]);
  if (k === 'image') { const im = new Image(); im.loading = 'lazy'; im.alt = ''; im.src = urlFor('view', rel); th.append(im); }
  else {
    th.innerHTML = svg(isDir ? 'folder' : k === 'video' ? 'play' : k === 'audio' ? 'music' : 'file', isDir ? 44 : 34);
    if (!isDir) { const b = document.createElement('span'); b.className = 'ext'; b.textContent = (f.name.includes('.') ? f.name.split('.').pop() : 'FILE').slice(0, 4).toUpperCase(); th.append(b); }
  }
  const info = document.createElement('div'); info.className = 'info';
  const nm = document.createElement('div'); nm.className = 'name2'; nm.textContent = f.name; nm.title = f.name;
  const mt = document.createElement('div'); mt.className = 'meta';
  mt.textContent = (isDir ? 'Folder · Calculating size' : fmt(f.size)) + ' · ' +
    new Date(f.modified).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  info.append(nm, mt);
  const act = document.createElement('div'); act.className = 'act';
  if (!isDir) {
    if (isArchiveFile(f.name)) {
      const extract = document.createElement('button'); extract.className = 'btn'; extract.innerHTML = svg('extract', 16); extract.title = 'Extract archive'; extract.setAttribute('aria-label', 'Extract ' + f.name);
      extract.onclick = (e) => { e.stopPropagation(); extractZip(f); };
      act.append(extract);
    }
    const dl = document.createElement('a'); dl.className = 'btn'; dl.href = urlFor('download', rel); dl.innerHTML = svg('download', 16); dl.title = 'Download'; dl.onclick = (e) => e.stopPropagation();
    act.append(dl);
    const rename = document.createElement('button'); rename.className = 'btn'; rename.innerHTML = svg('edit', 16); rename.title = 'Rename'; rename.setAttribute('aria-label', 'Rename ' + f.name);
    rename.onclick = (e) => { e.stopPropagation(); renameFile(f); };
    act.append(rename);
    if (!archiveView) {
      const share = document.createElement('button'); share.className = 'btn'; share.innerHTML = svg('share', 16); share.title = 'Share'; share.setAttribute('aria-label', 'Share ' + f.name);
      share.onclick = (e) => { e.stopPropagation(); openShareManager(f); };
      act.append(share);
    }
  } else {
    const zip = document.createElement('button'); zip.className = 'btn'; zip.innerHTML = svg('zip', 16); zip.title = 'Create ZIP in this folder'; zip.setAttribute('aria-label', 'Create ZIP for folder ' + f.name);
    zip.onclick = (e) => { e.stopPropagation(); createZip([f.name]); };
    act.append(zip);
    const rename = document.createElement('button'); rename.className = 'btn'; rename.innerHTML = svg('edit', 16); rename.title = 'Rename folder'; rename.setAttribute('aria-label', 'Rename folder ' + f.name);
    rename.onclick = (e) => { e.stopPropagation(); renameFile(f); };
    act.append(rename);
  }
  const rm = document.createElement('button'); rm.className = 'btn danger'; rm.innerHTML = svg('trash', 16); rm.title = 'Delete'; rm.onclick = (e) => { e.stopPropagation(); del(f); };
  act.append(rm);
  el.append(mark, th, info, act);
  return el;
}

function showDialog({ title, message = '', value = '', placeholder = '', confirmText = 'OK', danger = false, input = true }) {
  return new Promise((resolve) => {
    const dialog = $('#dlg'), form = dialog.querySelector('form'), field = $('#dname');
    const confirmButton = $('#dlg-confirm'), messageElement = $('#dlg-message');
    $('#dlg-title').textContent = title;
    messageElement.textContent = message;
    messageElement.classList.toggle('hidden', !message);
    field.classList.toggle('hidden', !input);
    field.value = value;
    field.placeholder = placeholder;
    field.setAttribute('aria-label', placeholder || title);
    confirmButton.textContent = confirmText;
    confirmButton.classList.toggle('danger', danger);
    confirmButton.classList.toggle('primary', !danger);
    dialog.classList.remove('hidden');
    const done = (result) => {
      dialog.classList.add('hidden');
      form.onsubmit = null;
      $('#dcancel').onclick = null;
      dialog.onmousedown = null;
      resolve(result);
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      done(input ? field.value.trim() : true);
    };
    $('#dcancel').onclick = () => done(null);
    dialog.onmousedown = (event) => { if (event.target === dialog) done(null); };
    requestAnimationFrame(() => input ? field.focus() : confirmButton.focus());
  });
}

async function del(f) {
  const dir = f.type === 'dir';
  const confirmed = await showDialog({
    title: dir ? 'DELETE FOLDER' : 'DELETE FILE',
    message: dir ? 'Delete "' + f.name + '" and everything inside it?' : 'Delete "' + f.name + '"?',
    input: false,
    confirmText: 'Delete',
    danger: true
  });
  if (!confirmed) return;
  try { await api(urlFor('item', join(cwd, f.name)), { method:'DELETE' }); toast('Deleted ' + f.name); closePreview(); refresh(false); }
  catch (e) { toast(e.message, 'err'); }
}

async function renameFile(f) {
  const isDir = f.type === 'dir';
  const name = await showDialog({
    title: isDir ? 'RENAME FOLDER' : 'RENAME FILE',
    message: isDir ? 'Enter a new folder name.' : 'Enter a new name. Include an extension to change the file type.',
    value: f.name,
    confirmText: 'Rename'
  });
  if (name === null || !name.trim() || name.trim() === f.name) return;
  try {
    const result = await api(urlFor('item', join(cwd, f.name)), {
      method:'PATCH', headers: JSONH, body: JSON.stringify({ name: name.trim() })
    });
    if (cur >= 0 && pl[cur] === f) closePreview();
    toast(result.renamed ? 'Renamed to ' + result.name : 'Name unchanged');
    await refresh(false);
  } catch (e) { toast(e.message, 'err'); }
}

let sharingFile = null, currentShareId = null;
async function openShareManager(f) {
  sharingFile = f;
  currentShareId = null;
  $('#share-filename').textContent = f.name;
  $('#share-uses').value = '';
  $('#share-url').value = '';
  $('#share-result').classList.add('hidden');
  $('#share-dialog').classList.remove('hidden');
  await refreshShareList();
}

async function refreshShareList() {
  if (!sharingFile) return;
  const box = $('#share-list');
  box.textContent = 'Loading links…';
  try {
    const data = await api(urlFor('shares', join(cwd, sharingFile.name)));
    box.textContent = '';
    if (!data.shares.length) { box.textContent = 'No share links for this file.'; return; }
    data.shares.forEach((share) => {
      const row = document.createElement('div'); row.className = 'share-entry';
      const label = document.createElement('span');
      label.textContent = (share.maxUses === null ? 'Permanent · unlimited uses' : share.uses + ' / ' + share.maxUses + ' uses') +
        (share.maxUses !== null && share.uses >= share.maxUses ? ' · used up' : '');
      const copy = document.createElement('button'); copy.className = 'btn'; copy.type = 'button'; copy.textContent = 'Copy';
      copy.onclick = () => copyShareLink(new URL(share.url, location.href).href);
      const revoke = document.createElement('button'); revoke.className = 'btn danger'; revoke.type = 'button'; revoke.textContent = 'Revoke';
      revoke.onclick = async () => {
        try { await api('/api/shares/' + share.id, { method:'DELETE' }); toast('Share link revoked'); await refreshShareList(); }
        catch (e) { toast(e.message, 'err'); }
      };
      row.append(label, copy, revoke); box.append(row);
    });
  } catch (e) {
    box.textContent = '';
    toast(e.message, 'err');
  }
}

$('#share-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!sharingFile) return;
  const rawUses = $('#share-uses').value.trim();
  const maxUses = rawUses ? Number(rawUses) : null;
  if (maxUses !== null && (!Number.isSafeInteger(maxUses) || maxUses < 1)) { toast('Use limit must be a positive whole number', 'err'); return; }
  const button = $('#share-create'); button.disabled = true;
  try {
    const result = await api(urlFor('shares', join(cwd, sharingFile.name)), {
      method:'POST', headers: JSONH, body: JSON.stringify({ maxUses })
    });
    currentShareId = result.id;
    $('#share-url').value = new URL(result.url, location.href).href;
    $('#share-result').classList.remove('hidden');
    await refreshShareList();
    toast('Share link created');
  } catch (err) { toast(err.message, 'err'); }
  finally { button.disabled = false; }
};

async function copyShareLink(value) {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
    else {
      const input = $('#share-url');
      input.value = value;
      input.focus(); input.select();
      if (!document.execCommand('copy')) throw new Error('Clipboard access is unavailable; copy the selected link manually');
    }
    toast('Link copied');
  } catch (e) { toast(e.message || 'Could not copy link', 'err'); }
}
$('#share-copy').onclick = () => copyShareLink($('#share-url').value);
$('#share-revoke-current').onclick = async () => {
  if (!currentShareId) return;
  try {
    await api('/api/shares/' + currentShareId, { method:'DELETE' });
    currentShareId = null; $('#share-result').classList.add('hidden');
    toast('Share link revoked'); await refreshShareList();
  } catch (e) { toast(e.message, 'err'); }
};
$('#share-close').onclick = () => { $('#share-dialog').classList.add('hidden'); sharingFile = null; currentShareId = null; };
$('#share-dialog').onmousedown = (e) => { if (e.target === $('#share-dialog')) $('#share-close').click(); };

$('#clear-selection').onclick = () => {
  selected.clear(); selectionAnchor = null;
  render(false);
};
$('#select-all').onclick = () => {
  selected.clear();
  for (const item of list) selected.add(item.name);
  selectionAnchor = list[0] ? list[0].name : null;
  updateSelectionActions();
};
async function createZip(names) {
  try {
    const result = await api('/api/archive', {
      method:'POST',
      headers: JSONH,
      body: JSON.stringify({ path: cwd, items: names })
    });
    selected.clear();
    selectionAnchor = null;
    await refresh(false);
    toast('Created ' + result.name);
  } catch (e) {
    toast(e.message, 'err');
  }
}
$('#download-selected').onclick = async () => {
  const targets = items.filter((item) => selected.has(item.name));
  if (!targets.length) return;
  const button = $('#download-selected');
  button.disabled = true;
  try {
    const result = await api('/api/download-items', {
      method: 'POST',
      headers: JSONH,
      body: JSON.stringify({ path: cwd, items: targets.map((item) => item.name) })
    });
    for (let i = 0; i < result.files.length; i++) {
      const link = document.createElement('a');
      link.hidden = true;
      link.href = urlFor('download', result.files[i]);
      document.body.append(link);
      link.click();
      link.remove();
      if (i + 1 < result.files.length)
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    selected.clear();
    selectionAnchor = null;
    updateSelectionActions();
    toast('Started ' + result.files.length + ' individual downloads. If only one starts, allow multiple automatic downloads for this site in your browser.');
  } catch (e) {
    toast(e.message || 'Could not prepare selected items for download', 'err');
  } finally {
    button.disabled = false;
  }
};
async function moveItems(payload, destination) {
  if (!payload || typeof payload.from !== 'string' || !Array.isArray(payload.items) || !payload.items.length) return;
  try {
    const result = await api('/api/move', {
      method:'POST',
      headers: JSONH,
      body: JSON.stringify({ from: payload.from, to: destination, items: payload.items })
    });
    selected.clear();
    selectionAnchor = null;
    await refresh(false);
    if (result.count) toast('Moved ' + result.count + (result.count === 1 ? ' item' : ' items'));
  } catch (e) {
    toast(e.message, 'err');
  }
}
async function pasteItems(payload, destination) {
  if (!payload || typeof payload.from !== 'string' || !Array.isArray(payload.items) || !payload.items.length) return;
  try {
    const result = await api('/api/copy', {
      method:'POST',
      headers: JSONH,
      body: JSON.stringify({ from: payload.from, to: destination, items: payload.items })
    });
    await refresh(false);
    toast('Copied ' + result.count + (result.count === 1 ? ' item' : ' items') +
      (result.copied.length ? ': ' + result.copied.map((name) => name.split('/').pop()).join(', ') : ''));
  } catch (e) {
    toast(e.message, 'err');
  }
}
async function extractZip(file) {
  try {
    const result = await api('/api/extract', {
      method:'POST',
      headers: JSONH,
      body: JSON.stringify({ path: cwd, name: file.name })
    });
    await refresh(false);
    toast('Extracted to ' + result.name);
  } catch (e) {
    toast(e.message, 'err');
  }
}
async function openArchiveView(file) {
  try {
    const result = await api('/api/archive/view', {
      method:'POST',
      headers: JSONH,
      body: JSON.stringify({ path: cwd, name: file.name })
    });
    go(result.path);
  } catch (e) {
    toast(e.message, 'err');
  }
}
async function openJarDecompiledView(file) {
  const button = $('#mdecompile');
  button.disabled = true;
  try {
    const result = await api('/api/jar/decompile', {
      method:'POST',
      headers: JSONH,
      body: JSON.stringify({ path: cwd, name: file.name })
    });
    closePreview();
    go(result.path);
    toast(result.cached
      ? 'Reopened the existing decompiled workspace'
      : 'Created ' + result.decompiled + ' decompiled source files');
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    button.disabled = false;
  }
}
async function exitArchiveView() {
  if (!archiveView || !cwd.startsWith('@archive/')) return;
  const token = cwd.split('/')[1];
  const sourcePath = archiveView.sourcePath;
  try {
    await api('/api/archive/view/close', {
      method:'POST',
      headers: JSONH,
      body: JSON.stringify({ token })
    });
    go(sourcePath);
  } catch (e) {
    toast(e.message, 'err');
  }
}
$('#archive-view-close').onclick = exitArchiveView;
$('#zip-selected').onclick = () => {
  const targets = items.filter((f) => selected.has(f.name));
  if (targets.length) createZip(targets.map((f) => f.name));
};
$('#delete-selected').onclick = async () => {
  const targets = items.filter((f) => selected.has(f.name));
  if (!targets.length) return;
  const folders = targets.filter((f) => f.type === 'dir').length;
  const message = 'Delete ' + targets.length + ' selected ' + (targets.length === 1 ? 'item' : 'items') +
    (folders ? ', including ' + folders + (folders === 1 ? ' folder' : ' folders') + ' and everything inside' : '') + '?';
  const confirmed = await showDialog({
    title: 'DELETE SELECTED ITEMS',
    message,
    input: false,
    confirmText: 'Delete',
    danger: true
  });
  if (!confirmed) return;
  const failures = [];
  let deleted = 0;
  for (const f of targets) {
    try {
      await api(urlFor('item', join(cwd, f.name)), { method:'DELETE' });
      selected.delete(f.name);
      deleted++;
    } catch (e) {
      failures.push(f.name + ': ' + e.message);
    }
  }
  await refresh(false);
  if (failures.length) toast(deleted + ' deleted; ' + failures.length + ' failed: ' + failures.join('; '), 'err');
  else toast('Deleted ' + deleted + (deleted === 1 ? ' item' : ' items'));
};

/* ---- new folder ---- */
function askName() {
  return showDialog({ title: 'NEW FOLDER', placeholder: 'folder name', confirmText: 'Create' });
}
$('#newf').onclick = async () => {
  const name = await askName();
  if (!name) return;
  try {
    const r = await api('/api/mkdir', { method:'POST', headers: JSONH, body: JSON.stringify({ path: cwd, name }) });
    toast(r.created ? 'Folder created' : 'Folder already exists'); refresh(false);
  } catch (e) { toast(e.message, 'err'); }
};

/* ---- preview (files in the current folder) ---- */
async function openPreview(i) {
  if (i < 0 || i >= pl.length) return;
  cur = i;
  const f = pl[i], rel = join(cwd, f.name), k = kind(f.name), vu = urlFor('view', rel), body = $('#mbody');
  $('#mname').textContent = f.name; $('#mdl').href = urlFor('download', rel); $('#mrename').onclick = () => renameFile(f);
  $('#mdecompile').classList.toggle('hidden', !isJarFile(f.name));
  $('#mdecompile').onclick = () => openJarDecompiledView(f);
  $('#mtext').classList.remove('on'); $('#mbytes').classList.remove('on');
  let rawData = null;
  $('#modal').classList.remove('hidden'); document.body.style.overflow = 'hidden';
  body.textContent = '';
  if (k === 'image') { const im = new Image(); im.src = vu; body.append(im); }
  else if (k === 'video') { const v = document.createElement('video'); v.src = vu; v.controls = true; v.autoplay = true; body.append(v); }
  else if (k === 'audio') { const a = document.createElement('audio'); a.src = vu; a.controls = true; a.autoplay = true; body.append(a); }
  else if (k === 'pdf') { const fr = document.createElement('iframe'); fr.src = vu; body.append(fr); }
  else if (k === 'text' && f.size <= 2 * 1024 * 1024) {
    const pre = document.createElement('pre'); pre.textContent = 'Loading…'; body.append(pre);
    try { const t = await (await fetch(vu, { credentials:'same-origin' })).text(); if (cur === i) await setPreviewText(pre, t, f.name); }
    catch { pre.textContent = 'Could not load file.'; }
  } else {
    const d = document.createElement('div'); d.className = 'nopreview';
    d.innerHTML = '<div style="margin-bottom:1rem;color:' + COL[k] + '">' + svg('file', 56) + '</div>';
    const p = document.createElement('div'); p.textContent = k === 'text' ? 'Too large to preview.' : 'No preview available for this file type.'; d.append(p);
    body.append(d);
  }

  async function showRaw(mode) {
    body.textContent = '';
    const pre = document.createElement('pre');
    if (mode === 'bytes') pre.className = 'raw-bytes';
    pre.textContent = 'Loading…'; body.append(pre);
    $('#mtext').classList.toggle('on', mode === 'text');
    $('#mbytes').classList.toggle('on', mode === 'bytes');
    try {
      if (!rawData) {
        const limit = 256 * 1024;
        const response = await fetch(vu, { credentials:'same-origin', headers:{ Range:'bytes=0-' + (limit - 1) } });
        if (response.status === 401) { showLogin(); throw new Error('Session expired'); }
        if (!response.ok) throw new Error('Could not read file (HTTP ' + response.status + ')');
        const reader = response.body.getReader(), chunks = [];
        let length = 0, truncated = false;
        while (length < limit) {
          const { done, value } = await reader.read();
          if (done) break;
          const remaining = limit - length;
          if (value.length > remaining) {
            chunks.push(value.subarray(0, remaining)); length += remaining; truncated = true;
            await reader.cancel();
            break;
          }
          chunks.push(value); length += value.length;
        }
        if (length === limit && f.size > limit) truncated = true;
        rawData = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { rawData.set(chunk, offset); offset += chunk.length; }
        rawData.truncated = truncated;
      }
      if (cur !== i || $('#modal').classList.contains('hidden')) return;
      if (mode === 'text') {
        await setPreviewText(pre, new TextDecoder('utf-8').decode(rawData) +
          (rawData.truncated ? '\n\n[Showing first 256 KB]' : ''), f.name);
      } else {
        const lines = [];
        for (let start = 0; start < rawData.length; start += 16) {
          const row = rawData.subarray(start, Math.min(start + 16, rawData.length));
          const hex = [...row].map((byte) => byte.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
          const ascii = [...row].map((byte) => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.').join('');
          lines.push(start.toString(16).padStart(8, '0') + '  ' + hex + '  |' + ascii.padEnd(16, ' ') + '|');
        }
        pre.textContent = lines.join('\n') + (rawData.truncated ? '\n\n[Showing first 256 KB]' : '');
      }
    } catch (e) {
      if (cur === i) pre.textContent = e.message || 'Could not read file.';
    }
  }
  $('#mtext').onclick = () => showRaw('text');
  $('#mbytes').onclick = () => showRaw('bytes');
}
function closePreview() { $('#modal').classList.add('hidden'); $('#mbody').textContent = ''; document.body.style.overflow = ''; cur = -1; }
function step(d) { if (cur >= 0 && pl.length) openPreview((cur + d + pl.length) % pl.length); }
$('#mx').onclick = closePreview; $('#mprev').onclick = () => step(-1); $('#mnext').onclick = () => step(1);
$('#mdel').onclick = () => cur >= 0 && del(pl[cur]);

/* ---- upload (files + folders) ---- */
const XHR_IDLE_TIMEOUT = 10 * 60 * 1000;
function startXhrIdleTimeout(x, onTimeout) {
  let timer;
  const reset = () => {
    clearTimeout(timer);
    timer = setTimeout(onTimeout, XHR_IDLE_TIMEOUT);
  };
  reset();
  return { reset, clear: () => clearTimeout(timer) };
}

function xhrUpload(entry, base, onProg, onSent) {
  return new Promise((resolve) => {
    const sub = entry.rel.includes('/') ? entry.rel.slice(0, entry.rel.lastIndexOf('/')) : '';
    const x = new XMLHttpRequest();
    let settled = false;
    const timer = startXhrIdleTimeout(x, () => {
      finish('Upload stalled: no response from the server');
      x.abort();
    });
    const finish = (error) => {
      if (settled) return;
      settled = true; timer.clear(); resolve(error);
    };
    x.open('POST', '/api/files?path=' + encodeURIComponent(base) + '&sub=' + encodeURIComponent(sub));
    x.upload.onprogress = (ev) => {
      timer.reset();
      if (ev.lengthComputable) onProg(Math.min(ev.loaded, entry.file.size));
    };
    x.upload.onload = () => { timer.reset(); onSent(); };
    x.onload = () => {
      if (x.status === 401) showLogin();
      if (x.status < 300) return finish(null);
      let msg = 'Upload failed'; try { msg = JSON.parse(x.responseText).error || msg; } catch {}
      finish(msg);
    };
    x.onerror = () => finish('Network error during upload');
    x.onabort = () => finish('Upload cancelled');
    x.ontimeout = () => finish('Upload stalled: no response from the server');
    const fd = new FormData(); fd.append('file', entry.file); x.send(fd);
  });
}

const CHUNK_AT = 90 * 1024 * 1024;
const chunkedUploadToggle = $('#chunked-upload');
chunkedUploadToggle.checked = LS.get('vault-chunked-uploads') !== 'off';
chunkedUploadToggle.onchange = () => LS.set('vault-chunked-uploads', chunkedUploadToggle.checked ? 'on' : 'off');
function putChunk(id, offset, blob, onProg) {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    let settled = false;
    const timer = startXhrIdleTimeout(x, () => {
      finish({ ok: false, status: 0, error: 'Upload stalled: no response from the server', timedOut: true });
      x.abort();
    });
    const finish = (result) => {
      if (settled) return;
      settled = true; timer.clear(); resolve(result);
    };
    x.open('POST', '/api/upload/' + id + '?offset=' + offset);
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    x.upload.onprogress = (ev) => {
      timer.reset();
      if (ev.lengthComputable) onProg(ev.loaded);
    };
    x.onload = () => {
      let d = {}; try { d = JSON.parse(x.responseText); } catch {}
      const ok = x.status < 300 && d.ok === true;
      finish({ ok, status: x.status, error: d.error || (x.status < 300 ? 'Unexpected response from server (HTTP ' + x.status + ')' : x.statusText) });
    };
    x.onerror = () => finish({ ok: false, status: 0, error: 'Network error during upload' });
    x.onabort = () => finish({ ok: false, status: 0, error: 'Upload cancelled' });
    x.ontimeout = () => finish({ ok: false, status: 0, error: 'Upload stalled: no response from the server', timedOut: true });
    x.send(blob);
  });
}
async function chunkedUpload(entry, base, onProg, onSent) {
  const f = entry.file, sub = entry.rel.includes('/') ? entry.rel.slice(0, entry.rel.lastIndexOf('/')) : '';
  let id = null;
  try {
    const s = await api('/api/upload/start', { method:'POST', headers: JSONH, body: JSON.stringify({ path: base, sub, name: f.name, size: f.size }) });
    id = s.id;
    const CH = s.chunkSize, offsets = [];
    for (let o = 0; o < f.size; o += CH) offsets.push(o);
    const doneB = new Map(), live = new Map(); let next = 0, fatal = null;
    const report = () => { let t = 0; doneB.forEach((v) => (t += v)); live.forEach((v) => (t += v)); onProg(t); };
    const worker = async () => {
      while (!fatal && next < offsets.length) {
        const o = offsets[next++], end = Math.min(o + CH, f.size); let ok = false, last = 'Chunk failed';
        for (let a = 0; a < 5 && !ok && !fatal; a++) {
          const r = await putChunk(id, o, f.slice(o, end), (n) => { live.set(o, n); report(); });
          live.delete(o);
          if (r.ok) { ok = true; doneB.set(o, end - o); report(); }
          else {
            last = r.error || last;
            if (r.status === 401) { showLogin(); fatal = 'Session expired'; }
            else if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) fatal = last;
            else await new Promise((res) => setTimeout(res, Math.min(5000, 600 * (a + 1))));
          }
        }
        if (!ok && !fatal) fatal = last;
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, offsets.length) }, () => worker()));
    if (fatal) throw new Error(fatal);
    onSent();
    const controller = new AbortController();
    const finishTimer = setTimeout(() => controller.abort(), XHR_IDLE_TIMEOUT);
    try {
      await api('/api/upload/' + id + '/finish', { method:'POST', signal: controller.signal });
    } catch (e) {
      if (controller.signal.aborted) throw new Error('Upload stalled while saving on the server');
      throw e;
    } finally { clearTimeout(finishTimer); }
    return null;
  } catch (e) {
    if (id) fetch('/api/upload/' + id, { method:'DELETE', credentials:'same-origin' }).catch(() => {});
    return e.message;
  }
}

async function uploadAll(entries, dirs = []) {
  if (!entries.length && !dirs.length) return;
  const base = cwd, chunkingEnabled = chunkedUploadToggle.checked;
  const total = entries.reduce((a, e) => a + e.file.size, 0) || 1;
  const row = document.createElement('div'); row.className = 'up';
  row.innerHTML = '<div class="n"><span class="up-name"></span><span class="up-status"></span></div><div class="seg-bar"><i></i></div>'; $('#tray').append(row);
  const label = row.querySelector('.up-name'), status = row.querySelector('.up-status'), bar = row.querySelector('i');
  let doneBytes = 0, doneCount = 0, failed = 0, firstErr = ''; const live = new Map(), saving = new Set(), samples = [];
  const upd = () => {
    let l = doneBytes; live.forEach((v) => (l += v));
    const now = performance.now(); samples.push([now, l]);
    while (samples.length > 2 && now - samples[0][0] > 1500) samples.shift();
    const [t0, b0] = samples[0], sp = now > t0 ? (l - b0) / ((now - t0) / 1000) : 0;
    bar.style.width = Math.min(doneBytes === total ? 100 : 95, l / total * 100) + '%';
    const name = entries.length === 1 ? entries[0].file.name : 'Uploading ' + doneCount + ' / ' + entries.length + ' files';
    label.textContent = name;
    label.title = entries.length === 1 ? entries[0].file.name : name;
    status.textContent = saving.size
      ? 'Waiting for server…'
      : sp > 1024 ? fmtS(sp) + ' · ~' + fmtDur(Math.max(0, total - l) / sp) : '';
  };
  upd(); const iv = setInterval(upd, 500);
  for (const d of dirs) { try { await api('/api/mkdir', { method:'POST', headers: JSONH, body: JSON.stringify({ path: base, name: d }) }); } catch {} }
  let idx = 0;
  const worker = async () => {
    while (idx < entries.length) {
      const e = entries[idx++];
      const prog = (n) => { live.set(e, n); upd(); };
      const sent = () => { saving.add(e); upd(); };
      const err = chunkingEnabled && e.file.size > CHUNK_AT
        ? await chunkedUpload(e, base, prog, sent)
        : await xhrUpload(e, base, prog, sent);
      live.delete(e);
      saving.delete(e);
      if (err) { failed++; firstErr = firstErr || err; } else { doneBytes += e.file.size; doneCount++; }
      upd();
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  clearInterval(iv);
  bar.style.width = failed ? Math.min(95, doneBytes / total * 100) + '%' : '100%';
  row.classList.add(failed ? 'fail' : 'done');
  label.textContent = failed ? doneCount + ' uploaded, ' + failed + ' failed' : 'Uploaded ' + doneCount + (doneCount === 1 ? ' file' : ' files');
  label.title = label.textContent;
  status.textContent = '';
  if (failed) toast(failed + ' upload' + (failed > 1 ? 's' : '') + ' failed: ' + firstErr, 'err');
  setTimeout(() => row.remove(), failed ? 30000 : 3000);
  refresh(false);
}

async function walk(entry, prefix, out) {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    out.files.push({ file, rel: prefix + entry.name });
  } else if (entry.isDirectory) {
    const path = prefix + entry.name;
    out.dirs.push(path);
    const reader = entry.createReader();
    let batch;
    do {
      batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      for (const e of batch) await walk(e, path + '/', out);
    } while (batch.length);
  }
}

$('#drop').onclick = (e) => { if (e.target.closest('.upload-option')) return; $('#pick').click(); };
$('#updir').onclick = (e) => { e.stopPropagation(); $('#pickdir').click(); };
$('#pick').onchange = (e) => { uploadAll([...e.target.files].map((f) => ({ file: f, rel: f.name }))); e.target.value = ''; };
$('#pickdir').onchange = (e) => { uploadAll([...e.target.files].map((f) => ({ file: f, rel: f.webkitRelativePath || f.name }))); e.target.value = ''; };

let dc = 0;
addEventListener('dragenter', (e) => { if (e.dataTransfer.types.includes('Files')) { dc++; $('#overlay').classList.remove('hidden'); } });
addEventListener('dragleave', () => { if (--dc <= 0) { dc = 0; $('#overlay').classList.add('hidden'); } });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => {
  e.preventDefault(); dc = 0; $('#overlay').classList.add('hidden');
  if ($('#app').classList.contains('hidden')) return;
  const ents = [...(e.dataTransfer.items || [])].filter((i) => i.kind === 'file').map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!ents.length) { uploadAll([...e.dataTransfer.files].map((f) => ({ file: f, rel: f.name }))); return; }
  (async () => {
    const out = { files: [], dirs: [] };
    for (const en of ents) await walk(en, '', out);
    uploadAll(out.files, out.dirs);
  })().catch(() => toast('Could not read dropped folder', 'err'));
});

/* ================= load ================= */
async function refresh(anim) {
  try {
    const data = await api(urlFor('files', cwd));
    items = data.items;
    archiveView = data.archiveView;
    const sizeGeneration = ++folderSizeGeneration;
    $('#archive-view-bar').classList.toggle('hidden', !archiveView);
    if (archiveView)
      $('#archive-view-label').textContent = (archiveView.decompiled ? 'Decompiled JAR workspace: ' : 'Temporary workspace: ') +
        (archiveView.decompiled
          ? archiveView.name + ' · Cached after closing until 2 hours idle; the original JAR is unchanged.'
          : archiveView.name + ' · Edits are discarded when closed or idle for 2 hours.');
    render(anim);
    loadFolderSizes(cwd, sizeGeneration);
  }
  catch (e) { if (e.message === 'Folder not found' && cwd) { go(''); return; } }
  try {
    const s = await api('/api/storage');
    if (s.total) {
      const rawPercent = Number.isFinite(s.percent) ? s.percent : (s.total - s.free) / s.total * 100;
      const usedPercent = Math.max(0, Math.min(100, rawPercent));
      $('#sfill').style.width = usedPercent + '%';
      $('#sdisk-pct').textContent = Math.round(usedPercent) + '%';
      $('#stext').textContent = fmt(s.free) + ' free of ' + fmt(s.total);
    } else {
      $('#sfill').style.width = '0%';
      $('#sdisk-pct').textContent = '--%';
      $('#stext').textContent = fmt(s.used) + ' used · volume capacity unavailable';
    }
  } catch {}
}
async function init() {
  try { const me = await api('/api/me', {}, false); $('#whoami').textContent = me.username; } catch { showLogin(); return; }
  cwd = hashPath();
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); document.body.classList.add('in-app');
  appVisible = true; applyView(); refresh(true); startPolling();
}
init();