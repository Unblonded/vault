const express = require('express');
const { ZipArchive } = require('archiver');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline, Transform } = require('stream');
const { execFile } = require('child_process');
const { Worker } = require('worker_threads');
const yauzl = require('yauzl');
const si = require('systeminformation');

// ================= CONFIG =================
const { USERS = [] } = require('./login');
const PORT = 5500;
const HOST = process.env.HOST || '0.0.0.0';   // listen on LAN interfaces; set HOST=127.0.0.1 for localhost-only access
const LEGACY_WINDOWS_FILES = 'D:\\cloudbox';
const DEFAULT_FILES = process.platform === 'win32' && fs.existsSync(LEGACY_WINDOWS_FILES)
  ? LEGACY_WINDOWS_FILES
  : path.join(__dirname, 'storage');
const FILES = path.resolve(process.env.STORAGE_DIR || DEFAULT_FILES);
const SEVEN_ZIP_EXECUTABLES = process.env.SEVEN_ZIP_PATH
  ? [process.env.SEVEN_ZIP_PATH]
  : process.platform === 'win32'
    ? [[
      path.join(process.env.ProgramFiles || 'C:\\Program Files', '7-Zip', '7z.exe'),
      process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], '7-Zip', '7z.exe'),
      '7z.exe',
    ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || '7z.exe']
    : ['7z', '7zz'];
// ==========================================

const DATA = path.join(__dirname, 'data');
const SECRET_FILE = path.join(DATA, 'secret.key');
const SHARE_FILE = path.join(DATA, 'shares.json');
fs.mkdirSync(DATA, { recursive: true });
const archiveViews = new Map();
const ARCHIVE_VIEW_IDLE_MS = 2 * 60 * 60 * 1000;
const MAX_BULK_DOWNLOAD_FILES = 5000;
const MAX_JAR_DECOMPILE_CLASSES = 2000;
const MAX_JAR_DECOMPILE_BYTES = 128 * 1024 * 1024;
const MAX_JAR_DECOMPILED_BYTES = 256 * 1024 * 1024;
const MAX_FOLDER_SIZE_REQUESTS = 500;
const MAX_FOLDER_SIZE_SCAN_ENTRIES = 500000;
const MAX_COPY_ITEMS = 500;
const MAX_COPY_ENTRIES = 500000;

if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
const SECRET = fs.readFileSync(SECRET_FILE, 'utf8');
if (!Array.isArray(USERS)) throw new Error('USERS in login.js must be an array');
const configuredUsers = USERS;
const accounts = new Map();
const usernames = new Set();
for (const user of configuredUsers) {
  if (!user || typeof user.USERNAME !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(user.USERNAME) ||
      typeof user.PASSWORD !== 'string' || !user.PASSWORD) {
    throw new Error('Each USERS entry in login.js must have a valid USERNAME and non-empty PASSWORD');
  }
  const key = user.USERNAME.toLowerCase();
  if (usernames.has(key)) throw new Error('Duplicate username in login.js: ' + user.USERNAME);
  usernames.add(key);
  accounts.set(user.USERNAME, { passwordHash: bcrypt.hashSync(user.PASSWORD, 12) });
}
if (!accounts.size) throw new Error('Add at least one account to USERS in login.js');

const userDir = (username) => path.join(FILES, username);
for (const username of accounts.keys()) {
  const dir = userDir(username);
  fs.mkdirSync(dir, { recursive: true });
  fs.rmSync(path.join(dir, '.vault-tmp'), { recursive: true, force: true });  // drop leftovers from a previous run
}

const shares = new Map();
if (fs.existsSync(SHARE_FILE)) {
  const savedShares = JSON.parse(fs.readFileSync(SHARE_FILE, 'utf8'));
  if (!Array.isArray(savedShares)) throw new Error('data/shares.json must contain an array');
  for (const [id, share] of savedShares) {
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id) || !share ||
        typeof share.username !== 'string' || typeof share.rel !== 'string' ||
        !(share.maxUses === null || Number.isSafeInteger(share.maxUses) && share.maxUses > 0) ||
        !Number.isSafeInteger(share.uses) || share.uses < 0 || typeof share.createdAt !== 'string' ||
        !share.token || typeof share.token.iv !== 'string' || typeof share.token.tag !== 'string' || typeof share.token.value !== 'string') {
      throw new Error('Invalid share entry in data/shares.json');
    }
    shares.set(id, share);
  }
}
const shareKey = crypto.createHash('sha256').update(SECRET).digest();
function sealToken(token, id) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', shareKey, iv);
  cipher.setAAD(Buffer.from(id));
  const value = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), value: value.toString('base64') };
}
function unsealToken(encrypted, id) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', shareKey, Buffer.from(encrypted.iv, 'base64'));
  decipher.setAAD(Buffer.from(id));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted.value, 'base64')), decipher.final()]).toString('utf8');
}
function saveShares() {
  const temp = SHARE_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify([...shares]));
  fs.renameSync(temp, SHARE_FILE);
}

const app = express();
app.set('trust proxy', 1); // one reverse proxy/tunnel in front; remove if you connect directly
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const httpErr = (status, message) => Object.assign(new Error(message), { status });

// ---------- live traffic stats (measured on the server sockets) ----------
const SAMPLE_MS = 500, HIST = 120;               // 120 samples x 500ms = last 60s
const stats = { up: Array(HIST).fill(0), down: Array(HIST).fill(0), totalUp: 0, totalDown: 0 };
const transfers = new Set();
let accUp = 0, accDown = 0;

function drain(t) {
  const c = t.dir === 'up' ? t.sock.bytesRead : t.sock.bytesWritten;
  const d = Math.max(0, c - t.last);
  t.last = c;
  if (t.dir === 'up') accUp += d; else accDown += d;
}
function track(req, res, dir) {
  const sock = req.socket;
  const t = { sock, dir, last: dir === 'up' ? sock.bytesRead : sock.bytesWritten };
  transfers.add(t);
  res.on('close', () => { drain(t); transfers.delete(t); });
}
setInterval(() => {
  for (const t of transfers) drain(t);
  stats.up.push(Math.round(accUp * 1000 / SAMPLE_MS)); stats.up.shift();
  stats.down.push(Math.round(accDown * 1000 / SAMPLE_MS)); stats.down.shift();
  stats.totalUp += accUp; stats.totalDown += accDown;
  accUp = accDown = 0;
}, SAMPLE_MS).unref();

// ---------- auth ----------
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false });

app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const account = accounts.get(username);
  if (!account || !(await bcrypt.compare(String(password || ''), account.passwordHash)))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ sub: username }, SECRET, { expiresIn: '30d' });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 3600 * 1000,
  });
  res.json({ username, token });
});

app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = req.cookies.token || (header.startsWith('Bearer ') ? header.slice(7) : null);
  try {
    const payload = jwt.verify(token, SECRET);
    if (typeof payload.sub !== 'string' || !accounts.has(payload.sub)) throw new Error('bad user');
    req.user = { username: payload.sub };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

app.get('/api/me', requireAuth, (req, res) => res.json({ username: req.user.username }));

// ---------- path safety ----------
const BAD_SEG = /[<>:"|?*\u0000-\u001f]/;

// strict: resolve an EXISTING-style relative path ("a/b/c") inside the authenticated user's folder
function resolveRel(username, rel) {
  const parts = String(rel || '').split(/[\\/]+/).filter(Boolean);
  for (const p of parts) if (p === '.' || p === '..' || BAD_SEG.test(p) || /[. ]$/.test(p) || p.toLowerCase() === '.vault-tmp') throw httpErr(400, 'Invalid path');
  if (parts[0] === '@archive') {
    const view = archiveViews.get(parts[1]);
    if (parts.length < 2 || !view || view.username !== username)
      throw httpErr(404, 'Temporary archive view not found');
    view.lastUsedAt = Date.now();
    return {
      full: path.join(view.root, ...parts.slice(2)),
      rel: parts.join('/'),
      archiveView: view,
    };
  }
  return { full: path.join(userDir(username), ...parts), rel: parts.join('/') };
}

// sanitize names for anything we create (files, new folders)
const cleanName = (s) =>
  String(s).normalize('NFC').replace(/[^\p{L}\p{N}_.\-() ]/gu, '_').replace(/^\.+/, '_').replace(/[. ]+$/, '').slice(0, 200) || 'unnamed';

// base = current folder (strict), sub = new sub-path to create under it (sanitized)
function targetDir(username, base, sub) {
  const { full } = resolveRel(username, base);
  const parts = String(sub || '').split(/[\\/]+/).filter((p) => p && p !== '.');
  if (parts.includes('..')) throw httpErr(400, 'Invalid path');
  return path.join(full, ...parts.map(cleanName));
}

app.get('/api/access-ok', (req, res) => {
  res.set('Cache-Control', 'no-store').type('html').send(
    '<!doctype html><meta charset="utf-8"><title>Verified</title>' +
    '<body style="margin:0;background:#06060a;color:#e6e8f0;font:14px ui-monospace,Consolas,monospace;display:grid;place-items:center;height:100vh">' +
    '<div>&#10003; Verified. You can close this window.</div>' +
    '<script>try{window.opener&&window.opener.postMessage("vault-access-ok",location.origin)}catch(e){}window.close()</script>'
  );
});

// ---------- browse / folders ----------
app.get('/api/files', requireAuth, (req, res) => {
  const resolved = resolveRel(req.user.username, req.query.path);
  const { full, rel } = resolved;
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) throw httpErr(404, 'Folder not found');
  const items = [];
  for (const d of fs.readdirSync(full, { withFileTypes: true })) {
    if (!d.isFile() && !d.isDirectory()) continue;
    if (d.name.toLowerCase() === '.vault-tmp') continue;
    try {
      const s = fs.statSync(path.join(full, d.name));
      items.push({ name: d.name, type: d.isDirectory() ? 'dir' : 'file', size: d.isDirectory() ? 0 : s.size, modified: s.mtime });
    } catch {}
  }
  const archiveView = resolved.archiveView
    ? {
      name: resolved.archiveView.name,
      sourcePath: resolved.archiveView.sourcePath,
      decompiled: Boolean(resolved.archiveView.decompiled),
    }
    : null;
  res.json({ path: rel, items, archiveView });
});

app.post('/api/folder-sizes', requireAuth, async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload.path !== 'string' || !Array.isArray(payload.folders) ||
      payload.folders.length > MAX_FOLDER_SIZE_REQUESTS)
    throw httpErr(400, 'Invalid folder size request');

  const base = resolveRel(req.user.username, payload.path);
  const baseStat = await fs.promises.lstat(base.full).catch((err) => {
    if (err.code === 'ENOENT') throw httpErr(404, 'Folder not found');
    throw err;
  });
  if (!baseStat.isDirectory() || baseStat.isSymbolicLink()) throw httpErr(404, 'Folder not found');

  let scannedEntries = 0;
  async function getDirectorySize(directory) {
    let size = 0;
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.toLowerCase() === '.vault-tmp') continue;
      scannedEntries++;
      if (scannedEntries > MAX_FOLDER_SIZE_SCAN_ENTRIES)
        throw httpErr(413, 'Folder size scan exceeded the 500,000 entry limit');
      const full = path.join(directory, entry.name);
      const stat = await fs.promises.lstat(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) size += await getDirectorySize(full);
      else if (stat.isFile()) size += stat.size;
      if (!Number.isSafeInteger(size))
        throw httpErr(413, 'Folder size exceeds the supported size range');
    }
    return size;
  }

  const sizes = [];
  const seen = new Set();
  for (const name of payload.folders) {
    if (typeof name !== 'string' || !name || /[\\/]/.test(name) || name === '.' || name === '..')
      throw httpErr(400, 'Invalid folder name');
    if (seen.has(name)) throw httpErr(400, 'Duplicate folder name');
    seen.add(name);
    const folder = resolveRel(req.user.username, path.posix.join(base.rel, name));
    const stat = await fs.promises.lstat(folder.full).catch((err) => {
      if (err.code === 'ENOENT') throw httpErr(404, 'Folder not found: ' + name);
      throw err;
    });
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw httpErr(400, 'Selected item is not a folder: ' + name);
    sizes.push({ name, size: await getDirectorySize(folder.full) });
  }
  res.set('Cache-Control', 'no-store').json({ sizes });
});

