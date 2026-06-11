import * as THREE from 'three';
import { PALETTE, initPreview } from './customize.js';
import { HATS } from './hats.js';
import { buildLevel, updateMovingPlatforms, animateZones, spawnClouds, animateClouds } from './map.js';
import { ParticleSystem } from './particles.js';
import { playCheckpoint, playFinish, playWrongAnswer, playJump, playFall, playFootstep } from './sounds.js';
import { Network } from './network.js';
import { LocalPlayer } from './player.js';
import { LocalBody } from './localBody.js';
import { RemotePlayerManager } from './remotes.js';
import { HUD } from './hud.js';
import { QuestionUI } from './question.js';
import { initTouchControls, touch } from './mobile.js';

let renderer, scene, camera;
let network, localPlayer, localBody, remotes, hud, questionUI;
let colliders = [], movingPlatforms = [], zones = [], clouds = [];
let level = null;
let myId = null;
let started = false;
let levelFinished = false;
let playerRebirth = 0;
let clock = new THREE.Clock();
const KILL_Y = -20;

let particles = null;
let shakeIntensity = 0;
let levelStartTime = 0;
let footstepTimer = 0;
let wasOnGround = false;

function initThree() {
  const canvas = document.getElementById('game-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.3;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05050f, 0.008);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
  scene.add(camera); // needed for flashlight to work as camera child

  // Load night sky — sharp background, separate PMREM for environment lighting
  new THREE.TextureLoader().load('/tension/textures/night_sky.jpg', (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    scene.background = tex;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
  });

  const moon = new THREE.DirectionalLight(0xaaccff, 2.5);
  moon.position.set(-30, 60, 20);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -80;
  moon.shadow.camera.right = 80;
  moon.shadow.camera.top = 80;
  moon.shadow.camera.bottom = -80;
  moon.shadow.camera.far = 300;
  scene.add(moon);
  scene.add(new THREE.AmbientLight(0x6688aa, 4));

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function clearLevel() {
  // Remove all scene objects except lights
  const toRemove = [];
  scene.traverse(obj => {
    if (obj.isLight || obj === scene) return;
    if (!obj.parent || obj.parent === scene) toRemove.push(obj);
  });
  toRemove.forEach(obj => scene.remove(obj));
  colliders = []; movingPlatforms = []; zones = []; clouds = [];
}

function loadLevel(lvl) {
  level = lvl;
  levelFinished = false;
  clearLevel();

  document.getElementById('level-name').textContent = level.name;

  const built = buildLevel(scene, level);
  colliders = built.colliders;
  movingPlatforms = built.movingPlatforms;
  zones = built.zones;
  clouds = spawnClouds(scene);

  const totalCheckpoints = zones.filter(z => z.type === 'checkpoint').length;
  hud.updateCheckpoint(0, totalCheckpoints);

  localPlayer.setPosition(level.start);
  localPlayer.checkpointPos = null;
  localPlayer.respawning = false;
  applyMods();

  // Rebuild localBody in fresh scene
  localBody = new LocalBody(scene, camera, selectedColor, selectedHat);

  // Re-add all remote players to the new scene
  if (remotes) remotes.reset(scene);
  if (particles) particles.reset(scene); else particles = new ParticleSystem(scene);
  levelStartTime = performance.now();
}

function startGame(id, allPlayers, lvl) {
  myId = id;
  level = lvl;
  started = true;

  levelFinished = false;
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  document.getElementById('chat-panel').style.display = 'block';
  document.getElementById('level-name').textContent = level.name;

  const built = buildLevel(scene, level);
  colliders = built.colliders;
  movingPlatforms = built.movingPlatforms;
  zones = built.zones;
  clouds = spawnClouds(scene);

  const totalCheckpoints = zones.filter(z => z.type === 'checkpoint').length;
  hud = new HUD();
  hud.updateCheckpoint(0, totalCheckpoints);

  localPlayer = new LocalPlayer(camera, myId);
  localBody   = new LocalBody(scene, camera, selectedColor, selectedHat);
  const me = allPlayers.find(p => p.id === myId);
  localPlayer.setPosition(me?.position || level.start);

  remotes = new RemotePlayerManager(scene);
  for (const p of allPlayers) {
    if (p.id !== myId) remotes.add(p.id, p);
  }
  particles = new ParticleSystem(scene);
  levelStartTime = performance.now();

  questionUI = new QuestionUI((qId, answer) => {
    network.sendAnswer(qId, answer);
  });

  document.getElementById('game-canvas').addEventListener('click', () => {
    if (!questionUI.isOpen()) {
      document.getElementById('game-canvas').requestPointerLock();
    }
  });

  initTouchControls();

  animate();
}

// --- Flashlight ---
let flashlight = null;
let flashlightOn = false;

function initFlashlight() {
  flashlight = new THREE.SpotLight(0xfff4e0, 0, 40, Math.PI * 0.12, 0.25, 1.2);
  flashlight.castShadow = false;
  flashlight.position.set(0, 0, 0);
  flashlight.target.position.set(0, 0, -1); // point forward
  camera.add(flashlight);
  camera.add(flashlight.target);
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && started) {
    flashlightOn = !flashlightOn;
    if (flashlight) flashlight.intensity = flashlightOn ? 80 : 0;
    if (localBody) localBody.setEyeGlow(flashlightOn);
    network.sendFlashlight(flashlightOn);
  }
});

