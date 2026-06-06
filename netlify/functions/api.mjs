import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { get as httpsGet } from 'https';

// Shared in-memory state (persists within a warm Lambda instance)
const chatHistory = [];
const CHAT_MAX = 80;
const activeUsers = new Map();
const dmHistory = new Map();
const DM_MAX = 200;
const signalQueue = new Map();
const SIGNAL_TTL = 30000;

function dmKey(a, b) { return [a, b].sort().join('\x00'); }

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

function json(data, status = 200) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(data) };
}

function fetchProxy(target, depth = 0) {
  return new Promise((resolve) => {
    if (depth > 3) return resolve({ statusCode: 502, headers: CORS, body: '' });
    let parsed;
    try { parsed = new URL(target); } catch { return resolve({ statusCode: 400, headers: CORS, body: '' }); }
    const h = parsed.hostname;
    if (/^(localhost|::1|0\.0\.0\.0|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/.test(h)) {
      return resolve({ statusCode: 403, headers: CORS, body: '' });
    }
    httpsGet(target, { headers: { 'user-agent': 'Mozilla/5.0' } }, (r) => {
      if ([301, 302, 307, 308].includes(r.statusCode) && r.headers.location) {
        r.resume();
        return fetchProxy(new URL(r.headers.location, target).href, depth + 1).then(resolve);
      }
      const chunks = [];
      r.on('data', d => chunks.push(d));
      r.on('end', () => resolve({
        statusCode: r.statusCode || 200,
        headers: { ...CORS, 'Content-Type': r.headers['content-type'] || 'application/octet-stream' },
        body: Buffer.concat(chunks).toString('base64'),
        isBase64Encoded: true,
      }));
    }).on('error', () => resolve({ statusCode: 502, headers: CORS, body: '' }));
  });
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  // Strip "/.netlify/functions/api" or just "/api" prefix to get the sub-path
  const rawPath = event.path || '';
  const path = rawPath.replace(/^\/.netlify\/functions\/api/, '').replace(/^\/api/, '') || '/';
  const method = event.httpMethod;
  const qs = event.queryStringParameters || {};
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  // GET /games
  if (path === '/games' && method === 'GET') {
    const root = process.cwd();
    const listPath = join(root, 'public', 'games-list.json');
    let games = [];
    if (existsSync(listPath)) {
      try { games = JSON.parse(readFileSync(listPath, 'utf-8')); } catch {}
    }
    const gamesDir = join(root, 'public', 'games');
    if (existsSync(gamesDir)) {
      const localIds = new Set(games.map(g => g.id));
      readdirSync(gamesDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !localIds.has(d.name))
        .forEach(d => {
          const meta = join(gamesDir, d.name, 'meta.json');
          if (existsSync(meta)) {
            try { games.push(JSON.parse(readFileSync(meta, 'utf-8'))); return; } catch {}
          }
          games.push({
            id: d.name,
            title: d.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            thumbnail: `/games/${d.name}/thumbnail.png`,
            url: `/games/${d.name}/index.html`,
            category: 'Other',
          });
        });
    }
    return json(games);
  }

  // GET /chat/messages
  if (path === '/chat/messages' && method === 'GET') {
    const since = parseInt(qs.since || 0);
    const sid = String(qs.sid || '').slice(0, 64);
    if (sid) {
      activeUsers.set(sid, Date.now());
      const cutoff = Date.now() - 10000;
      for (const [id, t] of activeUsers) if (t < cutoff) activeUsers.delete(id);
    }
    return json({ messages: since === 0 ? chatHistory : chatHistory.filter(m => m.time > since), online: activeUsers.size });
  }

  // POST /chat/send
  if (path === '/chat/send' && method === 'POST') {
    let name = String(body.name || 'anon').slice(0, 24).trim() || 'anon';
    const text = String(body.text || '').slice(0, 500).trim();
    if (!text) return json({ error: 'empty' }, 400);
    const msg = { name, text, time: Date.now() };
    chatHistory.push(msg);
    if (chatHistory.length > CHAT_MAX) chatHistory.shift();
    return json({ ok: true });
  }

  // GET /dm/messages
  if (path === '/dm/messages' && method === 'GET') {
    const from = String(qs.from || '').slice(0, 24).trim();
    const to = String(qs.to || '').slice(0, 24).trim();
    const since = parseInt(qs.since || 0);
    if (!from || !to) return json({ error: 'missing' }, 400);
    const msgs = dmHistory.get(dmKey(from, to)) || [];
    return json({ messages: since === 0 ? msgs : msgs.filter(m => m.time > since) });
  }

  // POST /dm/send
  if (path === '/dm/send' && method === 'POST') {
    const from = String(body.from || '').slice(0, 24).trim();
    const to = String(body.to || '').slice(0, 24).trim();
    const text = String(body.text || '').slice(0, 500).trim();
    if (!from || !to || !text) return json({ error: 'missing' }, 400);
    const key = dmKey(from, to);
    if (!dmHistory.has(key)) dmHistory.set(key, []);
    const msgs = dmHistory.get(key);
    msgs.push({ from, to, text, time: Date.now() });
    if (msgs.length > DM_MAX) msgs.shift();
    return json({ ok: true });
  }

  // POST /signal
  if (path === '/signal' && method === 'POST') {
    const from = String(body.from || '').slice(0, 24).trim();
    const to = String(body.to || '').slice(0, 24).trim();
    const type = String(body.type || '').slice(0, 32);
    if (!from || !to || !type) return json({ error: 'missing' }, 400);
    if (!signalQueue.has(to)) signalQueue.set(to, []);
    signalQueue.get(to).push({ from, type, data: body.data, time: Date.now() });
    return json({ ok: true });
  }

  // GET /signal
  if (path === '/signal' && method === 'GET') {
    const to = String(qs.to || '').slice(0, 24).trim();
    if (!to) return json({ error: 'missing' }, 400);
    const now = Date.now();
    const pending = (signalQueue.get(to) || []).filter(s => now - s.time < SIGNAL_TTL);
    signalQueue.set(to, []);
    return json({ signals: pending });
  }

  // GET /fetch
  if (path === '/fetch' && method === 'GET') {
    const target = String(qs.url || '');
    if (!target) return { statusCode: 400, headers: CORS, body: '' };
    return fetchProxy(target);
  }

  return json({ error: 'not found' }, 404);
};
