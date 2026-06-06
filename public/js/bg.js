(() => {
  const canvas = document.createElement("canvas");
  canvas.id = "bg-canvas";
  Object.assign(canvas.style, {
    position: "fixed", inset: "0", width: "100%", height: "100%",
    zIndex: "-1", pointerEvents: "none",
  });
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  let W, H;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const ORBS = [
    { x: 0.15, y: 0.25, r: 320, color: "124,58,237",  speed: 0.00018, phase: 0 },
    { x: 0.80, y: 0.15, r: 260, color: "167,139,250", speed: 0.00023, phase: 2.1 },
    { x: 0.70, y: 0.80, r: 300, color: "79,70,229",   speed: 0.00015, phase: 4.5 },
    { x: 0.30, y: 0.75, r: 200, color: "196,84,252",  speed: 0.00021, phase: 1.3 },
  ];

  const PARTICLES = Array.from({ length: 90 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.4 + 0.3,
    alpha: Math.random() * 0.5 + 0.1,
    vx: (Math.random() - 0.5) * 0.00008,
    vy: (Math.random() - 0.5) * 0.00008,
    twinkle: Math.random() * Math.PI * 2,
    twinkleSpeed: Math.random() * 0.02 + 0.005,
  }));

  let t = 0;

  function draw(ts) {
    t = ts;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = "rgba(120,80,255,0.045)";
    ctx.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    for (const o of ORBS) {
      const cx = (o.x + Math.sin(t * o.speed + o.phase) * 0.08) * W;
      const cy = (o.y + Math.cos(t * o.speed * 0.7 + o.phase) * 0.07) * H;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, o.r);
      grad.addColorStop(0,   `rgba(${o.color},0.18)`);
      grad.addColorStop(0.4, `rgba(${o.color},0.07)`);
      grad.addColorStop(1,   `rgba(${o.color},0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, o.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    for (const p of PARTICLES) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = 1;
      if (p.x > 1) p.x = 0;
      if (p.y < 0) p.y = 1;
      if (p.y > 1) p.y = 0;
      p.twinkle += p.twinkleSpeed;
      const a = p.alpha * (0.5 + 0.5 * Math.sin(p.twinkle));
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,185,255,${a})`;
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
