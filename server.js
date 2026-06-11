import express from "express";
import { createServer } from "http";
import { get as httpsGet } from "https";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { Server as SocketServer } from "socket.io";
import { server as wispServer } from "@mercuryworkshop/wisp-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// ── Photon Chat ───────────────────────────────────────────────────────────────
const chatHistory = [];
const CHAT_MAX = 80;
const activeUsers = new Map();

app.get("/api/chat/messages", (req, res) => {
  const since = parseInt(req.query.since || 0);
  const sid = String(req.query.sid || "").slice(0, 64);
  if (sid) {
    activeUsers.set(sid, Date.now());
    const cutoff = Date.now() - 10000;
    for (const [id, t] of activeUsers) if (t < cutoff) activeUsers.delete(id);
  }
  res.setHeader("access-control-allow-origin", "*");
  res.json({
    messages: since === 0 ? chatHistory : chatHistory.filter(m => m.time > since),
    online: activeUsers.size,
  });
});

app.post("/api/chat/send", (req, res) => {
  let { name, text } = req.body || {};
  name = String(name || "anon").slice(0, 24).trim() || "anon";
  text = String(text || "").slice(0, 500).trim();
  if (!text) return res.status(400).json({ error: "empty" });
  const msg = { name, text, time: Date.now() };
  chatHistory.push(msg);
  if (chatHistory.length > CHAT_MAX) chatHistory.shift();
  res.json({ ok: true });
});

const dmHistory = new Map();
const DM_MAX = 200;
const signalQueue = new Map();
const SIGNAL_TTL = 30000;

function dmKey(a, b) { return [a, b].sort().join("\x00"); }

app.get("/api/dm/messages", (req, res) => {
  const from = String(req.query.from || "").slice(0, 24).trim();
  const to = String(req.query.to || "").slice(0, 24).trim();
  const since = parseInt(req.query.since || 0);
  if (!from || !to) return res.status(400).json({ error: "missing" });
  const msgs = dmHistory.get(dmKey(from, to)) || [];
  res.setHeader("access-control-allow-origin", "*");
  res.json({ messages: since === 0 ? msgs : msgs.filter(m => m.time > since) });
});

app.post("/api/dm/send", (req, res) => {
  let { from, to, text } = req.body || {};
  from = String(from || "").slice(0, 24).trim();
  to = String(to || "").slice(0, 24).trim();
  text = String(text || "").slice(0, 500).trim();
  if (!from || !to || !text) return res.status(400).json({ error: "missing" });
  const key = dmKey(from, to);
  if (!dmHistory.has(key)) dmHistory.set(key, []);
  const msgs = dmHistory.get(key);
  msgs.push({ from, to, text, time: Date.now() });
  if (msgs.length > DM_MAX) msgs.shift();
  res.json({ ok: true });
});

app.post("/api/signal", (req, res) => {
  let { from, to, type, data } = req.body || {};
  from = String(from || "").slice(0, 24).trim();
  to = String(to || "").slice(0, 24).trim();
  type = String(type || "").slice(0, 32);
  if (!from || !to || !type) return res.status(400).json({ error: "missing" });
  if (!signalQueue.has(to)) signalQueue.set(to, []);
  signalQueue.get(to).push({ from, type, data, time: Date.now() });
  res.json({ ok: true });
});

app.get("/api/signal", (req, res) => {
  const to = String(req.query.to || "").slice(0, 24).trim();
  if (!to) return res.status(400).json({ error: "missing" });
  const now = Date.now();
  const pending = (signalQueue.get(to) || []).filter(s => now - s.time < SIGNAL_TTL);
  signalQueue.set(to, []);
  res.setHeader("access-control-allow-origin", "*");
  res.json({ signals: pending });
});

app.get("/api/wisp-available", (_, res) => res.json({ ok: true }));

// ── Tension Setup (CJS modules via createRequire) ─────────────────────────────
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const GameRoom = require('./tension-server/game.js');
const sampleLevel = require('./tension-server/levels/sample.js');
const db = require('./tension-server/db.js');
const { auth, SECRET } = require('./tension-server/authMiddleware.js');
const rooms = {};

function tryParseAnswers(val) {
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [p]; } catch { return [val]; }
}

