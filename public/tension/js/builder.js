const token = localStorage.getItem('tension_token');
if (!token) location.href = '/portal';
document.getElementById('nav-user').textContent = localStorage.getItem('tension_user') || '';

const canvas = document.getElementById('builder-canvas');
const ctx = canvas.getContext('2d');

// ── State ────────────────────────────────────────────────────────────────────

const state = {
  blocks: [],
  tool: 'platform',
  selected: -1,

  // Camera / transform
  camX: 0, camZ: 0,       // center of view in game units
  zoom: 22,               // px per game unit

  // Drag (place)
  placing: false,
  placeStart: null,
  placeCur: null,

  // Pan
  panning: false,
  panLast: null,

  // Counters
  checkpointId: 0,
  questionZoneId: 0,

  // User's question bank
  questions: [],
};

const COLORS = {
  platform:   '#4a9fd5',
  moving:     '#e94560',
  checkpoint: '#2ecc71',
  question:   '#3498db',
  finish:     '#ffd700',
};

const TYPE_LABELS = {
  platform: 'Platform', moving: 'Moving', checkpoint: 'Checkpoint',
  question: 'Question', finish: 'Finish',
};

// ── Coordinate helpers ───────────────────────────────────────────────────────

function toCanvas(gx, gz) {
  const cx = (gx - state.camX) * state.zoom + canvas.width / 2;
  const cy = (gz - state.camZ) * state.zoom + canvas.height / 2;
  return { cx, cy };
}

function toGame(cx, cy) {
  const gx = (cx - canvas.width / 2) / state.zoom + state.camX;
  const gz = (cy - canvas.height / 2) / state.zoom + state.camZ;
  return { gx, gz };
}

function snapGame(g) { return Math.round(g); }

// ── Resize canvas ────────────────────────────────────────────────────────────

function resizeCanvas() {
  const wrap = document.getElementById('canvas-wrap');
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  draw();
}
window.addEventListener('resize', resizeCanvas);

// ── Draw ─────────────────────────────────────────────────────────────────────

function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#0a0f1e';
  ctx.fillRect(0, 0, W, H);

  // Grid
  drawGrid();

  // Axis labels (Z values on left)
  ctx.fillStyle = '#2a3550';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  const zStep = state.zoom >= 16 ? 5 : 10;
  for (let gz = -200; gz <= 400; gz += zStep) {
    const { cy } = toCanvas(0, gz);
    if (cy < 0 || cy > H) continue;
    ctx.fillText(gz, 30, cy + 4);
  }

  // Origin marker
  const origin = toCanvas(0, 0);
  ctx.strokeStyle = '#2ecc71';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(origin.cx - 10, origin.cy);
  ctx.lineTo(origin.cx + 10, origin.cy);
  ctx.moveTo(origin.cx, origin.cy - 10);
  ctx.lineTo(origin.cx, origin.cy + 10);
  ctx.stroke();

  // Blocks
  state.blocks.forEach((b, i) => drawBlock(b, i === state.selected));

  // Ghost block while placing
  if (state.placing && state.placeStart && state.placeCur) {
    const ghost = buildBlockFromDrag(state.placeStart, state.placeCur, true);
    if (ghost) drawBlock(ghost, false, true);
  }

  // Crosshair for start position
  drawStartMarker();
}

function drawGrid() {
  const step = state.zoom >= 10 ? 1 : 2;
  const { gx: gxMin, gz: gzMin } = toGame(0, 0);
  const { gx: gxMax, gz: gzMax } = toGame(canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let gx = Math.floor(gxMin); gx <= Math.ceil(gxMax); gx += step) {
    const { cx } = toCanvas(gx, 0);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
  }
  for (let gz = Math.floor(gzMin); gz <= Math.ceil(gzMax); gz += step) {
    const { cy } = toCanvas(0, gz);
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
  }

  // Stronger lines every 10 units
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let gx = Math.floor(gxMin / 10) * 10; gx <= gxMax; gx += 10) {
    const { cx } = toCanvas(gx, 0);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
  }
  for (let gz = Math.floor(gzMin / 10) * 10; gz <= gzMax; gz += 10) {
    const { cy } = toCanvas(0, gz);
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
  }
}

