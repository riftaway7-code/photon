import * as THREE from 'three';
import { buildHat } from './hats.js';

export const PALETTE = [
  { name: 'Red',     hex: 0xe94560, css: '#e94560' },
  { name: 'Blue',    hex: 0x3498db, css: '#3498db' },
  { name: 'Green',   hex: 0x2ecc71, css: '#2ecc71' },
  { name: 'Orange',  hex: 0xf39c12, css: '#f39c12' },
  { name: 'Purple',  hex: 0x9b59b6, css: '#9b59b6' },
  { name: 'Teal',    hex: 0x1abc9c, css: '#1abc9c' },
  { name: 'Pink',    hex: 0xff69b4, css: '#ff69b4' },
  { name: 'Yellow',  hex: 0xffd700, css: '#ffd700' },
  { name: 'White',   hex: 0xeeeeee, css: '#eeeeee' },
  { name: 'Maroon',  hex: 0x96281b, css: '#96281b' },
  { name: 'Lime',    hex: 0x00e676, css: '#00e676' },
  { name: 'Cyan',    hex: 0x00bcd4, css: '#00bcd4' },
];

const SKIN_MAT = new THREE.MeshLambertMaterial({ color: 0xf5cba7 });
const EYE_MAT  = new THREE.MeshLambertMaterial({ color: 0x222222 });

function buildMesh(color) {
  const bm = new THREE.MeshLambertMaterial({ color });
  const g = new THREE.Group();

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), bm);
  torso.position.y = 0.95;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), SKIN_MAT);
  head.position.y = 1.55;
  g.add(head);

  const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
  for (const x of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(eyeGeo, EYE_MAT);
    eye.position.set(x, 1.58, 0.26);
    g.add(eye);
  }

  const armGeo = new THREE.BoxGeometry(0.22, 0.6, 0.28);
  for (const x of [-0.42, 0.42]) {
    const arm = new THREE.Mesh(armGeo, bm);
    arm.position.set(x, 0.95, 0);
    g.add(arm);
  }

  const legGeo = new THREE.BoxGeometry(0.26, 0.65, 0.3);
  for (const x of [-0.17, 0.17]) {
    const leg = new THREE.Mesh(legGeo, bm);
    leg.position.set(x, 0.275, 0);
    g.add(leg);
  }

  return { group: g, bm };
}

export function initPreview(canvas) {
  const W = 160, H = 200;
  canvas.width = W; canvas.height = H;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 50);
  camera.position.set(0, 1.1, 3.8);
  camera.lookAt(0, 1, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(2, 4, 3);
  scene.add(sun);

  const { group, bm } = buildMesh(PALETTE[0].hex);
  scene.add(group);

  let currentHat = null;

  let running = true;
  let raf;
  (function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    group.rotation.y += 0.018;
    renderer.render(scene, camera);
  })();

  return {
    setColor(hex) { bm.color.set(hex); },
    setHat(id) {
      if (currentHat) { group.remove(currentHat); currentHat = null; }
      const hat = buildHat(id);
      if (hat) { group.add(hat); currentHat = hat; }
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
  };
}
