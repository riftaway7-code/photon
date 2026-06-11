import * as THREE from 'three';
import { buildHat } from './hats.js';

const SKIN  = new THREE.MeshLambertMaterial({ color: 0xf5cba7 });
const PANTS = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });

const HEAD_OFFSET  = 1.55;
const THIRD_DIST   = 5;    // how far back in third person
const THIRD_HEIGHT = 2.5;  // how far up in third person

export class LocalBody {
  constructor(scene, camera, color = 0xe94560, hatId = 'none') {
    this.camera    = camera;
    this.thirdPerson = false;
    this.animT     = 0;
    this.group     = new THREE.Group();
    scene.add(this.group);

    // Head (only visible in third person)
    const headMat = new THREE.MeshLambertMaterial({ color: 0xf5cba7 });
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
    this.head.position.y = HEAD_OFFSET;
    this.group.add(this.head);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
    this.eyeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const eyeL = new THREE.Mesh(eyeGeo, this.eyeMat);
    eyeL.position.set(-0.13, HEAD_OFFSET + 0.03, 0.26);
    this.group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, this.eyeMat);
    eyeR.position.set(0.13, HEAD_OFFSET + 0.03, 0.26);
    this.group.add(eyeR);

    const shirt = new THREE.MeshLambertMaterial({ color });

    // Torso
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), shirt);
    this.torso.position.y = 0.95;
    this.group.add(this.torso);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.22, 0.6, 0.28);
    this.armL = new THREE.Mesh(armGeo, shirt);
    this.armL.position.set(-0.42, 0.95, 0);
    this.group.add(this.armL);
    this.armR = new THREE.Mesh(armGeo, shirt);
    this.armR.position.set(0.42, 0.95, 0);
    this.group.add(this.armR);

    // Legs
    this.legLGroup = new THREE.Group();
    this.legLGroup.position.set(-0.17, 0.6, 0);
    const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.65, 0.3), PANTS);
    legLMesh.position.y = -0.325;
    this.legLGroup.add(legLMesh);
    this.group.add(this.legLGroup);

    this.legRGroup = new THREE.Group();
    this.legRGroup.position.set(0.17, 0.6, 0);
    const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.65, 0.3), PANTS);
    legRMesh.position.y = -0.325;
    this.legRGroup.add(legRMesh);
    this.group.add(this.legRGroup);

    // Shoes
    const shoeGeo = new THREE.BoxGeometry(0.28, 0.12, 0.36);
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(0, -0.65, 0.04);
    this.legLGroup.add(shoeL);
    const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
    shoeR.position.set(0, -0.65, 0.04);
    this.legRGroup.add(shoeR);

    const hat = buildHat(hatId);
    if (hat) { hat.traverse(m => { if (m.isMesh) m.castShadow = true; }); this.group.add(hat); }

    this.group.traverse(m => { if (m.isMesh) m.castShadow = true; });

    // Store first-person camera offset to restore on switch back
    this._storedPos = null;
  }

  toggle() {
    this.thirdPerson = !this.thirdPerson;
  }

  setEyeGlow(on) {
    this.eyeMat.color.set(on ? 0xffffff : 0x222222);
    this.eyeMat.emissive.set(on ? 0xffffff : 0x000000);
    this.eyeMat.emissiveIntensity = on ? 1 : 0;
  }

  update(dt, isMoving, footPos, yaw) {
    const cam = this.camera;

    // Body always sits at foot position
    this.group.position.set(footPos.x, footPos.y, footPos.z);
    this.group.rotation.y = yaw + Math.PI;

    // Head hidden in first person (you're the camera)
    this.head.visible = this.thirdPerson;
    this.group.children.forEach(c => {
      if (c === this.head) return;
      // Eyes
      if (c.geometry?.type === 'BoxGeometry' && c.position.z > 0.2) {
        c.visible = this.thirdPerson;
      }
    });

    if (this.thirdPerson) {
      // Pull camera behind and above the body
      const behindX = footPos.x + Math.sin(yaw) * THIRD_DIST;
      const behindZ = footPos.z + Math.cos(yaw) * THIRD_DIST;
      cam.position.set(behindX, footPos.y + THIRD_HEIGHT + 1.6, behindZ);
      // Look at head level
      cam.lookAt(footPos.x, footPos.y + 1.4, footPos.z);
    }

    // Walk animation
    if (isMoving) this.animT += dt * 7;
    const swing = isMoving ? Math.sin(this.animT) * 0.55 : 0;
    this.legLGroup.rotation.x =  swing;
    this.legRGroup.rotation.x = -swing;
    this.armL.rotation.x      = -swing * 0.4;
    this.armR.rotation.x      =  swing * 0.4;
  }
}
