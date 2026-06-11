let ctx = null;
function getCtx() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function osc(freq, type, startTime, duration, gainVal, freqEnd) {
  const c = getCtx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type || 'sine';
  o.connect(g); g.connect(c.destination);
  o.frequency.setValueAtTime(freq, startTime);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
  g.gain.setValueAtTime(gainVal, startTime);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  o.start(startTime); o.stop(startTime + duration);
}

function noise(startTime, duration, gainVal, filterFreqStart, filterFreqEnd) {
  const c = getCtx();
  const bufSize = Math.ceil(c.sampleRate * duration);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(filterFreqStart, startTime);
  if (filterFreqEnd) f.frequency.exponentialRampToValueAtTime(filterFreqEnd, startTime + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(gainVal, startTime);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start(startTime); src.stop(startTime + duration);
}

export function playCheckpoint() {
  const c = getCtx();
  const t = c.currentTime;
  osc(523, 'sine', t,        0.15, 0.25);
  osc(659, 'sine', t + 0.1,  0.15, 0.25);
  osc(784, 'sine', t + 0.2,  0.3,  0.25);
}

export function playFinish() {
  const c = getCtx();
  const t = c.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => osc(f, 'sine', t + i * 0.11, 0.4, 0.28));
}

export function playWrongAnswer() {
  const c = getCtx();
  const t = c.currentTime;
  osc(300, 'square', t, 0.35, 0.18, 90);
}

export function playJump() {
  const c = getCtx();
  osc(180, 'sine', c.currentTime, 0.18, 0.15, 360);
}

export function playFall() {
  const c = getCtx();
  noise(c.currentTime, 0.55, 0.25, 1800, 180);
}

export function playFootstep() {
  const c = getCtx();
  const t = c.currentTime;
  noise(t, 0.06, 0.06, 600, 200);
}

// Unlock AudioContext on first user gesture
document.addEventListener('pointerdown', () => getCtx(), { once: true });