// ── Tension Auth ──────────────────────────────────────────────────────────────
app.post('/auth/signup', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password)
    return res.status(400).json({ error: 'All fields required' });
  if (username.trim().length > 20)
    return res.status(400).json({ error: 'Username must be 20 characters or fewer' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const user = db.prepare(
      'INSERT INTO users (email, username, password_hash) VALUES (?,?,?)'
    ).run(email.toLowerCase().trim(), username.trim(), hash);
    const token = jwt.sign({ id: user.lastInsertRowid, username: username.trim() }, SECRET, { expiresIn: '30d' });
    res.json({ token, username: username.trim() });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'All fields required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '30d' });
  res.json({ token, username: user.username });
});

app.get('/auth/me', auth, (req, res) => res.json(req.user));

// ── Tension Levels ────────────────────────────────────────────────────────────
app.get('/api/levels', auth, (req, res) => {
  const levels = db.prepare('SELECT id, name, is_public, created_at, updated_at FROM levels WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
  res.json(levels);
});

app.get('/api/levels/:id', auth, (req, res) => {
  const level = db.prepare('SELECT * FROM levels WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!level) return res.status(404).json({ error: 'Not found' });
  res.json({ ...level, data: JSON.parse(level.data) });
});

app.post('/api/levels', auth, (req, res) => {
  const { name, data, is_public } = req.body;
  if (!name || !data) return res.status(400).json({ error: 'name and data required' });
  const result = db.prepare(
    'INSERT INTO levels (user_id, name, data, is_public) VALUES (?,?,?,?)'
  ).run(req.user.id, name.trim(), JSON.stringify(data), is_public ? 1 : 0);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/levels/:id', auth, (req, res) => {
  const { name, data, is_public } = req.body;
  const level = db.prepare('SELECT id FROM levels WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!level) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE levels SET name=?, data=?, is_public=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(name.trim(), JSON.stringify(data), is_public ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/levels/:id', auth, (req, res) => {
  db.prepare('DELETE FROM levels WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.patch('/api/levels/:id/visibility', auth, (req, res) => {
  const level = db.prepare('SELECT id, is_public FROM levels WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!level) return res.status(404).json({ error: 'Not found' });
  const newVal = level.is_public ? 0 : 1;
  db.prepare('UPDATE levels SET is_public=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(newVal, req.params.id);
  res.json({ is_public: newVal });
});

// ── Tension Questions ─────────────────────────────────────────────────────────
app.get('/api/questions', auth, (req, res) => {
  const qs = db.prepare('SELECT * FROM questions WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(qs.map(q => ({ ...q, options: JSON.parse(q.options), answers: tryParseAnswers(q.answer) })));
});

app.post('/api/questions', auth, (req, res) => {
  const { text, options, answers, difficulty } = req.body;
  if (!text || !options || !answers) return res.status(400).json({ error: 'text, options, answers required' });
  if (!Array.isArray(options) || options.length !== 4) return res.status(400).json({ error: '4 options required' });
  if (!Array.isArray(answers) || answers.length === 0) return res.status(400).json({ error: 'at least one answer required' });
  if (!answers.every(a => options.includes(a))) return res.status(400).json({ error: 'all answers must be among the options' });
  const result = db.prepare(
    'INSERT INTO questions (user_id, text, options, answer, difficulty) VALUES (?,?,?,?,?)'
  ).run(req.user.id, text.trim(), JSON.stringify(options), JSON.stringify(answers), difficulty || 'easy');
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/questions/:id', auth, (req, res) => {
  const { text, options, answers, difficulty } = req.body;
  const q = db.prepare('SELECT id FROM questions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  if (!Array.isArray(answers) || answers.length === 0) return res.status(400).json({ error: 'at least one answer required' });
  if (!answers.every(a => options.includes(a))) return res.status(400).json({ error: 'all answers must be among the options' });
  db.prepare('UPDATE questions SET text=?, options=?, answer=?, difficulty=? WHERE id=?')
    .run(text.trim(), JSON.stringify(options), JSON.stringify(answers), difficulty || 'easy', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/questions/:id', auth, (req, res) => {
  db.prepare('DELETE FROM questions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.patch('/api/questions/:id/visibility', auth, (req, res) => {
  const q = db.prepare('SELECT id, is_public FROM questions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const newVal = q.is_public ? 0 : 1;
  db.prepare('UPDATE questions SET is_public=? WHERE id=?').run(newVal, req.params.id);
  res.json({ is_public: newVal });
});

// ── Tension Community ─────────────────────────────────────────────────────────
app.get('/api/community/levels', auth, (req, res) => {
  const levels = db.prepare(`
    SELECT l.id, l.name, l.created_at, u.username
    FROM levels l JOIN users u ON l.user_id = u.id
    WHERE l.is_public = 1
    ORDER BY l.updated_at DESC
  `).all();
  res.json(levels);
});

app.get('/api/community/questions', auth, (req, res) => {
  const qs = db.prepare(`
    SELECT q.id, q.text, q.options, q.answer, q.difficulty, u.username
    FROM questions q JOIN users u ON q.user_id = u.id
    WHERE q.is_public = 1
    ORDER BY q.created_at DESC
  `).all();
  res.json(qs.map(q => ({ ...q, options: JSON.parse(q.options), answers: tryParseAnswers(q.answer) })));
});

app.post('/api/community/questions/:id/import', auth, (req, res) => {
  const q = db.prepare('SELECT * FROM questions WHERE id = ? AND is_public = 1').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const result = db.prepare(
    'INSERT INTO questions (user_id, text, options, answer, difficulty) VALUES (?,?,?,?,?)'
  ).run(req.user.id, q.text, q.options, q.answer, q.difficulty);
  res.json({ id: result.lastInsertRowid });
});

// ── Tension Room / Host ───────────────────────────────────────────────────────
app.post('/api/host', auth, (req, res) => {
  const { levelId, community } = req.body;
  const row = community
    ? db.prepare('SELECT * FROM levels WHERE id = ? AND is_public = 1').get(levelId)
    : db.prepare('SELECT * FROM levels WHERE id = ? AND user_id = ?').get(levelId, req.user.id);
  if (!row) return res.status(404).json({ error: 'Level not found' });
  const level = JSON.parse(row.data);
  level.name = row.name;
  level.type = 'teacher';
  const code = Math.random().toString(36).slice(2, 7).toUpperCase();
  rooms[code] = new GameRoom(code, io, level);
  res.json({ code });
});

app.post('/api/room', (req, res) => {
  const { level, roomCode } = req.body;
  const code = (roomCode || Math.random().toString(36).slice(2, 8)).toUpperCase();
  if (!rooms[code]) {
    rooms[code] = new GameRoom(code, io, level || sampleLevel);
  }
  res.json({ code });
});

// ── Tension Portal Pages ──────────────────────────────────────────────────────
app.get('/portal', (req, res) => res.sendFile(join(__dirname, 'public/tension/auth.html')));
app.get('/dashboard', (req, res) => res.sendFile(join(__dirname, 'public/tension/dashboard.html')));
app.get('/builder', (req, res) => res.sendFile(join(__dirname, 'public/tension/builder.html')));

// ── Serve three.js locally (replaces CDN dependency) ─────────────────────────
app.use('/three/', express.static(join(__dirname, 'node_modules/three')));

// ── Static Files ──────────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, "public")));
app.use("/scramjet/", express.static(join(__dirname, "node_modules/@mercuryworkshop/scramjet/dist")));
app.use("/bare-mux/", express.static(join(__dirname, "node_modules/@mercuryworkshop/bare-mux/dist")));
app.use("/epoxy/", express.static(join(__dirname, "node_modules/@mercuryworkshop/epoxy-transport/dist")));

// ── Games API ─────────────────────────────────────────────────────────────────
app.get("/api/games", (req, res) => {
  import("fs").then(({ readdirSync, existsSync, readFileSync }) => {
    let games = [];
    const listPath = join(__dirname, "public", "games-list.json");
    if (existsSync(listPath)) {
      try { games = JSON.parse(readFileSync(listPath, "utf-8")); } catch {}
    }
    const gamesDir = join(__dirname, "public", "games");
    if (existsSync(gamesDir)) {
      const localIds = new Set(games.map((g) => g.id));
      readdirSync(gamesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !localIds.has(d.name))
        .forEach((d) => {
          const metaPath = join(gamesDir, d.name, "meta.json");
          if (existsSync(metaPath)) {
            try { games.push(JSON.parse(readFileSync(metaPath, "utf-8"))); return; } catch {}
          }
          games.push({
            id: d.name,
            title: d.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            thumbnail: `/games/${d.name}/thumbnail.png`,
            url: `/games/${d.name}/index.html`,
            category: "Other",
          });
        });
    }
    res.json(games);
  });
});

// ── Fetch Proxy ───────────────────────────────────────────────────────────────
function fetchProxy(target, req, res, depth = 0) {
  if (depth > 3) return res.status(502).end();
  let parsed;
  try { parsed = new URL(target); } catch { return res.status(400).end(); }
  const h = parsed.hostname;
  if (/^(localhost|::1|0\.0\.0\.0|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/.test(h) || h.endsWith(".local")) {
    return res.status(403).end();
  }
  httpsGet(target, { headers: { "user-agent": "Mozilla/5.0" } }, (r) => {
    if ([301, 302, 307, 308].includes(r.statusCode) && r.headers.location) {
      r.resume();
      return fetchProxy(new URL(r.headers.location, target).href, req, res, depth + 1);
    }
    res.status(r.statusCode || 200);
    if (r.headers["content-type"]) res.setHeader("content-type", r.headers["content-type"]);
    res.setHeader("access-control-allow-origin", "*");
    r.pipe(res);
  }).on("error", () => res.status(502).end());
}

app.get("/api/fetch", (req, res) => {
  const target = String(req.query.url || "");
  if (!target) return res.status(400).end();
  fetchProxy(target, req, res);
});

// ── HTTP Server + Socket.IO ───────────────────────────────────────────────────
const server = createServer(app);
const io = new SocketServer(server, {
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
});

// ── Tension Socket.IO Handlers ────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('join_room', ({ roomCode, username, color, hat }) => {
    if (!roomCode || typeof roomCode !== 'string') return;
    const code = roomCode.toUpperCase().slice(0, 10);
    const safeName  = String(username || 'Player').trim().slice(0, 20) || 'Player';
    const safeColor = (typeof color === 'number' && isFinite(color)) ? (color & 0xffffff) : 0xe94560;
    const safeHat   = ['none','cap','tophat','crown','cowboy','party','beanie'].includes(hat) ? hat : 'none';
    if (!rooms[code]) {
      rooms[code] = new GameRoom(code, io, sampleLevel);
    }
    const room = rooms[code];
    socket.roomCode = code;
    socket.join(code);
    room.addPlayer(socket, safeName, safeColor, safeHat);
  });

  let lastUpdateMs = 0;
  socket.on('player_update', (data) => {
    const now = Date.now();
    if (now - lastUpdateMs < 40) return;
    lastUpdateMs = now;
    const room = rooms[socket.roomCode];
    if (room) room.updatePlayer(socket.id, data);
  });

  socket.on('checkpoint', (checkpointId) => {
    const room = rooms[socket.roomCode];
    if (room) room.handleCheckpoint(socket.id, checkpointId);
  });

  socket.on('question_zone', (questionId) => {
    const room = rooms[socket.roomCode];
    if (room) room.handleQuestion(socket.id, questionId);
  });

  socket.on('answer', ({ questionId, answer }) => {
    const room = rooms[socket.roomCode];
    if (room) room.handleAnswer(socket.id, questionId, answer);
  });

  socket.on('finish', () => {
    const room = rooms[socket.roomCode];
    if (room) room.handleFinish(socket.id);
  });

  socket.on('rebirth', () => {
    const room = rooms[socket.roomCode];
    if (room) room.handleRebirth(socket.id);
  });

  socket.on('flashlight', ({ on }) => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    socket.to(socket.roomCode).emit('flashlight', { id: socket.id, on: !!on });
  });

  socket.on('chat', (msg) => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;
    const text = String(msg).trim().slice(0, 120);
    if (!text) return;
    io.to(socket.roomCode).emit('chat', { username: player.username, text });
  });

  socket.on('disconnect', () => {
    const room = rooms[socket.roomCode];
    if (room) {
      room.removePlayer(socket.id);
      if (room.isEmpty()) delete rooms[socket.roomCode];
    }
  });
});

// ── Wisp WebSocket Proxy ──────────────────────────────────────────────────────
server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/wisp/")) {
    wispServer.routeRequest(req, socket, head);
  }
});

server.listen(PORT, () => {
  console.log(`Photon running at http://localhost:${PORT}`);
});