function drawBlock(b, selected, ghost) {
  const alpha = ghost ? 0.45 : 1;
  const color = COLORS[b.type] || '#888';

  const left  = b.x - b.w / 2;
  const top   = b.z - b.d / 2;
  const { cx: bx, cy: bz } = toCanvas(left, top);
  const bw = b.w * state.zoom;
  const bd = b.d * state.zoom;

  ctx.globalAlpha = alpha;

  // Fill
  ctx.fillStyle = selected ? '#fff' : color;
  ctx.globalAlpha = alpha * (selected ? 0.25 : 0.35);
  ctx.fillRect(bx, bz, bw, bd);

  // Border
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = selected ? '#fff' : color;
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.strokeRect(bx + 0.5, bz + 0.5, bw - 1, bd - 1);

  // Label
  if (bw > 30 && bd > 14) {
    ctx.fillStyle = selected ? '#fff' : color;
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${Math.min(11, bw / 4)}px Segoe UI, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = b.type === 'checkpoint' ? `CP ${b.id}` :
                  b.type === 'question'   ? `Q ${b.id}`  :
                  b.type === 'moving'     ? `MOV`        :
                  b.type === 'finish'     ? `FINISH`     : '';
    if (label) ctx.fillText(label, bx + bw / 2, bz + bd / 2);
  }

  ctx.globalAlpha = 1;
}

function drawStartMarker() {
  const { cx, cy } = toCanvas(0, 0);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('▶ START', cx + 6, cy - 4);
}

// ── Block building ───────────────────────────────────────────────────────────

function buildBlockFromDrag(start, cur, ghost) {
  const minX = Math.min(start.gx, cur.gx);
  const maxX = Math.max(start.gx, cur.gx) + 1;
  const minZ = Math.min(start.gz, cur.gz);
  const maxZ = Math.max(start.gz, cur.gz) + 1;
  const w = Math.max(1, maxX - minX);
  const d = Math.max(1, maxZ - minZ);
  const x = minX + w / 2;
  const z = minZ + d / 2;

  const y = parseFloat(document.getElementById('p-y').value) || 0;
  const h = parseFloat(document.getElementById('p-h').value) || 1;
  const tool = state.tool;

  const block = { type: tool, x, y, z, w, h, d };

  if (tool === 'platform') {
    block.color = hexToInt(document.getElementById('p-color').value);
  } else if (tool === 'moving') {
    block.color = hexToInt(document.getElementById('p-color').value);
    block.move = {
      axis:  document.getElementById('p-axis').value,
      range: parseFloat(document.getElementById('p-range').value) || 6,
      speed: parseFloat(document.getElementById('p-speed').value) || 2,
    };
  } else if (tool === 'checkpoint') {
    if (!ghost) {
      state.checkpointId++;
      block.id = state.checkpointId;
    } else {
      block.id = state.checkpointId + 1;
    }
  } else if (tool === 'question') {
    const qId = document.getElementById('p-question').value;
    if (!ghost) {
      state.questionZoneId++;
      block.id = state.questionZoneId;
    } else {
      block.id = state.questionZoneId + 1;
    }
    block.questionId = qId ? parseInt(qId) : null;
  }

  return block;
}

