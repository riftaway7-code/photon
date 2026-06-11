import * as THREE from 'three';

const _loader = new THREE.TextureLoader();

// --- Ground006 PBR textures for platforms ---
const _groundBase = { color: null, normal: null, roughness: null };
function _ensureGroundLoaded() {
  if (_groundBase.color) return;
  const load = (url) => {
    const t = _loader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  _groundBase.color     = load('/tension/textures/ground_color.jpg');
  _groundBase.normal    = load('/tension/textures/ground_normal.jpg');
  _groundBase.roughness = load('/tension/textures/ground_roughness.jpg');
}

const _groundMatCache = {};
const TILES_PER_UNIT = 0.5; // one tile every 2 world units

function groundMat(w, d, tint = 0xffffff) {
  _ensureGroundLoaded();
  const rx = Math.max(1, Math.round(w * TILES_PER_UNIT));
  const ry = Math.max(1, Math.round(d * TILES_PER_UNIT));
  const key = `${rx}_${ry}_${tint.toString(16)}`;
  if (_groundMatCache[key]) return _groundMatCache[key];

  const cloneT = (t) => { const c = t.clone(); c.needsUpdate = true; return c; };
  const col   = cloneT(_groundBase.color);     col.repeat.set(rx, ry);
  const norm  = cloneT(_groundBase.normal);    norm.repeat.set(rx, ry);
  const rough = cloneT(_groundBase.roughness); rough.repeat.set(rx, ry);

  const mat = new THREE.MeshStandardMaterial({
    map: col,
    normalMap: norm,
    roughnessMap: rough,
    color: tint,
    normalScale: new THREE.Vector2(0.8, 0.8),
  });
  _groundMatCache[key] = mat;
  return mat;
}

const ZONE_MATS = {
  checkpoint: new THREE.MeshLambertMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.5 }),
  question:   new THREE.MeshLambertMaterial({ color: 0x3498db, transparent: true, opacity: 0.5 }),
  finish:     new THREE.MeshLambertMaterial({ color: 0xffd700, transparent: true, opacity: 0.7 }),
};

export function buildLevel(scene, level) {
  const colliders = [];
  const movingPlatforms = [];
  const zones = [];

  for (const b of level.blocks) {
    const hw = b.w / 2, hh = b.h / 2, hd = b.d / 2;

    if (b.type === 'platform' || b.type === 'moving') {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, b.h, b.d),
        groundMat(b.w, b.d, b.color || 0xffffff)
      );
      mesh.position.set(b.x, b.y, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const col = { mesh, x: b.x, y: b.y, z: b.z, hw, hh, hd };

      if (b.type === 'moving') {
        const origin = { x: b.x, y: b.y, z: b.z };
        movingPlatforms.push({ col, mesh, origin, move: b.move, t: Math.random() * Math.PI * 2 });
      }

      colliders.push(col);
    } else if (b.type === 'checkpoint' || b.type === 'question' || b.type === 'finish') {
      zones.push({ ...b, hw, hh, hd, centerY: b.y + hh });
      addZoneIndicator(scene, b);
      if (b.type === 'finish') {
        // Finish needs a solid floor so the player doesn't fall through
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(b.w, b.h, b.d),
          groundMat(b.w, b.d, 0xffd700)
        );
        mesh.position.set(b.x, b.y, b.z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
        colliders.push({ mesh, x: b.x, y: b.y, z: b.z, hw, hh, hd });
      }
    } else if (b.type === 'difficulty_sign') {
      addDifficultySign(scene, b);
    }
  }

  // Sky / void kill plane (invisible — handled by y < threshold in game logic)

  return { colliders, movingPlatforms, zones };
}

const DIFF_SIGN_COLORS = ['#2ecc71','#3498db','#f5a623','#e94560','#9b59b6','#ff0033'];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