app.post('/api/mkdir', requireAuth, (req, res) => {
  const { path: base, name } = req.body || {};
  if (!String(name || '').replace(/[\\/.\s]/g, '')) throw httpErr(400, 'Folder name required');
  const dir = targetDir(req.user.username, base, name);
  const existed = fs.existsSync(dir);
  fs.mkdirSync(dir, { recursive: true });
  res.json({ created: !existed });
});

// ---------- upload ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        req._dir = targetDir(req.user.username, req.query.path, req.query.sub);
        fs.mkdirSync(req._dir, { recursive: true });
        cb(null, req._dir);
      } catch (e) { cb(e); }
    },
    filename: (req, file, cb) => {
      const orig = Buffer.from(file.originalname, 'latin1').toString('utf8'); // multer decodes names as latin1
      let name = cleanName(path.basename(orig));
      if (fs.existsSync(path.join(req._dir, name))) name = `${Date.now()}-${name}`;
      cb(null, name);
    },
  }),
});

app.post('/api/files', requireAuth, (req, res) => {
  track(req, res, 'up');
  upload.array('file', 20)(req, res, (err) => {
    if (err) return res.status(err.status || 400).json({ error: err.message });
    res.json({ uploaded: (req.files || []).map((f) => f.filename) });
  });
});

// ---------- chunked upload (big files; stays under Cloudflare's 100 MB request limit) ----------
const CHUNK = 8 * 1024 * 1024;
const sessions = new Map();

app.post('/api/upload/start', requireAuth, (req, res) => {
  const { path: base, sub, name, size } = req.body || {};
  if (!Number.isSafeInteger(size) || size < 0) throw httpErr(400, 'Invalid size');
  const dir = targetDir(req.user.username, base, sub);
  fs.mkdirSync(dir, { recursive: true });
  const tmpDir = path.join(userDir(req.user.username), '.vault-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const id = crypto.randomBytes(12).toString('hex');
  const tmp = path.join(tmpDir, id + '.part');
  fs.writeFileSync(tmp, '');
  sessions.set(id, { username: req.user.username, tmp, dir, name: cleanName(path.basename(String(name || 'file'))), size, chunks: new Map(), touched: Date.now() });
  res.json({ id, chunkSize: CHUNK });
});

const receiveUploadChunk = (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s || s.username !== req.user.username) throw httpErr(404, 'Upload session not found');
  const offset = Number(req.query.offset), contentLength = req.headers['content-length'];
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= s.size || offset % CHUNK !== 0)
    throw httpErr(400, 'Bad chunk');
  const expected = Math.min(CHUNK, s.size - offset);
  if (contentLength !== undefined && (!/^\d+$/.test(contentLength) || Number(contentLength) !== expected))
    throw httpErr(400, 'Bad chunk length');
  track(req, res, 'up');
  s.touched = Date.now();
  const ws = fs.createWriteStream(s.tmp, { flags: 'r+', start: offset });
  let received = 0;
  const limit = new Transform({
    transform(chunk, encoding, callback) {
      received += chunk.length;
      if (received > expected) callback(httpErr(400, 'Chunk too large'));
      else callback(null, chunk);
    },
  });
  pipeline(req, limit, ws, (err) => {
    if (res.writableEnded || res.destroyed) return;
    if (err) return res.status(err.status || 500).json({ error: 'Chunk failed: ' + err.message });
    if (received !== expected || ws.bytesWritten !== expected) return res.status(400).json({ error: 'Short chunk' });
    s.chunks.set(offset, expected); s.touched = Date.now();
    res.json({ ok: true });
  });
};
app.post('/api/upload/:id', requireAuth, receiveUploadChunk);
app.put('/api/upload/:id', requireAuth, receiveUploadChunk);

app.post('/api/upload/:id/finish', requireAuth, (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s || s.username !== req.user.username) throw httpErr(404, 'Upload session not found');
  let pos = 0;
  for (const o of [...s.chunks.keys()].sort((a, b) => a - b)) { if (o !== pos) break; pos += s.chunks.get(o); }
  if (pos !== s.size || fs.statSync(s.tmp).size !== s.size) throw httpErr(400, 'Upload incomplete');
  let name = s.name;
  if (fs.existsSync(path.join(s.dir, name))) name = `${Date.now()}-${name}`;
  fs.mkdirSync(s.dir, { recursive: true });
  fs.renameSync(s.tmp, path.join(s.dir, name));
  sessions.delete(req.params.id);
  res.json({ name });
});

app.delete('/api/upload/:id', requireAuth, (req, res) => {
  const s = sessions.get(req.params.id);
  if (s && s.username === req.user.username) { fs.rmSync(s.tmp, { force: true }); sessions.delete(req.params.id); }
  res.json({ ok: true });
});

setInterval(() => {   // drop abandoned sessions after 2h idle
  for (const [id, s] of sessions) if (Date.now() - s.touched > 2 * 3600 * 1000) { fs.rmSync(s.tmp, { force: true }); sessions.delete(id); }
}, 10 * 60 * 1000).unref();

// ---------- download / view / delete ----------
function resolveItem(req, wantFile) {
  const { full, rel } = resolveRel(req.user.username, req.query.path);
  if (!rel) throw httpErr(400, 'Path required');
  if (!fs.existsSync(full)) throw httpErr(404, 'Not found');
  const s = fs.statSync(full);
  if (wantFile && !s.isFile()) throw httpErr(400, 'Not a file');
  return { full, rel, name: path.basename(full), isDir: s.isDirectory() };
}

app.get('/api/shares', requireAuth, (req, res) => {
  const { rel } = resolveRel(req.user.username, req.query.path);
  const result = [...shares.entries()]
    .filter(([, share]) => share.username === req.user.username && share.rel === rel)
    .map(([id, share]) => ({ id, maxUses: share.maxUses, uses: share.uses, createdAt: share.createdAt, url: '/s/' + unsealToken(share.token, id) }));
  res.json({ shares: result });
});

app.post('/api/shares', requireAuth, (req, res) => {
  const resolved = resolveRel(req.user.username, req.query.path);
  if (resolved.archiveView) throw httpErr(400, 'Temporary archive contents cannot be shared');
  const { full, rel } = resolved;
  if (!rel) throw httpErr(400, 'Path required');
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw httpErr(404, 'File not found');
  const { maxUses = null } = req.body || {};
  if (!(maxUses === null || Number.isSafeInteger(maxUses) && maxUses > 0))
    throw httpErr(400, 'Use limit must be a positive whole number or unlimited');

  const token = crypto.randomBytes(32).toString('hex');
  const id = crypto.createHash('sha256').update(token).digest('hex');
  shares.set(id, { username: req.user.username, rel, maxUses, uses: 0, createdAt: new Date().toISOString(), token: sealToken(token, id) });
  try { saveShares(); }
  catch (e) { shares.delete(id); throw e; }
  res.json({ id, url: '/s/' + token });
});

