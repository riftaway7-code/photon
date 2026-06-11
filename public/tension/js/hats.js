import * as THREE from 'three';

export const HATS = [
  { id: 'none',   name: 'None'    },
  { id: 'cap',    name: 'Cap'     },
  { id: 'tophat', name: 'Top Hat' },
  { id: 'crown',  name: 'Crown'   },
  { id: 'cowboy', name: 'Cowboy'  },
  { id: 'party',  name: 'Party'   },
  { id: 'beanie', name: 'Beanie'  },
];

const m = (color) => new THREE.MeshLambertMaterial({ color });

// Head top = y 1.80 (head center 1.55 + half 0.25)
// Character faces +Z

function buildCap() {
  const g = new THREE.Group();
  const dark = m(0x1a1a66);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.18, 12), dark);
  top.position.y = 1.89;
  g.add(top);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.22), dark);
  brim.position.set(0, 1.79, 0.24);
  g.add(brim);
  const logo = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), m(0xe94560));
  logo.position.set(0, 1.98, 0.27);
  g.add(logo);
  return g;
}

function buildTopHat() {
  const g = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 16), m(0x111111));
  brim.position.y = 1.80;
  g.add(brim);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.46, 16), m(0x111111));
  tube.position.y = 2.06;
  g.add(tube);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.07, 16), m(0xe94560));
  band.position.y = 1.87;
  g.add(band);
  return g;
}

function buildCrown() {
  const g = new THREE.Group();
  const gold = m(0xffd700);
  // 4-sided band ring
  for (const [x, z, w, d] of [
    [0, -0.26, 0.54, 0.06], [0,  0.26, 0.54, 0.06],
    [-0.26, 0, 0.06, 0.54], [0.26, 0, 0.06, 0.54],
  ]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), gold);
    s.position.set(x, 1.80, z);
    g.add(s);
  }
  // 5 spikes
  for (const [x, z] of [[0,-0.26],[-0.2,-0.1],[0.2,-0.1],[-0.2,0.15],[0.2,0.15]]) {
    const spike = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.07), gold);
    spike.position.set(x, 1.96, z);
    g.add(spike);
  }
  // Gems
  for (const [i, c] of [[0,0xe74c3c],[1,0x3498db],[2,0x2ecc71]]) {
    const gem = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), m(c));
    gem.position.set((i - 1) * 0.18, 1.80, -0.26);
    g.add(gem);
  }
  return g;
}

function buildCowboy() {
  const g = new THREE.Group();
  const tan = m(0xc8a46e);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 16), tan);
  brim.position.y = 1.80;
  g.add(brim);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.27, 0.32, 16), tan);
  top.position.y = 1.98;
  g.add(top);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.06, 16), m(0x8b4513));
  band.position.y = 1.84;
  g.add(band);
  return g;
}

function buildParty() {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.52, 12), m(0xe94560));
  cone.position.y = 2.07;
  g.add(cone);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12), m(0xffd700));
  band.position.y = 1.82;
  g.add(band);
  const dotMat = m(0xffd700);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), dotMat);
    dot.position.set(Math.sin(a) * 0.15, 1.93 + i * 0.06, Math.cos(a) * 0.15);
    g.add(dot);
  }
  return g;
}

function buildBeanie() {
  const g = new THREE.Group();
  const blue = m(0x2980b9);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.30, 16), blue);
  body.position.y = 1.88;
  g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), blue);
  dome.position.y = 2.02;
  g.add(dome);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), m(0xffffff));
  pom.position.y = 2.26;
  g.add(pom);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.07, 16), m(0xffffff));
  stripe.position.y = 1.77;
  g.add(stripe);
  return g;
}

const BUILDERS = { cap: buildCap, tophat: buildTopHat, crown: buildCrown, cowboy: buildCowboy, party: buildParty, beanie: buildBeanie };

export function buildHat(id) {
  return BUILDERS[id]?.() ?? null;
}
