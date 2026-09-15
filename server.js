const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'data', 'db.json');
const UPLOADS = path.join(ROOT, 'uploads');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ settings: {}, anime: [] }, null, 2));
}

const upload = multer({
  dest: UPLOADS,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Тек сурет файлдарын жүктеуге болады.'));
  }
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS, { maxAge: '7d' }));
app.use(express.static(path.join(ROOT, 'public'), { maxAge: '1h' }));

function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { settings: {}, anime: [] }; }
}
function writeDb(db) {
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function nextId(items) { return items.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1; }
function admin(req, res, next) {
  const configured = process.env.ADMIN_PASSWORD;
  const token = req.get('x-admin-token');
  if (!configured) return res.status(503).json({ error: 'ADMIN_PASSWORD бапталмаған.' });
  if (!token || token !== configured) return res.status(401).json({ error: 'Қолжетімділік жоқ.' });
  next();
}
function sanitizeAnime(a, includeUnpublished = false) {
  if (!includeUnpublished && !a.published) return null;
  return { ...a, episodes: (a.episodes || []).filter(e => includeUnpublished || e.published !== false) };
}

app.get('/api/config', (_req, res) => {
  const db = readDb();
  res.json({ settings: { ...db.settings, telegramUrl: process.env.TELEGRAM_URL || db.settings.telegramUrl || '' } });
});

app.get('/api/anime', (req, res) => {
  const db = readDb();
  let items = db.anime.map(x => sanitizeAnime(x)).filter(Boolean);
  const q = String(req.query.q || '').trim().toLowerCase();
  const genre = String(req.query.genre || '').trim().toLowerCase();
  const type = String(req.query.type || '').trim().toLowerCase();
  const status = String(req.query.status || '').trim().toLowerCase();
  const sort = String(req.query.sort || 'newest');
  if (q) items = items.filter(x => `${x.title} ${x.altTitle} ${x.description} ${(x.genres || []).join(' ')}`.toLowerCase().includes(q));
  if (genre) items = items.filter(x => (x.genres || []).some(g => g.toLowerCase() === genre));
  if (type) items = items.filter(x => x.type === type);
  if (status) items = items.filter(x => x.status === status);
  if (sort === 'rating') items.sort((a,b) => (b.rating || 0) - (a.rating || 0));
  else if (sort === 'alpha') items.sort((a,b) => a.title.localeCompare(b.title));
  else items.sort((a,b) => (b.year || 0) - (a.year || 0) || (b.id || 0) - (a.id || 0));
  res.json(items);
});

app.get('/api/anime/:id', (req, res) => {
  const db = readDb();
  const item = db.anime.find(x => String(x.id) === String(req.params.id));
  if (!item || !item.published) return res.status(404).json({ error: 'Аниме табылмады.' });
  res.json(sanitizeAnime(item));
});

app.post('/api/admin/login', (req, res) => {
  const password = String(req.body.password || '');
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'ADMIN_PASSWORD бапталмаған.' });
  if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Құпиясөз қате.' });
  res.json({ ok: true, token: process.env.ADMIN_PASSWORD });
});

app.get('/api/admin/stats', admin, (_req, res) => {
  const db = readDb();
  const anime = db.anime;
  const episodes = anime.reduce((n,a) => n + (a.episodes || []).length, 0);
  res.json({ anime: anime.length, movies: anime.filter(a => a.type === 'movie').length, episodes, published: anime.filter(a => a.published).length });
});

app.get('/api/admin/anime', admin, (_req, res) => res.json(readDb().anime));

app.post('/api/admin/anime', admin, (req, res) => {
  const db = readDb();
  const body = req.body || {};
  const item = {
    id: nextId(db.anime),
    title: String(body.title || '').trim(), altTitle: String(body.altTitle || '').trim(),
    description: String(body.description || '').trim(), year: Number(body.year) || new Date().getFullYear(),
    rating: Math.max(0, Math.min(10, Number(body.rating) || 0)), type: body.type === 'movie' ? 'movie' : 'series',
    status: ['ongoing','completed','planned'].includes(body.status) ? body.status : 'ongoing',
    ageRating: String(body.ageRating || '12+'), studio: String(body.studio || ''),
    poster: String(body.poster || ''), backdrop: String(body.backdrop || ''),
    genres: Array.isArray(body.genres) ? body.genres.map(String) : [], featured: Boolean(body.featured),
    published: body.published !== false, episodes: []
  };
  if (!item.title) return res.status(400).json({ error: 'Атау міндетті.' });
  db.anime.unshift(item); writeDb(db); res.status(201).json(item);
});

