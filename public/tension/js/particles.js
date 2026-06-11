import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  burst(position, color = 0xffd700, count = 40) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = [];

    for (let i = 0; i < count; i++) {
      pos[i * 3]     = position.x;
      pos[i * 3 + 1] = position.y + 1;
      pos[i * 3 + 2] = position.z;
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      vel.push({
        x: Math.cos(angle) * speed,
        y: 3 + Math.random() * 7,
        z: Math.sin(angle) * speed,
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color, size: 0.18, transparent: true, depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.active.push({ points, vel, pos, age: 0, life: 1.4 });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      s.age += dt;
      if (s.age >= s.life) {
        this.scene.remove(s.points);
        s.points.geometry.dispose();
        s.points.material.dispose();
        this.active.splice(i, 1);
        continue;
      }
      for (let j = 0; j < s.vel.length; j++) {
        s.vel[j].y -= 12 * dt;
        s.pos[j * 3]     += s.vel[j].x * dt;
        s.pos[j * 3 + 1] += s.vel[j].y * dt;
        s.pos[j * 3 + 2] += s.vel[j].z * dt;
      }
      s.points.geometry.attributes.position.needsUpdate = true;
      s.points.material.opacity = 1 - s.age / s.life;
    }
  }

  reset(newScene) {
    for (const s of this.active) {
      s.points.geometry.dispose();
      s.points.material.dispose();
    }
    this.active = [];
    this.scene = newScene;
  }
}