app.delete('/api/shares/:id', requireAuth, (req, res) => {
  const share = shares.get(req.params.id);
  if (!share || share.username !== req.user.username) throw httpErr(404, 'Share link not found');
  shares.delete(req.params.id);
  try { saveShares(); }
  catch (e) { shares.set(req.params.id, share); throw e; }
  res.json({ revoked: true });
});

function findShare(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const id = crypto.createHash('sha256').update(token).digest('hex');
  const share = shares.get(id);
  if (!share || !accounts.has(share.username) || share.maxUses !== null && share.uses >= share.maxUses) return null;
  const { full } = resolveRel(share.username, share.rel);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return { id, share, full, name: path.basename(full) };
}
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[ch]);
function fmtBytes(size) {
  if (size < 1024) return size + ' B';
  if (size < 1048576) return (size / 1024).toFixed(1) + ' KB';
  if (size < 1073741824) return (size / 1048576).toFixed(1) + ' MB';
  return (size / 1073741824).toFixed(2) + ' GB';
}
const SHARE_IMAGE_TYPES = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

app.get('/s/:token', (req, res) => {
  const found = findShare(req.params.token);
  if (!found) return res.status(404).send('Share link unavailable');

  const name = escapeHtml(found.name);
  const stats = fs.statSync(found.full);
  const size = fmtBytes(stats.size);
  const imageType = SHARE_IMAGE_TYPES[path.extname(found.name).toLowerCase()];
  const shareUrl = `${req.protocol}://${req.get('host')}/s/${req.params.token}`;
  const description = escapeHtml(`${imageType ? imageType.slice(6).toUpperCase() + ' image · ' : 'Shared file · '}${size} · Download securely from VAULT.`);
  const socialImage = imageType
    ? `<meta property="og:image" content="${escapeHtml(shareUrl + '/preview')}">
<meta property="og:image:secure_url" content="${escapeHtml(shareUrl + '/preview')}">
<meta property="og:image:type" content="${imageType}">
<meta property="og:image:alt" content="${name}">`
    : '';
  res.set({
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; base-uri 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="VAULT">
<meta property="og:title" content="${name}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${escapeHtml(shareUrl)}">
<meta name="twitter:card" content="${imageType ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${name}">
<meta name="twitter:description" content="${description}">
${socialImage}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Press+Start+2P&display=swap" rel="stylesheet">
<title>Shared file · VAULT</title>
<link rel="stylesheet" href="/share.css">
</head>
<body><main>
<div class="brand"><img src="/favicon.svg" alt="" width="28" height="28"> VAULT</div>
<div class="tag">A FILE HAS BEEN SHARED WITH YOU</div>
<h1>${name}</h1>
<div class="meta">${escapeHtml(size)} · Download starts only when you choose below.</div>
<a class="button" href="/s/${req.params.token}/download" rel="noreferrer">Download file</a>
<p class="note">This link may have a limited number of downloads.</p>
</main></body>
</html>`);
});

app.get('/s/:token/preview', (req, res) => {
  const found = findShare(req.params.token);
  if (!found) return res.status(404).send('Share link unavailable');
  const contentType = SHARE_IMAGE_TYPES[path.extname(found.name).toLowerCase()];
  if (!contentType) return res.status(404).send('Preview unavailable');
  res.set({
    'Cache-Control': 'no-store',
    'Content-Disposition': 'inline',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.type(contentType);
  res.sendFile(found.full, { dotfiles: 'allow' });
});

app.head('/s/:token/download', (req, res) => {
  const found = findShare(req.params.token);
  if (!found) return res.sendStatus(404);
  res.set({
    'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(found.name)}"`,
    'Content-Length': String(fs.statSync(found.full).size),
  }).end();
});

app.get('/s/:token/download', (req, res) => {
  const found = findShare(req.params.token);
  if (!found) return res.status(404).send('Share link unavailable');

  found.share.uses++;
  try { saveShares(); }
  catch (e) { found.share.uses--; throw e; }
  res.set('Cache-Control', 'no-store');
  track(req, res, 'down');
  res.download(found.full, found.name, { dotfiles: 'allow' });
});

app.get('/api/download', requireAuth, (req, res) => {
  const f = resolveItem(req, true);
  track(req, res, 'down');
  res.download(f.full, f.name, { dotfiles: 'allow' });
});

// inline view; HTML/SVG/XML get sandboxed so uploaded scripts can't run
const SANDBOX_EXT = new Set(['.html', '.htm', '.xhtml', '.svg', '.xml']);
app.get('/api/view', requireAuth, (req, res) => {
  const f = resolveItem(req, true);
  track(req, res, 'down');
  const headers = { 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' };
  if (SANDBOX_EXT.has(path.extname(f.name).toLowerCase()))
    headers['Content-Security-Policy'] = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";
  res.sendFile(f.full, { headers, dotfiles: 'allow' });
});

app.delete('/api/item', requireAuth, (req, res) => {
  const f = resolveItem(req, false);
  if (f.isDir) fs.rmSync(f.full, { recursive: true, force: true });
  else fs.unlinkSync(f.full);
  for (const [id, share] of shares) {
    if (share.username === req.user.username && (share.rel === f.rel || f.isDir && share.rel.startsWith(f.rel + '/')))
      shares.delete(id);
  }
  saveShares();
  res.json({ deleted: f.rel });
});

app.patch('/api/item', requireAuth, (req, res) => {
  const resolved = resolveRel(req.user.username, req.query.path);
  if (!resolved.rel || resolved.archiveView) throw httpErr(400, 'Cannot rename this item');
  const root = userDir(req.user.username);
  const parts = resolved.rel.split('/');
  let current = root;
  let stat = fs.lstatSync(root);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw httpErr(400, 'Invalid item path');
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    try { stat = fs.lstatSync(current); }
    catch (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') throw httpErr(404, 'Not found');
      throw err;
    }
    if (stat.isSymbolicLink()) throw httpErr(400, 'Symbolic links cannot be renamed');
    if (i < parts.length - 1 && !stat.isDirectory()) throw httpErr(400, 'Invalid item path');
  }
  if (!stat.isFile() && !stat.isDirectory()) throw httpErr(400, 'Unsupported item type');
  const f = {
    ...resolved,
    name: path.basename(resolved.full),
    isDir: stat.isDirectory(),
  };
  const requestedName = req.body && req.body.name;
  if (typeof requestedName !== 'string' || !requestedName.trim()) throw httpErr(400, 'Name required');
  if (/[\\/]/.test(requestedName)) throw httpErr(400, 'Name cannot contain a path');
  const name = cleanName(requestedName.trim());
  if (name.toLowerCase() === '.vault-tmp') throw httpErr(400, 'Invalid file name');
  if (name === f.name) return res.json({ renamed: false, name });

  const destination = path.join(path.dirname(f.full), name);
  if (fs.existsSync(destination)) throw httpErr(409, 'A file with that name already exists');
  const nextRel = path.posix.join(path.posix.dirname(f.rel) === '.' ? '' : path.posix.dirname(f.rel), name);
  const movedShares = [];
  fs.renameSync(f.full, destination);
  for (const [id, share] of shares) {
    if (share.username === req.user.username &&
        (share.rel === f.rel || f.isDir && share.rel.startsWith(f.rel + '/'))) {
      movedShares.push([id, share.rel]);
      share.rel = nextRel + share.rel.slice(f.rel.length);
    }
  }

  try { saveShares(); }
  catch (e) {
    fs.renameSync(destination, f.full);
    for (const [id, rel] of movedShares) {
      const share = shares.get(id);
      if (share) share.rel = rel;
    }
    throw e;
  }
  res.json({ renamed: true, name, path: nextRel });
});

