export const touch = {
  moveX: 0,
  moveZ: 0,
  lookDX: 0,
  lookDY: 0,
  jump: false,
};

export function isMobile() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function initTouchControls() {
  if (!isMobile()) return;

  document.getElementById('controls-hint').style.display = 'none';
  document.getElementById('mobile-ui').style.display = 'block';

  const joystickZone = document.getElementById('joystick-zone');
  const knob         = document.getElementById('joystick-knob');
  const jumpBtn      = document.getElementById('jump-btn');
  const lookZone     = document.getElementById('look-zone');

  const BASE_R = 55;
  let joyOrigin = null;
  let joyTouchId = null;

  // --- Joystick ---
  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyTouchId = t.identifier;
    const rect = joystickZone.getBoundingClientRect();
    joyOrigin = {
      x: rect.left + rect.width / 2,
      y: rect.top  + rect.height / 2,
    };
  }, { passive: false });

  joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== joyTouchId) continue;
      const dx = t.clientX - joyOrigin.x;
      const dy = t.clientY - joyOrigin.y;
      const dist = Math.min(Math.sqrt(dx*dx + dy*dy), BASE_R);
      const angle = Math.atan2(dy, dx);
      const nx = Math.cos(angle) * dist;
      const ny = Math.sin(angle) * dist;
      knob.style.transform = `translate(${nx}px, ${ny}px)`;
      touch.moveX =  nx / BASE_R;
      touch.moveZ =  ny / BASE_R;
    }
  }, { passive: false });

  const endJoy = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyTouchId) continue;
      joyTouchId = null;
      touch.moveX = 0;
      touch.moveZ = 0;
      knob.style.transform = 'translate(0px, 0px)';
    }
  };
  joystickZone.addEventListener('touchend',    endJoy, { passive: false });
  joystickZone.addEventListener('touchcancel', endJoy, { passive: false });

  // --- Look zone ---
  let lookTouchId = null;
  let lookLast = null;

  lookZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (lookTouchId !== null) continue;
      lookTouchId = t.identifier;
      lookLast = { x: t.clientX, y: t.clientY };
    }
  }, { passive: false });

  lookZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      touch.lookDX += t.clientX - lookLast.x;
      touch.lookDY += t.clientY - lookLast.y;
      lookLast = { x: t.clientX, y: t.clientY };
    }
  }, { passive: false });

  const endLook = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookTouchId) { lookTouchId = null; lookLast = null; }
    }
  };
  lookZone.addEventListener('touchend',    endLook, { passive: false });
  lookZone.addEventListener('touchcancel', endLook, { passive: false });

  // --- Jump ---
  jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); touch.jump = true;  }, { passive: false });
  jumpBtn.addEventListener('touchend',   (e) => { e.preventDefault(); touch.jump = false; }, { passive: false });

  // --- Sprint toggle ---
  const sprintBtn = document.getElementById('sprint-btn');
  sprintBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touch.sprint = !touch.sprint;
    sprintBtn.classList.toggle('active', touch.sprint);
  }, { passive: false });
}
