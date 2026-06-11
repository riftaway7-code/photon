import * as THREE from 'three';
import { touch } from './mobile.js';

const SPEED     = 10;
const SPRINT    = 26;
const GRAVITY   = -28;
const JUMP_FORCE = 13;
const MAX_FALL  = -40;
const FRICTION  = 0.85;
const MOUSE_SENS = 0.002;

const PW   = 0.4;
const PD   = 0.4;
const FEET = 1.6;
const HEAD = 0.2;

export class LocalPlayer {
  constructor(camera, id) {
    this.camera      = camera;
    this.id          = id;
    this.velocity    = new THREE.Vector3();
    this.onGround    = false;
    this.yaw         = 0;
    this.pitch       = 0;
    this.yawDelta    = 0;
    this.pitchDelta  = 0;
    this.keys        = {};
    this.respawning  = false;
    this.thirdPerson = false;
    this.checkpointPos = null;
    this.jumpsLeft   = 2;
    this._standingOn = null;
    this._prevJump   = false;
    this.flying      = false;
    this.speedMult   = 1;

    // Physics runs on this position, camera is only updated in 1st person
    this._physPos = new THREE.Vector3();

    this._bindInput();
  }

  setPosition({ x, y, z }) {
    this._physPos.set(x, y + FEET, z);
    this.camera.position.copy(this._physPos);
    this.velocity.set(0, 0, 0);
    this.onGround = false;
  }

  _bindInput() {
    document.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    document.addEventListener('keyup',   (e) => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== document.getElementById('game-canvas')) return;
      this.yawDelta   = e.movementX * MOUSE_SENS;
      this.pitchDelta = e.movementY * MOUSE_SENS;
      this.yaw   -= this.yawDelta;
      this.pitch -= this.pitchDelta;
      this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
    });
  }

  update(dt, colliders) {
    if (this.respawning) return;

    // Apply touch look
    if (touch.lookDX || touch.lookDY) {
      this.yaw   -= touch.lookDX * MOUSE_SENS * 1.2;
      this.pitch -= touch.lookDY * MOUSE_SENS * 1.2;
      this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
      touch.lookDX = 0;
      touch.lookDY = 0;
    }

    // Build movement from input
    const fwd  = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rgt  = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = new THREE.Vector3();

    if (this.keys['KeyW'] || this.keys['ArrowUp'])    move.add(fwd);
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  move.sub(fwd);
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  move.sub(rgt);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) move.add(rgt);
    if (touch.moveX || touch.moveZ) {
      move.addScaledVector(fwd, -touch.moveZ);
      move.addScaledVector(rgt,  touch.moveX);
    }
    if (move.lengthSq() > 0) move.normalize();

    const sprinting = (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || touch.sprint) && this.onGround && !this.flying;
    const spd = (sprinting ? SPRINT : SPEED) * this.speedMult;
    this.velocity.x = move.x * spd;
    this.velocity.z = move.z * spd;

    if (this.flying) {
      if (this.keys['Space'])                                          this.velocity.y =  SPEED * this.speedMult;
      else if (this.keys['ShiftLeft'] || this.keys['ShiftRight'])     this.velocity.y = -SPEED * this.speedMult;
      else                                                             this.velocity.y = 0;
      this.velocity.x *= 0.85;
      this.velocity.z *= 0.85;
    } else {
      const jumpDown = (this.keys['Space'] || touch.jump) && !this._prevJump;
      if (jumpDown && this.jumpsLeft > 0) {
        this.velocity.y = JUMP_FORCE;
        this.onGround = false;
        this.jumpsLeft--;
      }
      if (!this.onGround) {
        this.velocity.y = Math.max(this.velocity.y + GRAVITY * dt, MAX_FALL);
      } else {
        this.velocity.x *= FRICTION;
        this.velocity.z *= FRICTION;
      }
    }
    this._prevJump = !!(this.keys['Space'] || touch.jump);

    this._step(dt, colliders);

    // First person: camera follows physics position
    if (!this.thirdPerson) {
      this.camera.position.copy(this._physPos);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
    }
    // Third person: camera is handled by localBody, physPos stays independent
  }

  _step(dt, colliders) {
    const pos = this._physPos;
    this._standingOn = null;

    pos.y += this.velocity.y * dt;
    this.onGround = false;
    for (const col of colliders) {
      const res = this._resolveY(pos, col, this.velocity.y * dt);
      if (res !== 0) {
        pos.y += res;
        if (res > 0) {
          this.onGround = true;
          this.velocity.y = 0;
          this._standingOn = col;
          this.jumpsLeft = 2;
        } else this.velocity.y = 0;
      }
    }

    pos.x += this.velocity.x * dt;
    for (const col of colliders) {
      const push = this._wallPushX(pos, col);
      if (push !== 0) { pos.x += push; this.velocity.x = 0; }
    }

    pos.z += this.velocity.z * dt;
    for (const col of colliders) {
      const push = this._wallPushZ(pos, col);
      if (push !== 0) { pos.z += push; this.velocity.z = 0; }
    }
  }

  _resolveY(pos, col, vy) {
    if (Math.abs(pos.x - col.x) >= col.hw + PW) return 0;
    if (Math.abs(pos.z - col.z) >= col.hd + PD) return 0;
    const feet = pos.y - FEET, head = pos.y + HEAD;
    const top = col.y + col.hh, bot = col.y - col.hh;
    if (vy <= 0 && feet < top && feet > bot) return top - feet;
    if (vy > 0  && head > bot && head < top) return bot - head;
    return 0;
  }

  _wallPushX(pos, col) {
    const feet = pos.y - FEET, head = pos.y + HEAD;
    if (feet >= col.y + col.hh || head <= col.y - col.hh) return 0;
    if (Math.abs(pos.z - col.z) >= col.hd + PD) return 0;
    const pen = (col.hw + PW) - Math.abs(pos.x - col.x);
    return pen > 0 ? pen * Math.sign(pos.x - col.x) : 0;
  }

  _wallPushZ(pos, col) {
    const feet = pos.y - FEET, head = pos.y + HEAD;
    if (feet >= col.y + col.hh || head <= col.y - col.hh) return 0;
    if (Math.abs(pos.x - col.x) >= col.hw + PW) return 0;
    const pen = (col.hd + PD) - Math.abs(pos.z - col.z);
    return pen > 0 ? pen * Math.sign(pos.z - col.z) : 0;
  }

  getFootPosition() {
    return {
      x: this._physPos.x,
      y: this._physPos.y - FEET,
      z: this._physPos.z,
    };
  }

  getPositionData() {
    return {
      position: this.getFootPosition(),
      rotation: { y: this.yaw },
    };
  }
}