app.post('/api/move', requireAuth, async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload.from !== 'string' || typeof payload.to !== 'string' ||
      !Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 500)
    throw httpErr(400, 'Select between 1 and 500 items to move');

  const sourceDir = resolveRel(req.user.username, payload.from);
  const destinationDir = resolveRel(req.user.username, payload.to);
  const sourceStat = await fs.promises.lstat(sourceDir.full).catch((err) => {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') throw httpErr(404, 'Source folder not found');
    throw err;
  });
  const destinationStat = await fs.promises.lstat(destinationDir.full).catch((err) => {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') throw httpErr(404, 'Destination folder not found');
    throw err;
  });
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw httpErr(400, 'Source must be a folder');
  if (!destinationStat.isDirectory() || destinationStat.isSymbolicLink())
    throw httpErr(400, 'Destination must be a folder');

  const plans = [];
  const names = new Set();
  for (const name of payload.items) {
    if (typeof name !== 'string' || !name || /[\\/]/.test(name) || name === '.' || name === '..')
      throw httpErr(400, 'Invalid item name');
    if (name.toLowerCase() === '.vault-tmp') throw httpErr(400, 'Invalid item name');
    if (names.has(name.toLowerCase())) throw httpErr(400, 'Duplicate item name');
    names.add(name.toLowerCase());

    const sourceRel = path.posix.join(sourceDir.rel, name);
    const source = resolveRel(req.user.username, sourceRel);
    const sourceStat = await fs.promises.lstat(source.full).catch((err) => {
      if (err.code === 'ENOENT') throw httpErr(404, 'Item not found: ' + name);
      throw err;
    });
    if (!sourceStat.isFile() && !sourceStat.isDirectory())
      throw httpErr(400, 'Unsupported item type: ' + name);
    if (sourceStat.isSymbolicLink()) throw httpErr(400, 'Symbolic links cannot be moved');

    const destination = path.join(destinationDir.full, name);
    const nextRel = path.posix.join(destinationDir.rel, name);
    const relative = path.relative(source.full, destinationDir.full);
    if (sourceStat.isDirectory() && (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)))
      throw httpErr(400, 'A folder cannot be moved into itself');
    if (path.resolve(source.full) === path.resolve(destination)) continue;
    if (await fs.promises.lstat(destination).then(() => true, (err) => {
      if (err.code === 'ENOENT') return false;
      throw err;
    })) throw httpErr(409, 'An item named "' + name + '" already exists in the destination folder');
    plans.push({ name, source: source.full, sourceRel: source.rel, destination, nextRel });
  }

  const moved = [];
  const changedShares = [];
  const removedShares = [];
  try {
    for (const plan of plans) {
      await fs.promises.rename(plan.source, plan.destination);
      moved.push(plan);
    }
    for (const [id, share] of shares) {
      if (share.username !== req.user.username) continue;
      for (const plan of plans) {
        if (share.rel === plan.sourceRel || share.rel.startsWith(plan.sourceRel + '/')) {
          if (plan.nextRel.startsWith('@archive/')) {
            removedShares.push([id, share]);
            shares.delete(id);
          } else {
            changedShares.push([id, share.rel]);
            share.rel = plan.nextRel + share.rel.slice(plan.sourceRel.length);
          }
          break;
        }
      }
    }
    if (changedShares.length || removedShares.length) saveShares();
  } catch (err) {
    for (const [id, rel] of changedShares) {
      const share = shares.get(id);
      if (share) share.rel = rel;
    }
    for (const [id, share] of removedShares) shares.set(id, share);
    for (const plan of moved.reverse()) {
      try { await fs.promises.rename(plan.destination, plan.source); }
      catch (rollbackError) { console.error('Could not roll back moved item:', rollbackError); }
    }
    throw err;
  }
  res.json({ moved: plans.map((plan) => plan.nextRel), count: plans.length });
});

app.post('/api/copy', requireAuth, async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload.from !== 'string' || typeof payload.to !== 'string' ||
      !Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > MAX_COPY_ITEMS)
    throw httpErr(400, 'Select between 1 and ' + MAX_COPY_ITEMS + ' items to copy');

  const sourceDir = resolveRel(req.user.username, payload.from);
  const destinationDir = resolveRel(req.user.username, payload.to);
  if (destinationDir.archiveView) throw httpErr(400, 'Cannot copy into a temporary archive view');
  async function ensureNoSymlinkPath(root, full) {
    const relative = path.relative(root, full);
    if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep))
      throw httpErr(400, 'Copy path is outside the permitted folder');
    let stat = await fs.promises.lstat(root);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw httpErr(400, 'Copy path is not a permitted folder');
    let current = root;
    const segments = relative ? relative.split(path.sep) : [];
    for (let i = 0; i < segments.length; i++) {
      current = path.join(current, segments[i]);
      stat = await fs.promises.lstat(current);
      if (stat.isSymbolicLink()) throw httpErr(400, 'Symbolic links cannot be used in copy paths');
      if (i < segments.length - 1 && !stat.isDirectory())
        throw httpErr(400, 'Copy path is not a folder');
    }
  }
  const sourceRoot = sourceDir.archiveView ? sourceDir.archiveView.root : userDir(req.user.username);
  const destinationRoot = userDir(req.user.username);
  await ensureNoSymlinkPath(sourceRoot, sourceDir.full);
  await ensureNoSymlinkPath(destinationRoot, destinationDir.full);
  const sourceStat = await fs.promises.lstat(sourceDir.full).catch((err) => {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') throw httpErr(404, 'Source folder not found');
    throw err;
  });
  const destinationStat = await fs.promises.lstat(destinationDir.full).catch((err) => {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') throw httpErr(404, 'Destination folder not found');
    throw err;
  });
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw httpErr(400, 'Source must be a folder');
  if (!destinationStat.isDirectory() || destinationStat.isSymbolicLink())
    throw httpErr(400, 'Destination must be a folder');

  const plans = [];
  const sourceNames = new Set();
  const nameKey = (name) => process.platform === 'win32' || process.platform === 'darwin'
    ? name.toLowerCase()
    : name;
  const occupiedNames = new Set((await fs.promises.readdir(destinationDir.full)).map(nameKey));
  for (const name of payload.items) {
    if (typeof name !== 'string' || !name || /[\\/]/.test(name) || name === '.' || name === '..' ||
        name.toLowerCase() === '.vault-tmp')
      throw httpErr(400, 'Invalid item name');
    const key = nameKey(name);
    if (sourceNames.has(key)) throw httpErr(400, 'Duplicate item name');
    sourceNames.add(key);

    const sourceRel = path.posix.join(sourceDir.rel, name);
    const source = resolveRel(req.user.username, sourceRel);
    const itemStat = await fs.promises.lstat(source.full).catch((err) => {
      if (err.code === 'ENOENT') throw httpErr(404, 'Item not found: ' + name);
      throw err;
    });
    if (!itemStat.isFile() && !itemStat.isDirectory())
      throw httpErr(400, 'Unsupported item type: ' + name);
    if (itemStat.isSymbolicLink()) throw httpErr(400, 'Symbolic links cannot be copied');
    if (itemStat.isDirectory()) {
      const relative = path.relative(source.full, destinationDir.full);
      if (!relative || !path.isAbsolute(relative) && relative !== '..' &&
          !relative.startsWith('..' + path.sep))
        throw httpErr(400, 'A folder cannot be copied into itself');
    }

    let destinationName = name;
    if (occupiedNames.has(nameKey(destinationName))) {
      const parsed = path.parse(name);
      const makeCopyName = (number) =>
        'Copy' + (number > 1 ? ' (' + number + ')' : '') + ' - ' + parsed.name + parsed.ext;
      for (let suffix = 1; ; suffix++) {
        destinationName = makeCopyName(suffix);
        if (!occupiedNames.has(nameKey(destinationName))) break;
      }
    }
    occupiedNames.add(nameKey(destinationName));
    plans.push({
      source: source.full,
      destination: path.join(destinationDir.full, destinationName),
      name: destinationName,
      nextRel: path.posix.join(destinationDir.rel, destinationName),
    });
  }

  const stagingRoot = path.join(userDir(req.user.username), '.vault-tmp', 'copy-' + crypto.randomBytes(16).toString('hex'));
  await fs.promises.mkdir(stagingRoot, { recursive: true });
  let scannedEntries = 0;
  async function copyEntry(source, destination) {
    const stat = await fs.promises.lstat(source);
    if (stat.isSymbolicLink()) throw httpErr(400, 'Selected folders contain symbolic links and cannot be copied');
    if (stat.isFile()) {
      await fs.promises.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
      return;
    }
    if (!stat.isDirectory()) throw httpErr(400, 'Selected folders contain unsupported file types');
    await fs.promises.mkdir(destination);
    for (const entry of await fs.promises.readdir(source, { withFileTypes: true })) {
      if (entry.name.toLowerCase() === '.vault-tmp') continue;
      scannedEntries++;
      if (scannedEntries > MAX_COPY_ENTRIES)
        throw httpErr(413, 'Copy exceeded the 500,000 entry limit');
      await copyEntry(path.join(source, entry.name), path.join(destination, entry.name));
    }
  }

  const staged = [];
  const created = [];
  try {
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      const temporary = path.join(stagingRoot, String(i));
      await copyEntry(plan.source, temporary);
      staged.push({ ...plan, temporary });
    }
    for (const plan of staged) {
      const destinationExists = await fs.promises.lstat(plan.destination).then(
        () => true,
        (err) => {
          if (err.code === 'ENOENT') return false;
          throw err;
        }
      );
      if (destinationExists)
        throw httpErr(409, 'A copy destination already exists; refresh the folder and try again');
      await fs.promises.rename(plan.temporary, plan.destination);
      created.push(plan.destination);
    }
  } catch (err) {
    for (const destination of created.reverse()) {
      try { await fs.promises.rm(destination, { recursive: true, force: true }); }
      catch (rollbackError) { console.error('Could not roll back copied item:', rollbackError); }
    }
    if (err.status) throw err;
    if (err.code === 'EEXIST' || err.code === 'ENOTEMPTY')
      throw httpErr(409, 'A copy destination already exists; refresh the folder and try again');
    throw err;
  } finally {
    try { await fs.promises.rm(stagingRoot, { recursive: true, force: true }); }
    catch (err) { console.error('Could not remove copy staging directory:', err); }
  }
  res.json({ copied: plans.map((plan) => plan.nextRel), count: plans.length });
});

async function collectDirectoryEntries(directory, archivePath, collected, maxFiles = Infinity, fileCounter = { count: 0 }) {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  if (!entries.length) {
    collected.push({ path: archivePath.replace(/\\/g, '/') + '/', directory: true });
    return;
  }
  for (const entry of entries) {
    if (entry.name.toLowerCase() === '.vault-tmp') continue;
    const full = path.join(directory, entry.name);
    const stat = await fs.promises.lstat(full);
    if (stat.isSymbolicLink()) continue;
    const nextArchivePath = archivePath + '/' + entry.name;
    if (stat.isDirectory()) await collectDirectoryEntries(full, nextArchivePath, collected, maxFiles, fileCounter);
    else if (stat.isFile()) {
      collected.push({ source: full, path: nextArchivePath.replace(/\\/g, '/') });
      fileCounter.count++;
      if (fileCounter.count > maxFiles)
        throw httpErr(413, 'Bulk download is limited to ' + maxFiles + ' files at a time');
    }
  }
}

