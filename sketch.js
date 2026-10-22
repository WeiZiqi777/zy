/* ============================================================
   Veil · 色层之湖
   比耶 = 色流垂落 / 轻点 = 涟漪 / 握拳 = 清空
   ============================================================ */

const video     = document.getElementById('cam');
const baseCv    = document.getElementById('base');
const sceneCv   = document.getElementById('scene');
const bctx      = baseCv.getContext('2d');
const ctx       = sceneCv.getContext('2d');
const hint      = document.getElementById('hint');

let W = 0, H = 0;
function resize() {
  W = baseCv.width = sceneCv.width  = window.innerWidth;
  H = baseCv.height = sceneCv.height = window.innerHeight;
  paintBase();
}
window.addEventListener('resize', resize);

function paintBase() {
  const g = bctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#d6cfc0');
  g.addColorStop(1, '#c0b8a8');
  bctx.fillStyle = g;
  bctx.fillRect(0, 0, W, H);
}

/* ---------- 大地灰调 ---------- */
const VEIL_COLORS = [
  [140, 150, 130],
  [130, 150, 165],
  [160, 140, 125],
  [155, 145, 160],
  [135, 155, 150],
  [170, 150, 125],
  [175, 160, 155],
];
let colorCursor = 0;
function nextColor() {
  colorCursor = (colorCursor + 1) % VEIL_COLORS.length;
  return VEIL_COLORS[colorCursor];
}

const streams  = [];
const ripples  = [];

let currentGesture = 'none';
let gestureStreak   = {};
let palmX = 0, palmY = 0;
let indexTip = { x: 0, y: 0, px: 0, py: 0 };

function stableGesture(g) {
  gestureStreak[g] = (gestureStreak[g] || 0) + 1;
  for (const k in gestureStreak) if (k !== g) gestureStreak[k] = 0;
  return gestureStreak[g] >= 3;
}

/* ============================================================ */
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function fingerStates(lm) {
  const w = lm[0];
  return {
    index:  dist(lm[8],  w) > dist(lm[6],  w) * 1.1,
    middle: dist(lm[12], w) > dist(lm[10], w) * 1.1,
    ring:   dist(lm[16], w) > dist(lm[14], w) * 1.1,
    pinky:  dist(lm[20], w) > dist(lm[18], w) * 1.1,
  };
}

function classifyGesture(lm) {
  const f = fingerStates(lm);
  const extended = [f.index, f.middle, f.ring, f.pinky].filter(Boolean).length;

  palmX = 1 - (lm[0].x + lm[9].x) / 2;
  palmY = (lm[0].y + lm[9].y) / 2;
  indexTip.px = indexTip.x; indexTip.py = indexTip.y;
  indexTip.x = 1 - lm[8].x;
  indexTip.y = lm[8].y;

  if (extended === 0) return 'fist';
  if (f.index && f.middle && !f.ring && !f.pinky) return 'peace';
  if (f.index && !f.middle && !f.ring && !f.pinky) return 'point';
  if (extended >= 3) return 'open';
  return 'other';
}

/* ============================================================ */
function spawnStream(x) {
  if (streams.length > 50) return;
  streams.push({
    x0: x,
    drift: (Math.random() - 0.5) * 0.2,
    width: 0.06 + Math.random() * 0.1,
    length: 0,
    speed: 0.0012 + Math.random() * 0.002,
    color: nextColor(),
    alpha: 0.08 + Math.random() * 0.05,
    wobble: Math.random() * Math.PI * 2,
    done: false,
  });
}

function spawnRipple(x, y) {
  ripples.push({ x, y, r: 0.005, maxR: 0.2 + Math.random() * 0.1, alpha: 0.35 });
}

/* ---------- 朦胧色柱 ---------- */
function drawStreamOnBase(s) {
  const prev = Math.max(0, s.length - s.speed * 1.5);
  const topPx = prev * H;
  const botPx = s.length * H;
  if (botPx <= topPx) return;

  const [r, g, b] = s.color;
  const step = 6;
  for (let y = topPx; y < botPx; y += step) {
    const t = y / H;
    const cx = (s.x0 + s.drift * t * t + Math.sin(t * 15 + s.wobble) * 0.01) * W;
    const rad = s.width * W * (0.6 + 0.4 * Math.sin(t * 12 + s.wobble));
    const a = s.alpha * (0.3 + 0.7 * t);

    const grad = bctx.createRadialGradient(cx, y, 0, cx, y, rad);
    grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${a * 0.5})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    bctx.fillStyle = grad;
    bctx.beginPath();
    bctx.arc(cx, y, rad, 0, Math.PI * 2);
    bctx.fill();
  }
}

function drawRipple(rp) {
  const cx = rp.x * W, cy = rp.y * H;
  const r = rp.r * Math.min(W, H);
  for (let i = 0; i < 4; i++) {
    const rr = r - i * r * 0.22;
    if (rr <= 1) continue;
    const a = rp.alpha * (1 - i * 0.25);
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rr, rr * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* ============================================================ */
function frame() {
  ctx.clearRect(0, 0, W, H);

  for (let i = streams.length - 1; i >= 0; i--) {
    const s = streams[i];
    if (s.done) { streams.splice(i, 1); continue; }
    s.length += s.speed;
    s.wobble += 0.02;
    drawStreamOnBase(s);
    if (s.length >= 1) s.done = true;
  }

  for (let i = ripples.length - 1; i >= 0; i--) {
    const rp = ripples[i];
    rp.r += 0.0025;
    rp.alpha *= 0.98;
    if (rp.r > rp.maxR || rp.alpha < 0.02) { ripples.splice(i, 1); continue; }
    drawRipple(rp);
  }

  ctx.fillStyle = 'rgba(80,70,60,0.5)';
  ctx.font = '11px sans-serif';
  ctx.fillText(currentGesture, 14, 20);

  requestAnimationFrame(frame);
}

/* ============================================================ */
let rippleCooldown = 0;
let fistCooldown = 0;

function onResults(results) {
  hint.classList.add('fade');

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    currentGesture = 'none';
    return;
  }

  const lm = results.multiHandLandmarks[0];
  const g = classifyGesture(lm);
  if (stableGesture(g)) currentGesture = g;

  if (currentGesture === 'peace') {
    for (let i = 0; i < 2; i++) spawnStream(Math.random());
  }

  if (currentGesture === 'point') {
    rippleCooldown--;
    const tipSpeed = Math.hypot(indexTip.x - indexTip.px, indexTip.y - indexTip.py);
    if (tipSpeed > 0.02 && rippleCooldown <= 0) {
      spawnRipple(indexTip.x, indexTip.y);
      rippleCooldown = 16;
    }
  }

  // 握拳：清空画面
  if (currentGesture === 'fist' && fistCooldown <= 0) {
    paintBase();
    streams.length = 0;
    ripples.length = 0;
    fistCooldown = 30;  // 防止连续触发
  }
  if (currentGesture !== 'fist') fistCooldown = 0;
}

/* ---------- 启动 ---------- */
resize();

const hands = new Hands({
  locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.5,
});
hands.onResults(onResults);

const cam = new Camera(video, {
  onFrame: async () => { await hands.send({ image: video }); },
  width: 640,
  height: 480,
});

cam.start()
  .then(() => { hint.textContent = '比耶·色层留   轻点·涟漪   握拳·清空'; })
  .catch(() => { hint.textContent = '摄像头启动失败，请检查浏览器权限后刷新'; });

frame();