app.put('/api/admin/anime/:id', admin, (req, res) => {
  const db = readDb();
  const item = db.anime.find(x => String(x.id) === String(req.params.id));
  if (!item) return res.status(404).json({ error: 'Табылмады.' });
  const body = req.body || {};
  Object.assign(item, {
    title: body.title !== undefined ? String(body.title).trim() : item.title,
    altTitle: body.altTitle !== undefined ? String(body.altTitle).trim() : item.altTitle,
    description: body.description !== undefined ? String(body.description).trim() : item.description,
    year: body.year !== undefined ? Number(body.year) : item.year,
    rating: body.rating !== undefined ? Math.max(0, Math.min(10, Number(body.rating))) : item.rating,
    type: body.type ? (body.type === 'movie' ? 'movie' : 'series') : item.type,
    status: body.status && ['ongoing','completed','planned'].includes(body.status) ? body.status : item.status,
    ageRating: body.ageRating !== undefined ? String(body.ageRating) : item.ageRating,
    studio: body.studio !== undefined ? String(body.studio) : item.studio,
    poster: body.poster !== undefined ? String(body.poster) : item.poster,
    backdrop: body.backdrop !== undefined ? String(body.backdrop) : item.backdrop,
    genres: Array.isArray(body.genres) ? body.genres.map(String) : item.genres,
    featured: body.featured !== undefined ? Boolean(body.featured) : item.featured,
    published: body.published !== undefined ? Boolean(body.published) : item.published
  });
  writeDb(db); res.json(item);
});

app.delete('/api/admin/anime/:id', admin, (req, res) => {
  const db = readDb();
  const before = db.anime.length;
  db.anime = db.anime.filter(x => String(x.id) !== String(req.params.id));
  if (db.anime.length === before) return res.status(404).json({ error: 'Табылмады.' });
  if (String(db.settings.featuredId) === String(req.params.id)) db.settings.featuredId = db.anime[0]?.id || null;
  writeDb(db); res.json({ ok: true });
});

app.post('/api/admin/anime/:id/episode', admin, (req, res) => {
  const db = readDb();
  const item = db.anime.find(x => String(x.id) === String(req.params.id));
  if (!item) return res.status(404).json({ error: 'Аниме табылмады.' });
  const body = req.body || {};
  item.episodes = item.episodes || [];
  const ep = { id: nextId(item.episodes), number: Number(body.number) || item.episodes.length + 1, title: String(body.title || `Эпизод ${body.number || item.episodes.length + 1}`), duration: String(body.duration || ''), videoUrl: String(body.videoUrl || ''), thumbnail: String(body.thumbnail || item.backdrop || item.poster || ''), releaseDate: String(body.releaseDate || ''), published: body.published !== false };
  item.episodes.push(ep); writeDb(db); res.status(201).json(ep);
});

app.delete('/api/admin/anime/:id/episode/:eid', admin, (req, res) => {
  const db = readDb();
  const item = db.anime.find(x => String(x.id) === String(req.params.id));
  if (!item) return res.status(404).json({ error: 'Аниме табылмады.' });
  const before = (item.episodes || []).length;
  item.episodes = (item.episodes || []).filter(e => String(e.id) !== String(req.params.eid));
  if (before === item.episodes.length) return res.status(404).json({ error: 'Эпизод табылмады.' });
  writeDb(db); res.json({ ok: true });
});

app.put('/api/admin/settings', admin, (req, res) => {
  const db = readDb(); db.settings = { ...db.settings, ...req.body };
  if (process.env.TELEGRAM_URL) db.settings.telegramUrl = process.env.TELEGRAM_URL;
  writeDb(db); res.json(db.settings);
});

app.post('/api/admin/upload', admin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл жоқ.' });
  const ext = path.extname(req.file.originalname) || '.bin';
  const target = `${req.file.filename}${ext}`;
  fs.renameSync(req.file.path, path.join(UPLOADS, target));
  res.json({ url: `/uploads/${target}` });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Сұраныс қатесі.' });
});

app.get('*', (_req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));

app.listen(PORT, () => console.log(`ᑌᑎᔕIᘔ ᗩᑎIᗰE running on port ${PORT}`));