let lastSendTime = 0;
const SEND_INTERVAL = 50;

function checkZones() {
  const foot = localPlayer.getFootPosition();

  for (const z of zones) {
    const dx = Math.abs(foot.x - z.x);
    const dz = Math.abs(foot.z - z.z);
    const dy = Math.abs(foot.y - z.centerY);

    if (dx < z.hw + 0.4 && dz < z.hd + 0.4 && dy < z.hh + 2) {
      if (z.type === 'checkpoint') {
        network.sendCheckpoint(z.id);
      } else if (z.type === 'question' && !questionUI.isOpen()) {
        network.sendQuestionZone(z.questionId);
      } else if (z.type === 'finish' && !levelFinished) {
        levelFinished = true;
        network.sendFinish();
        hud.notify('You finished!', '#ffd700');
        playFinish();
        if (particles) particles.burst({ x: z.x, y: z.y, z: z.z }, 0xffd700, 60);
        showRebirthOverlay();
      }
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (!started) return;

  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (!questionUI.isOpen()) {
    updateMovingPlatforms(movingPlatforms, dt);
    if (mods.jumps && localPlayer) localPlayer.jumpsLeft = 99;
    localPlayer.update(dt, mods.ghost ? [] : colliders);

    // Carry player with moving platform they're standing on (exact collider match)
    if (localPlayer._standingOn) {
      for (const p of movingPlatforms) {
        if (p.col === localPlayer._standingOn) {
          const clamp = (v) => Math.max(-0.5, Math.min(0.5, v));
          localPlayer._physPos.x += clamp(p.delta.x);
          localPlayer._physPos.y += clamp(p.delta.y);
          localPlayer._physPos.z += clamp(p.delta.z);
          break;
        }
      }
    }
  }

  const isMoving = !!(localPlayer.keys['KeyW'] || localPlayer.keys['KeyS'] ||
    localPlayer.keys['KeyA'] || localPlayer.keys['KeyD'] ||
    localPlayer.keys['ArrowUp'] || localPlayer.keys['ArrowDown'] ||
    localPlayer.keys['ArrowLeft'] || localPlayer.keys['ArrowRight'] ||
    touch.moveX || touch.moveZ);
  localBody.update(dt, isMoving, localPlayer.getFootPosition(), localPlayer.yaw);

  animateZones(scene, t);
  animateClouds(clouds, t);
  remotes.update(dt);
  if (particles) particles.update(dt);

  // Flashlight flicker
  if (flashlightOn && flashlight) {
    flashlight.intensity = 80 + (Math.random() - 0.5) * 6;
  }

  // Camera shake
  if (shakeIntensity > 0) {
    camera.position.x += (Math.random() - 0.5) * shakeIntensity;
    camera.position.y += (Math.random() - 0.5) * shakeIntensity;
    camera.position.z += (Math.random() - 0.5) * shakeIntensity;
    shakeIntensity = Math.max(0, shakeIntensity - 6 * dt);
  }

  // Timer
  if (hud && !levelFinished) {
    hud.updateTimer((performance.now() - levelStartTime) / 1000);
  }

  // Footsteps
  if (localPlayer.onGround) {
    const moving = !!(localPlayer.keys['KeyW'] || localPlayer.keys['KeyS'] ||
      localPlayer.keys['KeyA'] || localPlayer.keys['KeyD'] || touch.moveX || touch.moveZ);
    if (moving) {
      footstepTimer -= dt;
      if (footstepTimer <= 0) { playFootstep(); footstepTimer = 0.38; }
    } else { footstepTimer = 0; }
  }

  // Jump sound
  if (!wasOnGround && localPlayer.onGround) wasOnGround = true;
  if (wasOnGround && !localPlayer.onGround && localPlayer.velocity.y > 1) {
    playJump(); wasOnGround = false;
  }
  wasOnGround = localPlayer.onGround;

  // Kill zone — fell off
  if (localPlayer._physPos.y < KILL_Y && !localPlayer.respawning) {
    playFall();
    respawn();
  }

  checkZones();

  // Throttle position sends
  const now = performance.now();
  if (now - lastSendTime > SEND_INTERVAL) {
    network.sendPosition(localPlayer.getPositionData());
    lastSendTime = now;
  }

  if (localPlayer) { localPlayer.yawDelta = 0; localPlayer.pitchDelta = 0; }
  renderer.render(scene, camera);
}

function respawn() {
  localPlayer.respawning = true;
  hud.notify('Fell off! Respawning...', '#e74c3c');
  setTimeout(() => {
    // Respawn at last checkpoint
    localPlayer.setPosition(
      localPlayer.checkpointPos || level.start
    );
    localPlayer.respawning = false;
  }, 1500);
}

// --- Color & hat picker ---
let selectedColor = parseInt(localStorage.getItem('playerColor') || PALETTE[0].hex);
let selectedHat   = localStorage.getItem('playerHat') || 'none';
let preview = initPreview(document.getElementById('preview-canvas'));
preview.setColor(selectedColor);
preview.setHat(selectedHat);

const swatchContainer = document.getElementById('color-swatches');
PALETTE.forEach(({ name, hex, css }) => {
  const btn = document.createElement('button');
  btn.className = 'color-swatch' + (hex === selectedColor ? ' selected' : '');
  btn.style.background = css;
  btn.title = name;
  btn.addEventListener('click', () => {
    selectedColor = hex;
    localStorage.setItem('playerColor', String(hex));
    preview.setColor(hex);
    swatchContainer.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    btn.classList.add('selected');
  });
  swatchContainer.appendChild(btn);
});

const hatContainer = document.getElementById('hat-picker');
HATS.forEach(({ id, name }) => {
  const btn = document.createElement('button');
  btn.className = 'hat-btn' + (id === selectedHat ? ' selected' : '');
  btn.textContent = name;
  btn.addEventListener('click', () => {
    selectedHat = id;
    localStorage.setItem('playerHat', id);
    preview.setHat(id);
    hatContainer.querySelectorAll('.hat-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
  hatContainer.appendChild(btn);
});

// --- Boot ---
initThree();
initFlashlight();
network = new Network();

network.on('init', ({ id, players, level, finished }) => {
  startGame(id, players, level);
});

network.on('player_joined', (pdata) => {
  if (pdata.id !== myId) remotes.add(pdata.id, pdata);
});

network.on('player_left', (id) => remotes.remove(id));
network.on('player_moved', ({ id, position, rotation }) => remotes.move(id, position, rotation));

network.on('state', ({ players }) => {
  if (!hud) return;
  const totalCP = zones.filter(z => z.type === 'checkpoint').length;
  for (const p of players) {
    if (p.id === myId) {
      hud.updateCheckpoint(p.checkpoint, totalCP);
      // Sync checkpoint pos to local player
      if (localPlayer && p.checkpoint) {
        const cpZone = zones.find(z => z.type === 'checkpoint' && z.id === p.checkpoint);
        if (cpZone) localPlayer.checkpointPos = { x: cpZone.x, y: cpZone.y + 1, z: cpZone.z };
      }
    } else {
      remotes.move(p.id, p.position, p.rotation);
    }
  }
  hud.updateScoreboard(players);
});

network.on('question', (q) => questionUI.show(q));

network.on('answer_result', ({ correct, respawn: respawnPos }) => {
  questionUI.showResult(correct);
  if (correct) {
    playCheckpoint();
  } else {
    playWrongAnswer();
    shakeIntensity = 0.35;
    if (!correct && respawnPos) {
      setTimeout(() => { localPlayer.setPosition(respawnPos); }, 2500);
    }
  }
});

network.on('checkpoint_reached', ({ id, checkpointId }) => {
  if (id === myId) {
    hud.notify(`Checkpoint ${checkpointId} reached!`);
    playCheckpoint();
    const z = zones.find(zn => zn.type === 'checkpoint' && zn.id === checkpointId);
    if (z && particles) particles.burst({ x: z.x, y: z.y, z: z.z }, 0x2ecc71);
  }
});

network.on('player_finished', ({ username, rank }) => {
  hud.notify(`${username} finished in place #${rank}!`, '#ffd700');
});

const DIFF_COLORS = ['#2ecc71','#3498db','#f5a623','#e94560','#9b59b6','#ff0033'];
const DIFF_NAMES  = ['Easy','Medium','Hard','Expert','Extreme','Insane'];

function showRebirthOverlay() {
  if (document.pointerLockElement) document.exitPointerLock();

  if (playerRebirth >= 5) {
    document.getElementById('rebirth-maxed-overlay').style.display = 'flex';
    return;
  }

  const next = playerRebirth + 1;
  document.getElementById('rebirth-title').textContent = `You finished ${DIFF_NAMES[playerRebirth]}!`;
  document.getElementById('rebirth-sub').textContent   = 'Waiting for other players...';
  const badge = document.getElementById('rebirth-difficulty-badge');
  badge.textContent = `→ ${DIFF_NAMES[next].toUpperCase()}`;
  badge.style.color = DIFF_COLORS[next];
  document.getElementById('rebirth-overlay').style.display = 'flex';
  document.getElementById('rebirth-btn').style.display = 'none';
  document.getElementById('rebirth-skip').style.display = 'none';
}

network.on('waiting_for_players', ({ waitingFor }) => {
  showRebirthOverlay();
  document.getElementById('rebirth-sub').textContent = `Waiting for: ${waitingFor.join(', ')}`;
});

network.on('rebirth', ({ rebirth, level: newLevel }) => {
  document.getElementById('rebirth-overlay').style.display = 'none';
  document.getElementById('rebirth-btn').style.display = '';
  document.getElementById('rebirth-skip').style.display = '';
  playerRebirth = rebirth;
  hud.notify(`REBIRTH ${rebirth} — ${newLevel.difficultyName.toUpperCase()}!`, DIFF_COLORS[rebirth] || '#ffd700');
  loadLevel(newLevel);
});

// --- Chat ---
const chatMessages = document.getElementById('chat-messages');
const chatInputRow = document.getElementById('chat-input-row');
const chatInput    = document.getElementById('chat-input');
let chatOpen = false;

function addChatMessage(username, text) {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="chat-name">${escHtml(username)}</span>${escHtml(text)}`;
  chatMessages.appendChild(div);
  while (chatMessages.children.length > 20) chatMessages.removeChild(chatMessages.firstChild);
  setTimeout(() => div.remove(), 8500);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function openChat() {
  chatOpen = true;
  chatInputRow.style.display = 'block';
  chatInput.value = '';
  chatInput.focus();
  if (document.pointerLockElement) document.exitPointerLock();
}

function closeChat() {
  chatOpen = false;
  chatInputRow.style.display = 'none';
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyT' && started && !chatOpen && !questionUI?.isOpen()) {
    e.preventDefault();
    openChat();
  }
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const msg = chatInput.value.trim();
    if (msg) network.sendChat(msg);
    closeChat();
  } else if (e.key === 'Escape') {
    closeChat();
  }
  e.stopPropagation();
});

network.on('chat', ({ username, text }) => addChatMessage(username, text));
network.on('flashlight', ({ id, on }) => { if (remotes) remotes.setFlashlight(id, on); });

// --- Mod Menu ---
const KONAMI_ARROW = ['ArrowUp','ArrowDown','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA','Enter'];
const KONAMI_WASD  = ['KeyW','KeyS','KeyW','KeyS','KeyA','KeyD','KeyA','KeyD','KeyB','KeyA','Enter'];
let konamiBuffer = [];

const mods = { fly: false, speed: false, jumps: false, ghost: false };

function applyMods() {
  if (!localPlayer) return;
  localPlayer.flying    = mods.fly;
  localPlayer.speedMult = mods.speed ? 3 : 1;
}

function modBtn(id, key) {
  const btn = document.getElementById(id);
  btn.addEventListener('click', () => {
    mods[key] = !mods[key];
    btn.textContent = mods[key] ? 'ON' : 'OFF';
    btn.classList.toggle('on', mods[key]);
    applyMods();
  });
}
modBtn('mod-fly',   'fly');
modBtn('mod-speed', 'speed');
modBtn('mod-jumps', 'jumps');
modBtn('mod-ghost', 'ghost');

function openModMenu() {
  if (document.pointerLockElement) document.exitPointerLock();
  document.getElementById('mod-menu').style.display = 'flex';
}
function closeModMenu() {
  document.getElementById('mod-menu').style.display = 'none';
}

document.addEventListener('keydown', (e) => {
  konamiBuffer.push(e.code);
  if (konamiBuffer.length > 11) konamiBuffer.shift();
  const buf = konamiBuffer.join(',');
  if (buf === KONAMI_ARROW.join(',') || buf === KONAMI_WASD.join(',')) {
    konamiBuffer = [];
    if (document.getElementById('mod-menu').style.display === 'flex') closeModMenu();
    else openModMenu();
  }
  if (e.code === 'Escape' && document.getElementById('mod-menu').style.display === 'flex') {
    closeModMenu();
  }
});

// Lobby
document.addEventListener('keydown', (e) => {
  if (e.code === 'Digit2' && localBody) {
    localBody.toggle();
    if (localPlayer) localPlayer.thirdPerson = localBody.thirdPerson;
  }
});

document.getElementById('join-btn').addEventListener('click', () => {
  const username = document.getElementById('username-input').value.trim() || 'Player';
  const room = document.getElementById('room-input').value.trim().toUpperCase() || 'MAIN';
  preview.dispose();
  network.join(room, username, selectedColor, selectedHat);
});

['username-input', 'room-input'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('join-btn').click();
  });
});
