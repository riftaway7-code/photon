import express from "express";
import { createServer } from "http";
import { get as httpsGet } from "https";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { server as wispServer } from "@mercuryworkshop/wisp-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

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

// Serve static frontend
app.use(express.static(join(__dirname, "public")));

// Serve scramjet + bare-mux + epoxy dist files
app.use(
  "/scramjet/",
  express.static(join(__dirname, "node_modules/@mercuryworkshop/scramjet/dist"))
);
app.use(
  "/bare-mux/",
  express.static(join(__dirname, "node_modules/@mercuryworkshop/bare-mux/dist"))
);
app.use(
  "/epoxy/",
  express.static(join(__dirname, "node_modules/@mercuryworkshop/epoxy-transport/dist"))
);

// Games API: merge games-list.json with local game folders
app.get("/api/games", (req, res) => {
  import("fs").then(({ readdirSync, existsSync, readFileSync }) => {
    let games = [];

    // Load central games list
    const listPath = join(__dirname, "public", "games-list.json");
    if (existsSync(listPath)) {
      try { games = JSON.parse(readFileSync(listPath, "utf-8")); } catch {}
    }

    // Merge locally-hosted game folders
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

const server = createServer(app);

// Wisp WebSocket proxy
server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/wisp/")) {
    wispServer.routeRequest(req, socket, head);
  } else {
    socket.end();
  }
});

server.listen(PORT, () => {
  console.log(`Photon running at http://localhost:${PORT}`);
});