async function collectSelectedArchiveEntries(username, basePath, items, maxFiles = Infinity) {
  if (typeof basePath !== 'string' || !Array.isArray(items) || items.length < 1 || items.length > 500)
    throw httpErr(400, 'Select between 1 and 500 items');

  const base = resolveRel(username, basePath);
  const baseStat = await fs.promises.stat(base.full).catch((err) => {
    if (err.code === 'ENOENT') throw httpErr(404, 'Folder not found');
    throw err;
  });
  if (!baseStat.isDirectory()) throw httpErr(404, 'Folder not found');
  const collected = [];
  const fileCounter = { count: 0 };
  const names = new Set();
  let archiveBase = 'Archive';
  for (const item of items) {
    if (typeof item !== 'string' || !item || /[\\/]/.test(item) || item === '.' || item === '..')
      throw httpErr(400, 'Invalid item name');
    if (names.has(item)) throw httpErr(400, 'Duplicate item name');
    names.add(item);
    const rel = path.posix.join(base.rel, item);
    const { full } = resolveRel(username, rel);
    const stat = await fs.promises.lstat(full).catch((err) => {
      if (err.code === 'ENOENT') throw httpErr(404, 'Item not found: ' + item);
      throw err;
    });
    if (stat.isSymbolicLink()) throw httpErr(400, 'Symbolic links are not supported for this operation');
    if (items.length === 1)
      archiveBase = stat.isDirectory() ? item : path.parse(item).name;
    if (stat.isDirectory()) await collectDirectoryEntries(full, item, collected, maxFiles, fileCounter);
    else if (stat.isFile()) {
      collected.push({ source: full, path: item });
      fileCounter.count++;
    }
    else throw httpErr(400, 'Unsupported item type: ' + item);
    if (fileCounter.count > maxFiles)
      throw httpErr(413, 'Bulk download is limited to ' + maxFiles + ' files at a time');
  }
  return { base, archiveBase, collected };
}

app.post('/api/download-items', requireAuth, async (req, res) => {
  const payload = req.body;
  if (!payload) throw httpErr(400, 'Invalid download request');
  const { base, collected } = await collectSelectedArchiveEntries(
    req.user.username, payload.path, payload.items, MAX_BULK_DOWNLOAD_FILES
  );
  const files = collected
    .filter((entry) => !entry.directory)
    .map((entry) => path.posix.join(base.rel, entry.path));
  if (!files.length) throw httpErr(400, 'The selected folders contain no downloadable files');
  res.set('Cache-Control', 'no-store');
  res.json({ files });
});

async function writeSelectedZip(collected, tempPath) {
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const output = fs.createWriteStream(tempPath, { flags: 'wx' });
  const failArchiveOutput = (err) => output.destroy(err);
  archive.on('warning', failArchiveOutput);
  archive.on('error', failArchiveOutput);
  archive.pipe(output);
  const completed = require('stream/promises').finished(output);
  try {
    for (const entry of collected) {
      if (entry.directory) archive.append(Buffer.alloc(0), { name: entry.path, mode: 0o40755 });
      else archive.file(entry.source, { name: entry.path });
    }
    archive.finalize();
    await completed;
  } catch (err) {
    archive.abort();
    throw err;
  }
}

app.post('/api/archive', requireAuth, async (req, res) => {
  const payload = req.body;
  if (!payload) throw httpErr(400, 'Invalid archive request');
  const { base, archiveBase, collected } = await collectSelectedArchiveEntries(req.user.username, payload.path, payload.items);
  const archiveName = cleanName(archiveBase) + '.zip';
  const tempDir = path.join(userDir(req.user.username), '.vault-tmp');
  await fs.promises.mkdir(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, 'archive-' + crypto.randomBytes(16).toString('hex') + '.zip');
  try {
    await writeSelectedZip(collected, tempPath);

    let destination, name;
    for (let suffix = 1; ; suffix++) {
      name = suffix === 1
        ? archiveName
        : cleanName(archiveBase + ' (' + suffix + ')') + '.zip';
      destination = path.join(base.full, name);
      try {
        await fs.promises.link(tempPath, destination);
        break;
      } catch (err) {
        if (err.code === 'EEXIST') continue;
        throw err;
      }
    }
    res.json({ created: path.posix.join(base.rel, name), name });
  } finally {
    await fs.promises.unlink(tempPath).catch((err) => {
      if (err.code !== 'ENOENT') console.error('Could not remove temporary ZIP archive:', err);
    });
  }
});

function validateArchiveEntries(entries) {
  const paths = new Map();
  const explicit = new Set();
  for (const entry of entries) {
    const isDirectory = entry.fileName.endsWith('/');
    const name = isDirectory ? entry.fileName.slice(0, -1) : entry.fileName;
    if (!name || name.includes('\\') || yauzl.validateFileName(entry.fileName))
      throw httpErr(400, 'ZIP contains an unsafe path');
    const parts = name.split('/');
    for (const part of parts) {
      if (!part || part === '.' || part === '..' || BAD_SEG.test(part) || /[. ]$/.test(part) ||
          part.toLowerCase() === '.vault-tmp' || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\\.|$)/i.test(part))
        throw httpErr(400, 'ZIP contains an unsafe path');
    }
    const unixMode = entry.externalFileAttributes >>> 16;
    const fileType = unixMode & 0o170000;
    if (fileType && fileType !== 0o100000 && fileType !== 0o040000)
      throw httpErr(400, 'ZIP contains an unsupported file type');
    const key = parts.join('/').toLowerCase();
    if (explicit.has(key)) throw httpErr(400, 'ZIP contains duplicate paths');
    explicit.add(key);
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(0, i).join('/').toLowerCase();
      if (paths.get(parent) === 'file') throw httpErr(400, 'ZIP contains conflicting paths');
      paths.set(parent, 'directory');
    }
    const kind = isDirectory ? 'directory' : 'file';
    if (paths.has(key) && paths.get(key) !== kind) throw httpErr(400, 'ZIP contains conflicting paths');
    paths.set(key, kind);
  }
  return paths;
}

async function openZipFile(file) {
  try {
    return await yauzl.openPromise(file, { lazyEntries: true, validateEntrySizes: true });
  } catch {
    throw httpErr(400, 'Could not read ZIP archive');
  }
}

async function extractZipToDirectory(archivePath, destination) {
  const entries = [];
  const zipfile = await openZipFile(archivePath);
  try {
    for await (const entry of zipfile.eachEntry()) {
      entries.push(entry);
      if (entries.length > MAX_ARCHIVE_ENTRIES) throw httpErr(400, 'Archive contains too many entries');
    }
  } catch (err) {
    if (err.status) throw err;
    throw httpErr(400, 'Could not read ZIP archive safely');
  } finally {
    if (zipfile.isOpen) zipfile.close();
  }
  validateArchiveEntries(entries);
  let expandedBytes = 0;
  for (const entry of entries) {
    expandedBytes += entry.uncompressedSize;
    if (!Number.isSafeInteger(expandedBytes) || expandedBytes > MAX_EXTRACTED_BYTES)
      throw httpErr(400, 'Archive expands beyond the 10 GB extraction limit');
  }

  try {
    const extractZip = await openZipFile(archivePath);
    let entryIndex = 0;
    try {
      for await (const entry of extractZip.eachEntry()) {
        const expectedEntry = entries[entryIndex++];
        if (!expectedEntry || entry.fileName !== expectedEntry.fileName ||
            entry.uncompressedSize !== expectedEntry.uncompressedSize || entry.crc32 !== expectedEntry.crc32)
          throw httpErr(400, 'ZIP archive changed during extraction');
        const isDirectory = entry.fileName.endsWith('/');
        const name = isDirectory ? entry.fileName.slice(0, -1) : entry.fileName;
        const fullPath = path.resolve(destination, ...name.split('/'));
        const relative = path.relative(destination, fullPath);
        if (!relative || relative.startsWith('..' + path.sep) || path.isAbsolute(relative))
          throw httpErr(400, 'ZIP contains an unsafe path');
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        if (isDirectory) {
          await fs.promises.mkdir(fullPath, { recursive: true });
          continue;
        }
        const readStream = await extractZip.openReadStreamPromise(entry);
        await require('stream/promises').pipeline(readStream, fs.createWriteStream(fullPath, { flags: 'wx' }));
      }
      if (entryIndex !== entries.length) throw httpErr(400, 'ZIP archive changed during extraction');
    } finally {
      if (extractZip.isOpen) extractZip.close();
    }
  } catch (err) {
    if (err.status) throw err;
    throw httpErr(400, 'Could not extract ZIP archive');
  }
}

const SEVEN_ZIP_EXTENSIONS = new Set([
  '.7z', '.arj', '.bz2', '.cab', '.chm', '.cpio', '.cramfs', '.deb', '.dmg', '.fat', '.gz',
  '.hfs', '.iso', '.lha', '.lzh', '.lzma', '.nsis', '.ntfs', '.rar', '.rpm', '.squashfs',
  '.tar', '.tar.bz2', '.tar.gz', '.tar.xz', '.taz', '.tbz', '.tbz2', '.tgz', '.tlz', '.txz', '.udf', '.vhd', '.vhdx',
  '.wim', '.xar', '.xz', '.z',
]);
const SEVEN_ZIP_COMPOUND_EXTENSIONS = ['.tar.bz2', '.tar.gz', '.tar.xz'];
const MAX_ARCHIVE_ENTRIES = 20000;
const MAX_EXTRACTED_BYTES = 10 * 1024 * 1024 * 1024;

