import * as THREE from 'three';
import { buildHat } from './hats.js';

const BODY_COLORS = [0xe94560, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c];
const SKIN = new THREE.MeshLambertMaterial({ color: 0xf5cba7 });

function makeNameTag(username) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 28px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = username || 'Player';
  const tw = ctx.measureText(text).width;
  const pad = 16;
  const bx = 128 - tw / 2 - pad, bw = tw + pad * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const r = 12;
  ctx.beginPath();
  ctx.roundRect(bx, 8, bw, 48, r);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 128, 36);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.y = 2.1;
  return sprite;
}

function bodyMat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function buildMesh(color) {
  const bm = bodyMat(color);
  const group = new THREE.Group();

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), bm);
  torso.position.y = 0.95;
  group.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), SKIN);
  head.position.y = 1.55;
  group.add(head);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.13, 1.58, 0.26);
  group.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.13, 1.58, 0.26);
  group.add(eyeR);

  // Flashlight (off by default)
  const flashlight = new THREE.SpotLight(0xfff4e0, 0, 40, Math.PI * 0.12, 0.25, 1.2);
  flashlight.position.set(0, 1.55, 0); // head height
  const flashTarget = new THREE.Object3D();
  flashTarget.position.set(0, 1.55, -5); // forward in local space
  group.add(flashlight);
  group.add(flashTarget);
  flashlight.target = flashTarget;

  // Arms
  const armGeo = new THREE.BoxGeometry(0.22, 0.6, 0.28);
  const armL = new THREE.Mesh(armGeo, bm);
  armL.position.set(-0.42, 0.95, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, bm);
  armR.position.set(0.42, 0.95, 0);
  group.add(armR);

  // Legs (pivot from hip)
  const legGeo = new THREE.BoxGeometry(0.26, 0.65, 0.3);
  const legL = new THREE.Group();
  legL.position.set(-0.17, 0.6, 0);
  const legLMesh = new THREE.Mesh(legGeo, bm);
  legLMesh.position.y = -0.325;
  legL.add(legLMesh);
  group.add(legL);

  const legR = new THREE.Group();
  legR.position.set(0.17, 0.6, 0);
  const legRMesh = new THREE.Mesh(legGeo, bm);
  legRMesh.position.y = -0.325;
  legR.add(legRMesh);
  group.add(legR);

  group.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  return { group, legL, legR, armL, armR, head, eyeMat, flashlight, hatGroup: null };
}

export class RemotePlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.players = {};
    this.colorIndex = 0;
  }

  add(id, data) {
    if (this.players[id]) return;
    const color = data.color || BODY_COLORS[this.colorIndex++ % BODY_COLORS.length];
    const { group, legL, legR, armL, armR, head, eyeMat, flashlight } = buildMesh(color);
    group.position.set(data.position?.x || 0, data.position?.y || 0, data.position?.z || 0);
    const nameTag = makeNameTag(data.username);
    group.add(nameTag);

    // Hat
    let hatGroup = null;
    const hat = buildHat(data.hat || 'none');
    if (hat) { group.add(hat); hatGroup = hat; }

    this.scene.add(group);
    this.players[id] = {
      group, legL, legR, armL, armR, head, nameTag, eyeMat, flashlight, hatGroup,
      target: { ...(data.position || { x: 0, y: 0, z: 0 }) },
      prevPos: { ...(data.position || { x: 0, y: 0, z: 0 }) },
      rotation: data.rotation?.y || 0,
      animT: 0,
      speed: 0,
    };
  }

  reset(newScene) {
    // Remove all existing meshes from old scene, re-add to new scene
    this.scene = newScene;
    for (const p of Object.values(this.players)) {
      newScene.add(p.group);
    }
  }

  remove(id) {
    if (!this.players[id]) return;
    const p = this.players[id];
    p.nameTag.material.map.dispose();
    p.nameTag.material.dispose();
    this.scene.remove(p.group);
    delete this.players[id];
  }

  setFlashlight(id, on) {
    const p = this.players[id];
    if (!p) return;
    p.flashlight.intensity = on ? 80 : 0;
    p.eyeMat.color.set(on ? 0xffffff : 0x222222);
    p.eyeMat.emissive.set(on ? 0xffffff : 0x000000);
    p.eyeMat.emissiveIntensity = on ? 1 : 0;
  }

  move(id, position, rotation) {
    if (!this.players[id]) return;
    this.players[id].target = position;
    this.players[id].rotation = rotation?.y || 0;
  }

  update(dt = 1/60) {
    for (const p of Object.values(this.players)) {
      const t = new THREE.Vector3(p.target.x, p.target.y, p.target.z);
      p.group.position.lerp(t, 0.2);
      p.group.rotation.y = p.rotation + Math.PI;

      // Estimate speed from position delta
      const dx = p.target.x - p.prevPos.x;
      const dz = p.target.z - p.prevPos.z;
      p.speed = Math.sqrt(dx * dx + dz * dz) / (dt || 0.016);
      p.prevPos = { ...p.target };

      // Walk animation
      const moving = p.speed > 0.5;
      if (moving) p.animT += dt * Math.min(p.speed * 1.5, 8);

      const swing = moving ? Math.sin(p.animT) * 0.55 : 0;
      p.legL.rotation.x  =  swing;
      p.legR.rotation.x  = -swing;
      p.armL.rotation.x  = -swing * 0.5;
      p.armR.rotation.x  =  swing * 0.5;

      // Idle head bob
      p.head.position.y = 1.55 + Math.sin(p.animT * 0.5) * (moving ? 0.015 : 0.005);
    }
  }
}