function hexToInt(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

// ── Hit test ─────────────────────────────────────────────────────────────────

function blockAt(gx, gz) {
  for (let i = state.blocks.length - 1; i >= 0; i--) {
    const b = state.blocks[i];
    if (gx >= b.x - b.w / 2 && gx <= b.x + b.w / 2 &&
        gz >= b.z - b.d / 2 && gz <= b.z + b.d / 2) {
      return i;
    }
  }
  return -1;
}

// ── Input ────────────────────────────────────────────────────────────────────

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;

  if (e.button === 2) {
    // Right-click: pan
    state.panning = true;
    state.panLast = { cx, cy };
    return;
  }

  const { gx, gz } = toGame(cx, cy);
  const sgx = snapGame(gx), sgz = snapGame(gz);

  if (state.tool === 'delete') {
    const i = blockAt(gx, gz);
    if (i >= 0) { state.blocks.splice(i, 1); state.selected = -1; updateSelPanel(); markUnsaved(); draw(); }
    return;
  }

  // Click on existing block to select (in non-place tools when block is under cursor)
  const hit = blockAt(gx, gz);
  if (hit >= 0 && state.tool === 'platform') {
    // Could be select vs place — start a place drag
  }

  state.placing = true;
  state.placeStart = { gx: sgx, gz: sgz };
  state.placeCur = { gx: sgx, gz: sgz };
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;

  if (state.panning && state.panLast) {
    const dx = (cx - state.panLast.cx) / state.zoom;
    const dz = (cy - state.panLast.cy) / state.zoom;
    state.camX -= dx;
    state.camZ -= dz;
    state.panLast = { cx, cy };
    draw();
    return;
  }

  if (state.placing) {
    const { gx, gz } = toGame(cx, cy);
    state.placeCur = { gx: snapGame(gx), gz: snapGame(gz) };
    draw();
  }
});

canvas.addEventListener('mouseup', e => {
  if (e.button === 2) { state.panning = false; state.panLast = null; return; }

  if (state.placing && state.tool !== 'delete') {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const { gx, gz } = toGame(cx, cy);
    state.placeCur = { gx: snapGame(gx), gz: snapGame(gz) };

    // If click without drag, try to select
    const moved = state.placeStart &&
      (Math.abs(state.placeCur.gx - state.placeStart.gx) > 0 ||
       Math.abs(state.placeCur.gz - state.placeStart.gz) > 0);

    if (!moved && state.tool !== 'delete') {
      const hit = blockAt(gx, gz);
      if (hit >= 0) {
        state.selected = hit;
        updateSelPanel();
        state.placing = false;
        state.placeStart = null;
        draw();
        return;
      }
    }

    const block = buildBlockFromDrag(state.placeStart, state.placeCur, false);
    if (block) {
      state.blocks.push(block);
      state.selected = state.blocks.length - 1;
      updateSelPanel();
      markUnsaved();
    }
  }
  state.placing = false;
  state.placeStart = null;
  draw();
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.12 : 0.88;
  state.zoom = Math.max(6, Math.min(60, state.zoom * factor));
  draw();
}, { passive: false });

// ── Tool buttons ─────────────────────────────────────────────────────────────

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
    updatePropPanel();
  });
});

function updatePropPanel() {
  const t = state.tool;
  document.getElementById('p-moving-props').style.display   = t === 'moving'   ? 'block' : 'none';
  document.getElementById('p-question-props').style.display = t === 'question'  ? 'block' : 'none';
  document.getElementById('p-color-row').style.display      = (t === 'platform' || t === 'moving') ? 'block' : 'none';
}

function updateSelPanel() {
  const sec = document.getElementById('sel-section');
  const info = document.getElementById('sel-info');
  if (state.selected < 0 || state.selected >= state.blocks.length) {
    sec.style.display = 'none'; return;
  }
  const b = state.blocks[state.selected];
  sec.style.display = 'block';
  info.innerHTML = `
    <b>${TYPE_LABELS[b.type]}</b><br>
    X: ${b.x.toFixed(1)}  Z: ${b.z.toFixed(1)}  Y: ${b.y}<br>
    W: ${b.w}  D: ${b.d}  H: ${b.h}
    ${b.type === 'moving' ? `<br>Axis: ${b.move.axis}  Range: ${b.move.range}  Speed: ${b.move.speed}` : ''}
    ${b.type === 'question' && b.questionId ? `<br>Q ID: ${b.questionId}` : ''}
  `;
}

document.getElementById('sel-delete-btn').addEventListener('click', () => {
  if (state.selected >= 0) {
    state.blocks.splice(state.selected, 1);
    state.selected = -1;
    updateSelPanel();
    markUnsaved();
    draw();
  }
});

// ── Questions selector ───────────────────────────────────────────────────────