function archiveExtension(name) {
  const lower = name.toLowerCase();
  return SEVEN_ZIP_COMPOUND_EXTENSIONS.find((extension) => lower.endsWith(extension)) ||
    path.extname(lower);
}

function runSevenZip(args, { maxBuffer = 16 * 1024 * 1024, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const options = { maxBuffer, timeout, encoding: 'utf8' };
    if (process.platform === 'win32') options.windowsHide = true;
    let executableIndex = 0;
    const run = () => execFile(SEVEN_ZIP_EXECUTABLES[executableIndex], args, options, (err, stdout, stderr) => {
      if (!err) return resolve({ stdout, stderr });
      if (err.code === 'ENOENT' && executableIndex + 1 < SEVEN_ZIP_EXECUTABLES.length) {
        executableIndex++;
        return run();
      }
      if (err.code === 'ENOENT')
        return reject(httpErr(503, '7-Zip is not installed or was not found. Install it on the server or set SEVEN_ZIP_PATH.'));
      if (err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER')
        return reject(httpErr(400, 'Archive listing is too large to process safely'));
      if (err.killed) return reject(httpErr(400, 'Archive processing timed out'));
      reject(httpErr(400, '7-Zip could not process this archive'));
    });
    run();
  });
}

function validateSevenZipEntries(output) {
  const records = output.split(/\r?\n\r?\n/);
  const entries = [];
  for (const record of records) {
    const properties = new Map();
    for (const line of record.split(/\r?\n/)) {
      const separator = line.indexOf(' = ');
      if (separator >= 0) properties.set(line.slice(0, separator), line.slice(separator + 3));
    }
    if (!properties.has('Folder') && !properties.has('Size')) continue;
    const rawName = properties.get('Path');
    if (!rawName || ['Symbolic Link', 'Hard Link', 'Alternate Stream', 'Reparse Point']
      .some((property) => properties.get(property)))
      throw httpErr(400, 'Archive contains an unsupported entry');
    const modeText = properties.get('Mode') || '';
    if (/^(?:[lbcp]|s)/i.test(modeText)) throw httpErr(400, 'Archive contains an unsupported file type');
    const mode = /^\d+$/.test(modeText) ? Number.parseInt(modeText, 8) : 0;
    const fileType = mode & 0o170000;
    if (fileType && fileType !== 0o100000 && fileType !== 0o040000)
      throw httpErr(400, 'Archive contains an unsupported file type');

    const normalized = rawName.replace(/\\/g, '/');
    if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized))
      throw httpErr(400, 'Archive contains an unsafe path');
    const attributes = properties.get('Attributes') || '';
    const isDirectory = properties.get('Folder') === '+' || /^D(?:\s|$)/.test(attributes);
    const name = isDirectory ? normalized.replace(/\/+$/, '') : normalized;
    const parts = name.split('/');
    if (!name || parts.some((part) => !part || part === '.' || part === '..' ||
        BAD_SEG.test(part) || /[. ]$/.test(part) || part.toLowerCase() === '.vault-tmp' ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))
      throw httpErr(400, 'Archive contains an unsafe path');
    const size = isDirectory ? 0 : Number(properties.get('Size'));
    if (!Number.isSafeInteger(size) || size < 0)
      throw httpErr(400, 'Archive contains an invalid file size');
    entries.push({ name: parts.join('/'), isDirectory, size });
    if (entries.length > MAX_ARCHIVE_ENTRIES)
      throw httpErr(400, 'Archive contains too many entries');
  }

  const paths = new Map();
  const explicit = new Set();
  let expandedBytes = 0;
  for (const entry of entries) {
    const key = entry.name.toLowerCase();
    if (explicit.has(key)) throw httpErr(400, 'Archive contains duplicate paths');
    explicit.add(key);
    for (let i = 1; i < entry.name.split('/').length; i++) {
      const parent = entry.name.split('/').slice(0, i).join('/').toLowerCase();
      if (paths.get(parent) === 'file') throw httpErr(400, 'Archive contains conflicting paths');
      paths.set(parent, 'directory');
    }
    const kind = entry.isDirectory ? 'directory' : 'file';
    if (paths.has(key) && paths.get(key) !== kind) throw httpErr(400, 'Archive contains conflicting paths');
    paths.set(key, kind);
    expandedBytes += entry.size;
    if (!Number.isSafeInteger(expandedBytes) || expandedBytes > MAX_EXTRACTED_BYTES)
      throw httpErr(400, 'Archive expands beyond the 10 GB extraction limit');
  }
  return { paths, entries };
}

async function validateExtractedTree(directory, expectedPaths) {
  const found = new Set();
  let expandedBytes = 0;
  async function walk(current, relative = '') {
    for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const stat = await fs.promises.lstat(full);
      if (stat.isSymbolicLink() || !stat.isFile() && !stat.isDirectory())
        throw httpErr(400, 'Extracted archive contains an unsupported file type');
      const name = relative ? relative + '/' + entry.name : entry.name;
      const key = name.toLowerCase();
      if (found.has(key) || expectedPaths.get(key) !== (stat.isDirectory() ? 'directory' : 'file'))
        throw httpErr(400, 'Extracted contents do not match the archive listing');
      found.add(key);
      if (stat.isDirectory()) await walk(full, name);
      else {
        expandedBytes += stat.size;
        if (!Number.isSafeInteger(expandedBytes) || expandedBytes > MAX_EXTRACTED_BYTES)
          throw httpErr(400, 'Archive expands beyond the 10 GB extraction limit');
      }
    }
  }
  await walk(directory);
  for (const [name, kind] of expectedPaths) {
    if (!found.has(name) && kind === 'file')
      throw httpErr(400, 'Extracted contents do not match the archive listing');
  }
}

function archiveOutputFolderName(fileName) {
  const lower = fileName.toLowerCase();
  const extension = [...SEVEN_ZIP_COMPOUND_EXTENSIONS, '.7z', '.arj', '.bz2', '.cab', '.chm', '.cpio',
    '.cramfs', '.deb', '.dmg', '.fat', '.hfs', '.iso', '.lha', '.lzh', '.lzma', '.nsis',
    '.ntfs', '.rar', '.rpm', '.squashfs', '.tar', '.taz', '.tbz', '.tbz2', '.tgz', '.tlz',
    '.txz', '.udf', '.vhd', '.vhdx', '.wim', '.xar', '.xz', '.z', '.jar', '.zip']
    .find((candidate) => lower.endsWith(candidate));
  return cleanName(extension ? fileName.slice(0, -extension.length) : fileName) || 'Archive';
}

async function extractWithSevenZip(archivePath, base, userDirPath, fileName, originalStat) {
  const extension = archiveExtension(fileName);
  const isTarWrapper = SEVEN_ZIP_COMPOUND_EXTENSIONS.includes(extension);
  const listing = await runSevenZip(['l', '-slt', '-sccUTF-8', '-bsp0', archivePath]);
  const archiveListing = validateSevenZipEntries(listing.stdout);

  const currentStat = await fs.promises.stat(archivePath);
  if (currentStat.size !== originalStat.size || currentStat.mtimeMs !== originalStat.mtimeMs)
    throw httpErr(409, 'Archive changed during extraction');

  const tempDir = path.join(userDirPath, '.vault-tmp');
  await fs.promises.mkdir(tempDir, { recursive: true });
  const staging = path.join(tempDir, 'extract-' + crypto.randomBytes(16).toString('hex'));
  await fs.promises.mkdir(staging);
  let destination;
  let reservedDestination = false;
  try {
    const contents = path.join(staging, 'contents');
    await fs.promises.mkdir(contents);
    if (isTarWrapper) {
      const outer = path.join(staging, 'outer');
      await fs.promises.mkdir(outer);
      await runSevenZip(['x', archivePath, '-o' + outer, '-y', '-sccUTF-8', '-bso0', '-bsp0'], {
        maxBuffer: 2 * 1024 * 1024,
        timeout: 30 * 60 * 1000,
      });
      await validateExtractedTree(outer, archiveListing.paths);
      const wrapperEntries = archiveListing.entries.filter((entry) => !entry.isDirectory);
      if (wrapperEntries.length !== 1 || path.extname(wrapperEntries[0].name).toLowerCase() !== '.tar')
        throw httpErr(400, 'Compressed TAR archive has an unsupported layout');
      const tarPath = path.join(outer, ...wrapperEntries[0].name.split('/'));
      const tarListing = await runSevenZip(['l', '-slt', '-sccUTF-8', '-bsp0', tarPath]);
      const contentsListing = validateSevenZipEntries(tarListing.stdout);
      await runSevenZip(['x', tarPath, '-o' + contents, '-y', '-sccUTF-8', '-bso0', '-bsp0'], {
        maxBuffer: 2 * 1024 * 1024,
        timeout: 30 * 60 * 1000,
      });
      await validateExtractedTree(contents, contentsListing.paths);
    } else {
      await runSevenZip(['x', archivePath, '-o' + contents, '-y', '-sccUTF-8', '-bso0', '-bsp0'], {
        maxBuffer: 2 * 1024 * 1024,
        timeout: 30 * 60 * 1000,
      });
      await validateExtractedTree(contents, archiveListing.paths);
    }

    const baseName = archiveOutputFolderName(fileName);
    let folderName;
    for (let suffix = 1; ; suffix++) {
      folderName = cleanName(suffix === 1 ? baseName : baseName + ' (' + suffix + ')');
      destination = path.join(base.full, folderName);
      try {
        await fs.promises.mkdir(destination);
        reservedDestination = true;
        break;
      } catch (err) {
        if (err.code === 'EEXIST' || err.code === 'ENOTEMPTY') continue;
        throw err;
      }
    }
    for (const entry of await fs.promises.readdir(contents))
      await fs.promises.rename(path.join(contents, entry), path.join(destination, entry));
    await fs.promises.rm(staging, { recursive: true, force: true });
    return { extracted: path.posix.join(base.rel, folderName), name: folderName };
  } catch (err) {
    await fs.promises.rm(staging, { recursive: true, force: true });
    if (reservedDestination) await fs.promises.rm(destination, { recursive: true, force: true });
    throw err;
  }
}