function addDifficultySign(scene, b) {
  const label = b.label || 'Easy';
  const idx = ['Easy','Medium','Hard','Expert','Extreme','Insane'].indexOf(label);
  const color = DIFF_SIGN_COLORS[Math.max(0, idx)];

  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  roundRect(ctx, 4, 4, 504, 120, 18);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  roundRect(ctx, 4, 4, 504, 120, 18);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 64px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.toUpperCase(), 256, 64);

  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(5, 1.25, 1);
  sprite.position.set(b.x, b.y + 3.5, b.z);
  scene.add(sprite);
}

function addZoneIndicator(scene, b) {
  const colors = { checkpoint: 0x2ecc71, question: 0x3498db, finish: 0xffd700 };
  const color = colors[b.type] || 0xffffff;

  // Floating ring above zone
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(b.w / 2, 0.15, 8, 24),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.4 })
  );
  ring.position.set(b.x, b.y + 0.5 + 1.5, b.z);
  ring.rotation.x = Math.PI / 2;
  ring.userData.floatBase = ring.position.y;
  ring.userData.floatTag = true;
  scene.add(ring);
}

export function updateMovingPlatforms(movingPlatforms, dt) {
  for (const p of movingPlatforms) {
    const px = p.col.x, py = p.col.y, pz = p.col.z;
    p.t += dt;
    const offset = Math.sin(p.t * p.move.speed) * (p.move.range / 2);
    const axis = p.move.axis;
    p.col.x = p.origin.x + (axis === 'x' ? offset : 0);
    p.col.y = p.origin.y + (axis === 'y' ? offset : 0);
    p.col.z = p.origin.z + (axis === 'z' ? offset : 0);
    p.mesh.position.set(p.col.x, p.col.y, p.col.z);
    // Track delta so player can ride the platform
    p.delta = { x: p.col.x - px, y: p.col.y - py, z: p.col.z - pz };
  }
}

const CLOUD_MAT = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });

function makeCloud(scene, cx, cy, cz) {
  const group = new THREE.Group();
  const puffs = [
    { x: 0,    y: 0,   z: 0,   rx: 2.8, ry: 1.6, rz: 2.0 },
    { x: 2.2,  y: -0.3,z: 0,   rx: 2.0, ry: 1.2, rz: 1.6 },
    { x: -2.2, y: -0.3,z: 0,   rx: 1.8, ry: 1.1, rz: 1.5 },
    { x: 1.0,  y: 0.7, z: 0,   rx: 1.5, ry: 1.0, rz: 1.2 },
    { x: -1.0, y: 0.6, z: 0,   rx: 1.4, ry: 0.9, rz: 1.1 },
    { x: 0,    y: -0.2,z: 1.2, rx: 1.6, ry: 1.0, rz: 1.4 },
    { x: 0,    y: -0.2,z: -1.2,rx: 1.6, ry: 1.0, rz: 1.4 },
  ];
  for (const p of puffs) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 6), CLOUD_MAT);
    mesh.scale.set(p.rx, p.ry, p.rz);
    mesh.position.set(p.x, p.y, p.z);
    group.add(mesh);
  }
  group.position.set(cx, cy, cz);
  group.userData.cloudDrift = Math.random() * Math.PI * 2;
  group.userData.cloudBaseX = cx;
  scene.add(group);
  return group;
}

export function spawnClouds(scene) {
  const clouds = [];
  const positions = [
    [-18, 22, 20],  [ 15, 25, 35],  [-10, 18, 55],
    [ 20, 28, 75],  [-22, 20, 95],  [ 12, 30, 115],
    [-15, 24, 135], [ 18, 22, 155], [-8,  26, 90],
    [ 0,  32, 50],  [-20, 28, 170], [ 25, 20, 10],
  ];
  for (const [x, y, z] of positions) {
    clouds.push(makeCloud(scene, x, y, z));
  }
  return clouds;
}

export function animateClouds(clouds, t) {
  for (const c of clouds) {
    c.position.x = c.userData.cloudBaseX + Math.sin(t * 0.08 + c.userData.cloudDrift) * 3;
  }
}

export function animateZones(scene, t) {
  scene.traverse(obj => {
    if (obj.userData.floatTag) {
      obj.position.y = obj.userData.floatBase + Math.sin(t * 2) * 0.15;
      obj.rotation.z = t * 0.8;
    }
  });
}