async function loadQuestions() {
  const r = await fetch('/api/questions', { headers: { 'Authorization': 'Bearer ' + token } });
  const qs = await r.json();
  state.questions = qs;
  const sel = document.getElementById('p-question');
  sel.innerHTML = '<option value="">— select question —</option>' +
    qs.map(q => `<option value="${q.id}">[${q.difficulty}] ${q.text.slice(0,50)}</option>`).join('');
}
loadQuestions();

// ── Save / Load ──────────────────────────────────────────────────────────────

function buildLevelJSON() {
  const name = document.getElementById('level-name').value.trim() || 'My Level';
  const blocks = state.blocks.slice();

  // Embed question data for any question zones
  const usedQIds = new Set(
    blocks.filter(b => b.type === 'question' && b.questionId).map(b => b.questionId)
  );
  const questions = state.questions.filter(q => usedQIds.has(q.id)).map(q => ({
    id: q.id,
    text: q.text,
    options: q.options,
    answer: q.answer,
  }));

  // Add finish platform if no finish block exists
  let hasFinish = blocks.some(b => b.type === 'finish');
  if (!hasFinish) {
    alert('Warning: no Finish zone placed. Add one so players can complete the level.');
  }

  return {
    name,
    type: 'teacher',
    start: { x: 0, y: 2, z: 0 },
    questions,
    blocks,
  };
}

let editId = new URLSearchParams(location.search).get('id');

let unsaved = false;
let autoSaveTimer = null;

function markUnsaved() {
  unsaved = true;
  document.getElementById('save-btn').textContent = 'Save*';
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => { if (unsaved) saveLevel(); }, 30000);
}

async function saveLevel() {
  const data = buildLevelJSON();
  const name = document.getElementById('level-name').value.trim() || 'My Level';
  const body = { name, data, is_public: 0 };

  const url = editId ? `/api/levels/${editId}` : '/api/levels';
  const method = editId ? 'PUT' : 'POST';
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  const result = await r.json();
  if (result.error) { alert('Error: ' + result.error); return; }
  if (!editId && result.id) {
    editId = result.id;
    history.replaceState(null, '', '/builder?id=' + result.id);
  }
  unsaved = false;
  document.getElementById('save-btn').textContent = 'Save';
  showToast('Level saved!');
}

window.addEventListener('beforeunload', e => {
  if (unsaved) { e.preventDefault(); e.returnValue = ''; }
});

document.getElementById('save-btn').addEventListener('click', saveLevel);
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveLevel(); } });

document.getElementById('clear-btn').addEventListener('click', () => {
  if (confirm('Clear all blocks?')) {
    state.blocks = [];
    state.selected = -1;
    state.checkpointId = 0;
    state.questionZoneId = 0;
    updateSelPanel();
    markUnsaved();
    draw();
  }
});

// Load existing level for editing
async function loadLevel() {
  if (!editId) return;
  const r = await fetch(`/api/levels/${editId}`, { headers: { 'Authorization': 'Bearer ' + token } });
  if (!r.ok) return;
  const row = await r.json();
  document.getElementById('level-name').value = row.name;
  const data = row.data;
  if (data.blocks) {
    state.blocks = data.blocks;
    const cpIds = state.blocks.filter(b => b.type === 'checkpoint').map(b => b.id || 0);
    const qIds  = state.blocks.filter(b => b.type === 'question').map(b => b.id || 0);
    state.checkpointId   = cpIds.length ? Math.max(...cpIds) : 0;
    state.questionZoneId = qIds.length  ? Math.max(...qIds)  : 0;
  }
  draw();
}
loadLevel();

// ── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg) {
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2ecc71;color:#000;padding:10px 24px;border-radius:8px;font-weight:700;font-size:0.88rem;z-index:200;transition:opacity 0.4s';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2000);
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.getElementById('level-name').addEventListener('input', markUnsaved);

updatePropPanel();
resizeCanvas();

// Start with a default start platform
state.blocks.push({ type: 'platform', x: 0, y: 0, z: 0, w: 12, h: 1, d: 12, color: 0x5dbb63 });