app.post('/api/extract', requireAuth, async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload.path !== 'string' || typeof payload.name !== 'string' ||
      !payload.name || /[\\/]/.test(payload.name) || payload.name === '.' || payload.name === '..')
    throw httpErr(400, 'Invalid extraction request');

  const base = resolveRel(req.user.username, payload.path);
  const archiveRel = path.posix.join(base.rel, payload.name);
  const archivePath = resolveRel(req.user.username, archiveRel).full;
  const archiveStat = await fs.promises.lstat(archivePath).catch((err) => {
    if (err.code === 'ENOENT') throw httpErr(404, 'Archive file not found');
    throw err;
  });
  if (!archiveStat.isFile() || archiveStat.isSymbolicLink()) throw httpErr(400, 'Select an archive file');
  const extension = archiveExtension(payload.name);
  if (extension !== '.zip' && extension !== '.jar' && !SEVEN_ZIP_EXTENSIONS.has(extension))
    throw httpErr(400, 'This archive format is not supported');
  if (extension !== '.zip' && extension !== '.jar') {
    const result = await extractWithSevenZip(archivePath, base, userDir(req.user.username), payload.name, archiveStat);
    return res.json(result);
  }

  const baseName = archiveOutputFolderName(payload.name);
  let destination, folderName;
  for (let suffix = 1; ; suffix++) {
    folderName = cleanName(suffix === 1 ? baseName : baseName + ' (' + suffix + ')');
    destination = path.join(base.full, folderName);
    try {
      await fs.promises.mkdir(destination);
      break;
    } catch (err) {
      if (err.code === 'EEXIST') continue;
      throw err;
    }
  }

  try {
    await extractZipToDirectory(archivePath, destination);
    res.json({ extracted: path.posix.join(base.rel, folderName), name: folderName });
  } catch (err) {
    await fs.promises.rm(destination, { recursive: true, force: true });
    if (err.status) throw err;
    throw httpErr(400, 'Could not extract archive');
  }
});

app.post('/api/archive/view', requireAuth, async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload.path !== 'string' || typeof payload.name !== 'string' ||
      !payload.name || /[\\/]/.test(payload.name) || payload.name === '.' || payload.name === '..')
    throw httpErr(400, 'Invalid archive view request');

  const base = resolveRel(req.user.username, payload.path);
  const archiveRel = path.posix.join(base.rel, payload.name);
  const archivePath = resolveRel(req.user.username, archiveRel).full;
  const archiveStat = await fs.promises.lstat(archivePath).catch((err) => {
    if (err.code === 'ENOENT') throw httpErr(404, 'Archive file not found');
    throw err;
  });
  if (!archiveStat.isFile() || archiveStat.isSymbolicLink()) throw httpErr(400, 'Select an archive file');
  const extension = archiveExtension(payload.name);
  if (extension !== '.zip' && extension !== '.jar' && !SEVEN_ZIP_EXTENSIONS.has(extension))
    throw httpErr(400, 'This archive format is not supported');

  const tempRoot = path.join(userDir(req.user.username), '.vault-tmp');
  await fs.promises.mkdir(tempRoot, { recursive: true });
  const token = crypto.randomBytes(32).toString('hex');
  const container = path.join(tempRoot, 'archive-view-' + token);
  await fs.promises.mkdir(container);
  try {
    let workspace;
    if (extension === '.zip' || extension === '.jar') {
      workspace = path.join(container, archiveOutputFolderName(payload.name));
      await fs.promises.mkdir(workspace);
      await extractZipToDirectory(archivePath, workspace);
    } else {
      const result = await extractWithSevenZip(
        archivePath,
        { full: container, rel: '' },
        userDir(req.user.username),
        payload.name,
        archiveStat
      );
      workspace = path.join(container, result.name);
    }

    archiveViews.set(token, {
      username: req.user.username,
      name: payload.name,
      sourcePath: base.rel,
      root: workspace,
      cleanupRoot: container,
      lastUsedAt: Date.now(),
    });
    res.json({ path: '@archive/' + token, name: payload.name, sourcePath: base.rel });
  } catch (err) {
    await fs.promises.rm(container, { recursive: true, force: true });
    throw err;
  }
});

function decompileJarClasses(classes) {
  const entries = [...classes].map(([name, bytes]) => [name, Uint8Array.from(bytes)]);
  const worker = new Worker(path.join(__dirname, 'java-decompiler-worker.js'), {
    workerData: entries,
    transferList: entries.map(([, bytes]) => bytes.buffer),
    resourceLimits: { maxOldGenerationSizeMb: 768, maxYoungGenerationSizeMb: 64, stackSizeMb: 8 },
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, sources) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (err) {
        worker.terminate().catch((terminateErr) => console.error('Could not stop Java decompiler worker:', terminateErr));
        reject(err);
      } else resolve(sources);
    };
    const timeout = setTimeout(() => finish(httpErr(504, 'JAR decompilation timed out after 5 minutes')), 5 * 60 * 1000);
    worker.once('message', (result) => {
      if (result.error) return finish(httpErr(422, 'Could not decompile this JAR: ' + result.error));
      finish(null, result.sources);
    });
    worker.once('error', (err) => {
      console.error('Java decompiler worker failed:', err);
      finish(httpErr(422, 'Could not decompile this JAR'));
    });
    worker.once('exit', (code) => {
      if (!settled) finish(httpErr(422, 'Java decompiler worker exited with code ' + code));
    });
  });
}

async function collectJarClasses(directory) {
  const classes = new Map();
  const relativePaths = new Map();
  let totalBytes = 0;
  async function walk(current) {
    for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.class')) continue;
      const relativePath = path.relative(directory, full).split(path.sep).join('/');
      if (relativePath.toLowerCase().startsWith('meta-inf/versions/')) continue;
      const stat = await fs.promises.stat(full);
      totalBytes += stat.size;
      if (totalBytes > MAX_JAR_DECOMPILE_BYTES)
        throw httpErr(413, 'JAR contains more than 128 MB of Java class files');
      if (classes.size >= MAX_JAR_DECOMPILE_CLASSES)
        throw httpErr(413, 'JAR contains more than 2,000 Java class files');
      const name = relativePath.slice(0, -'.class'.length);
      classes.set(name, await fs.promises.readFile(full));
      relativePaths.set(name, relativePath);
    }
  }
  await walk(directory);
  return { classes, relativePaths };
}

app.post('/api/jar/decompile', requireAuth, async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload.path !== 'string' || typeof payload.name !== 'string' ||
      !payload.name || /[\\/]/.test(payload.name) || payload.name === '.' || payload.name === '..' ||
      path.extname(payload.name).toLowerCase() !== '.jar')
    throw httpErr(400, 'Select a JAR file to decompile');

  const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
  if (nodeMajor < 22 || nodeMajor === 22 && nodeMinor < 7)
    throw httpErr(503, 'JAR decompilation requires Node.js 22.7 or newer on the server');

  const base = resolveRel(req.user.username, payload.path);
  const archiveRel = path.posix.join(base.rel, payload.name);
  const archivePath = resolveRel(req.user.username, archiveRel).full;
  const archiveStat = await fs.promises.lstat(archivePath).catch((err) => {
    if (err.code === 'ENOENT') throw httpErr(404, 'JAR file not found');
    throw err;
  });
  if (!archiveStat.isFile() || archiveStat.isSymbolicLink()) throw httpErr(400, 'Select a JAR file');

  for (const [token, view] of archiveViews) {
    if (view.username !== req.user.username || !view.decompiled ||
        view.sourcePath !== base.rel || view.name !== payload.name ||
        view.sourceSize !== archiveStat.size || view.sourceMtimeMs !== archiveStat.mtimeMs ||
        view.sourceCtimeMs !== archiveStat.ctimeMs)
      continue;
    if (Date.now() - view.lastUsedAt >= ARCHIVE_VIEW_IDLE_MS) {
      archiveViews.delete(token);
      await fs.promises.rm(view.cleanupRoot, { recursive: true, force: true });
      continue;
    }
    if (!fs.existsSync(view.root)) {
      archiveViews.delete(token);
      continue;
    }
    view.lastUsedAt = Date.now();
    return res.json({
      path: '@archive/' + token,
      name: payload.name,
      decompiled: view.decompiledCount,
      cached: true,
    });
  }

  const tempRoot = path.join(userDir(req.user.username), '.vault-tmp');
  await fs.promises.mkdir(tempRoot, { recursive: true });
  const token = crypto.randomBytes(32).toString('hex');
  const container = path.join(tempRoot, 'archive-view-' + token);
  const workspace = path.join(container, archiveOutputFolderName(payload.name));
  await fs.promises.mkdir(container);
  try {
    await fs.promises.mkdir(workspace);
    await extractZipToDirectory(archivePath, workspace);
    const { classes, relativePaths } = await collectJarClasses(workspace);
    if (!classes.size) throw httpErr(400, 'This JAR contains no Java class files');
    const sources = await decompileJarClasses(classes);
    let sourceBytes = 0;
    let decompiled = 0;
    for (const [name, source] of Object.entries(sources)) {
      const classPath = relativePaths.get(name);
      if (!classPath || typeof source !== 'string') continue;
      sourceBytes += Buffer.byteLength(source);
      if (sourceBytes > MAX_JAR_DECOMPILED_BYTES)
        throw httpErr(413, 'Decompiled source exceeds the 256 MB limit');
      const parsedClassPath = path.posix.parse(classPath);
      const sourceDirectory = path.join(workspace, parsedClassPath.dir);
      let sourceName = parsedClassPath.name + '.java';
      for (let suffix = 1; fs.existsSync(path.join(sourceDirectory, sourceName)); suffix++)
        sourceName = parsedClassPath.name + '.decompiled' + (suffix === 1 ? '' : '-' + suffix) + '.java';
      const sourcePath = path.join(sourceDirectory, sourceName);
      await fs.promises.writeFile(sourcePath, source, { flag: 'wx' });
      decompiled++;
    }
    if (!decompiled) throw httpErr(422, 'The Java decompiler could not produce source from this JAR');
    archiveViews.set(token, {
      username: req.user.username,
      name: payload.name,
      sourcePath: base.rel,
      root: workspace,
      cleanupRoot: container,
      decompiled: true,
      decompiledCount: decompiled,
      sourceSize: archiveStat.size,
      sourceMtimeMs: archiveStat.mtimeMs,
      sourceCtimeMs: archiveStat.ctimeMs,
      lastUsedAt: Date.now(),
    });
    res.json({ path: '@archive/' + token, name: payload.name, decompiled, cached: false });
  } catch (err) {
    await fs.promises.rm(container, { recursive: true, force: true });
    if (err.status) throw err;
    console.error('Could not decompile JAR:', err);
    throw httpErr(422, 'Could not decompile this JAR');
  }
});

app.post('/api/archive/view/close', requireAuth, async (req, res) => {
  const token = req.body && req.body.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
    throw httpErr(400, 'Invalid archive view');
  const view = archiveViews.get(token);
  if (!view || view.username !== req.user.username) throw httpErr(404, 'Temporary archive view not found');
  if (view.decompiled) {
    view.lastUsedAt = Date.now();
    return res.json({ closed: true, cached: true });
  }
  archiveViews.delete(token);
  await fs.promises.rm(view.cleanupRoot, { recursive: true, force: true });
  res.json({ closed: true });
});

setInterval(async () => {
  const now = Date.now();
  for (const [token, view] of archiveViews) {
    if (now - view.lastUsedAt < ARCHIVE_VIEW_IDLE_MS) continue;
    archiveViews.delete(token);
    try { await fs.promises.rm(view.cleanupRoot, { recursive: true, force: true }); }
    catch (err) { console.error('Could not clean expired archive view:', err); }
  }
}, 10 * 60 * 1000).unref();

// ---------- stats endpoint ----------
let diskActivity = null;
let diskActivitySampling = false;
let previousLinuxDiskSample = null;
const DISK_COUNTER_SCRIPT = String.raw`$samples = (Get-Counter -Counter @('\PhysicalDisk(_Total)\% Disk Time', '\PhysicalDisk(_Total)\Disk Read Bytes/sec', '\PhysicalDisk(_Total)\Disk Write Bytes/sec') -MaxSamples 1).CounterSamples
$result = [ordered]@{}
foreach ($sample in $samples) {
  if ($sample.Path -match '% Disk Time') { $result.activePercent = [double]$sample.CookedValue }
  elseif ($sample.Path -match 'Disk Read Bytes/sec') { $result.readBytesPerSec = [double]$sample.CookedValue }
  elseif ($sample.Path -match 'Disk Write Bytes/sec') { $result.writeBytesPerSec = [double]$sample.CookedValue }
}
ConvertTo-Json -InputObject $result -Compress`;
function parseLinuxDiskStats(text) {
  const totals = { readSectors: 0, writtenSectors: 0, ioMillis: 0, devices: 0 };
  for (const line of text.trim().split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    const [, , name, , , readSectors, , , , writtenSectors, , , ioMillis] = fields;
    if (!name || /^(loop|ram|zram|dm-|md)/.test(name)) continue;
    if (fs.existsSync(path.join('/sys/dev/block', fields[0] + ':' + fields[1], 'partition'))) continue;
    const values = [readSectors, writtenSectors, ioMillis].map(Number);
    if (!values.every(Number.isFinite)) continue;
    totals.readSectors += values[0];
    totals.writtenSectors += values[1];
    totals.ioMillis += values[2];
    totals.devices++;
  }
  return totals;
}
async function sampleNonWindowsDiskActivity() {
  if (diskActivitySampling) return;
  diskActivitySampling = true;
  try {
    const io = await si.fsStats();
    const sample = {
      activePercent: null,
      readBytesPerSec: Number.isFinite(io && io.rx_sec) ? Math.max(0, io.rx_sec) : null,
      writeBytesPerSec: Number.isFinite(io && io.wx_sec) ? Math.max(0, io.wx_sec) : null,
    };
    if (process.platform === 'linux') {
      const current = parseLinuxDiskStats(await fs.promises.readFile('/proc/diskstats', 'utf8'));
      const now = Date.now();
      if (previousLinuxDiskSample && current.devices && previousLinuxDiskSample.devices) {
        const elapsedMs = now - previousLinuxDiskSample.time;
        if (elapsedMs > 0) {
          const seconds = elapsedMs / 1000;
          sample.readBytesPerSec = Math.max(0, current.readSectors - previousLinuxDiskSample.readSectors) * 512 / seconds;
          sample.writeBytesPerSec = Math.max(0, current.writtenSectors - previousLinuxDiskSample.writtenSectors) * 512 / seconds;
          sample.activePercent = Math.min(100, Math.max(0,
            (current.ioMillis - previousLinuxDiskSample.ioMillis) / (elapsedMs * current.devices) * 100));
        }
      }
      previousLinuxDiskSample = { ...current, time: now };
    }
    diskActivity = sample;
  } catch (error) {
    console.error('Could not read disk activity counters:', error.message);
  } finally {
    diskActivitySampling = false;
  }
}
function sampleWindowsDiskActivity() {
  if (diskActivitySampling) return;
  diskActivitySampling = true;
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', DISK_COUNTER_SCRIPT], {
    timeout: 5000,
    windowsHide: true,
    maxBuffer: 16 * 1024,
  }, (err, stdout) => {
    diskActivitySampling = false;
    if (err) {
      console.error('Could not read Windows physical disk activity counters:', err.message);
      return;
    }
    try {
      const sample = JSON.parse(stdout);
      const values = [sample.activePercent, sample.readBytesPerSec, sample.writeBytesPerSec];
      if (!values.every(Number.isFinite)) throw new Error('Windows disk counters returned incomplete data');
      diskActivity = {
        activePercent: Math.max(0, sample.activePercent),
        readBytesPerSec: Math.max(0, sample.readBytesPerSec),
        writeBytesPerSec: Math.max(0, sample.writeBytesPerSec),
      };
    } catch (error) {
      console.error('Could not parse Windows physical disk activity counters:', error.message);
    }
  });
}
function sampleDiskActivity() {
  if (process.platform === 'win32') return sampleWindowsDiskActivity();
  if (process.platform === 'linux' || process.platform === 'darwin') return sampleNonWindowsDiskActivity();
  diskActivity = null;
}
sampleDiskActivity();
setInterval(sampleDiskActivity, 2000).unref();

app.get('/api/stats', requireAuth, (req, res) => {
  let activeUp = 0, activeDown = 0;
  for (const t of transfers) (t.dir === 'up' ? activeUp++ : activeDown++);
  res.set('Cache-Control', 'no-store');
  res.json({ interval: SAMPLE_MS, up: stats.up, down: stats.down, totalUp: stats.totalUp, totalDown: stats.totalDown, activeUp, activeDown, diskActivity, uptime: Math.round(process.uptime()) });
});

// ---------- storage ----------
async function dirSize(d) {
  let t = 0;
  for (const e of await fs.promises.readdir(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) t += await dirSize(p);
    else if (e.isFile()) { try { t += (await fs.promises.stat(p)).size; } catch {} }
  }
  return t;
}
app.get('/api/storage', requireAuth, async (req, res) => {
  try {
    const filesystems = await si.fsSize();
    const target = path.resolve(FILES);
    const matching = filesystems
      .filter((volume) => {
        if (!volume.mount) return false;
        let mount = volume.mount;
        if (process.platform === 'win32' && /^[A-Za-z]:$/.test(mount)) mount += path.sep;
        const relative = path.relative(path.resolve(mount), target);
        return relative === '' || relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
      })
      .sort((a, b) => b.mount.length - a.mount.length)[0];
    if (!matching) throw new Error('Could not find the filesystem containing the storage directory');
    const total = Number(matching.size), used = Number(matching.used), free = Number(matching.available);
    if (![total, used, free].every(Number.isFinite)) throw new Error('Filesystem capacity data is unavailable');
    res.json({ total, used, free, percent: total > 0 ? used / total * 100 : 0 });
  } catch (error) {
    console.error('Could not read storage filesystem capacity:', error.message);
    try {
      res.json({ used: await dirSize(userDir(req.user.username)) });
    } catch (sizeError) {
      console.error('Could not calculate user storage size:', sizeError.message);
      res.status(500).json({ error: 'Could not read storage usage' });
    }
  }
});

app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message || 'Server error' }));

app.listen(PORT, HOST, () => console.log(`Vault running on http://${HOST}:${PORT}  (storage: ${FILES})`));