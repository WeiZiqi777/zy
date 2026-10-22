/* ============================================================
   Veil · 色层之湖
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

/* ---------- 极淡大地灰调（Veil 实感） ---------- */
const VEIL_COLORS = [
  [140, 150, 130],   // 灰橄榄
  [130, 150, 165],   // 灰蓝
  [160, 140, 125],   // 灰褐
  [155, 145, 160],   // 灰紫
  [135, 155, 150],   // 灰青
  [170, 150, 125],   // 淡赭
  [175, 160, 155],   // 灰粉（极淡）
];
let colorCursor = 0;
function nextColor() {
  colorCursor = (colorCursor + 1) % VEIL_COLORS.length;
  return VEIL_COLORS[colorCursor];
}

const LOTUS_CREAM = [240, 230, 215];
const LOTUS_TIP   = [220, 195, 185];
const LEAF_GREEN  = [160, 175, 150];

const streams  = [];
const ripples  = [];
const lotuses  = [];
const leaves   = [];

let currentGesture = 'none';
let gestureStreak   = {};
let palmX = 0, palmY = 0;
let indexTip = { x: 0, y: 0, px: 0, py: 0 };
let fistActive = false;
let lastPinchDist = 0;

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
    thumb:  dist(lm[4],  w) > dist(lm[3],  w) * 1.02,
    index:  dist(lm[8],  w) > dist(lm[6],  w) * 1.1,
    middle: dist(lm[12], w) > dist(lm[10], w) * 1.1,
    ring:   dist(lm[16], w) > dist(lm[14], w) * 1.1,
    pinky:  dist(lm[20], w) > dist(lm[18], w) * 1.1,
  };
}

function classifyGesture(lm) {
  const f = fingerStates(lm);
  const extended = [f.index, f.middle, f.ring, f.pinky].filter(Boolean).length;
  const pinchDist = dist(lm[4], lm[8]);
  lastPinchDist = pinchDist;

  palmX = 1 - (lm[0].x + lm[9].x) / 2;
  palmY = (lm[0].y + lm[9].y) / 2;
  indexTip.px = indexTip.x; indexTip.py = indexTip.y;
  indexTip.x = 1 - lm[8].x;
  indexTip.y = lm[8].y;

  // 优先级：先判捏手（拇指食指靠近最可靠），再判其他
  if (pinchDist < 0.12) return 'pinch';
  if (extended === 0) return 'fist';
  if (f.index && !f.middle && !f.ring && !f.pinky) return 'point';
  if (f.index && f.middle && !f.ring && !f.pinky) return 'peace';
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

function spawnLotus(x, y) {
  lotuses.push({
    x, y, age: 0,
    outer: 8, inner: 6,
    size: 0.12 + Math.random() * 0.05,
    phase: Math.random() * Math.PI * 2,
  });
  for (let i = 0; i < 3; i++) {
    leaves.push({
      x: x + (Math.random() - 0.5) * 0.3,
      y: y + 0.1 + Math.random() * 0.18,
      r: 0.03 + Math.random() * 0.03,
      drift: Math.random() * Math.PI * 2,
      alpha: 0.2,
    });
  }
}

/* ---------- 水的质感：一串径向渐变圆点叠成朦胧色柱 ---------- */
function drawStreamOnBase(s) {
  const prev = Math.max(0, s.length - s.speed * 1.5);
  const topPx = prev * H;
  const botPx = s.length * H;
  if (botPx <= topPx) return;

  const [r, g, b] = s.color;
  const step = 6;  // 每 6px 一个圆点
  for (let y = topPx; y < botPx; y += step) {
    const t = y / H;
    const cx = (s.x0 + s.drift * t * t + Math.sin(t * 15 + s.wobble) * 0.01) * W;
    const rad = s.width * W * (0.6 + 0.4 * Math.sin(t * 12 + s.wobble));
    const a = s.alpha * (0.3 + 0.7 * t);  // 上淡下实

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
  // 多层同心椭圆环，像真实水波
  const rings = 4;
  for (let i = 0; i < rings; i++) {
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

function drawLotus(l) {
  const cx = l.x * W, cy = l.y * H;
  const R = l.size * Math.min(W, H);
  const appear = Math.min(l.age / 40, 1);
  const sway = Math.sin(l.phase + l.age * 0.02) * 0.08;
  const a = appear * 0.75;

  // 外层放射扇形花瓣（参考图1那种炸开的扇形）
  for (let i = 0; i < l.outer; i++) {
    const ang = (i / l.outer) * Math.PI * 2 + sway;
    const halfW = 0.18;  // 扇形半角
    const grad = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
    grad.addColorStop(0, `rgba(${LOTUS_TIP[0]},${LOTUS_TIP[1]},${LOTUS_TIP[2]},${a * 0.3})`);
    grad.addColorStop(0.7, `rgba(${LOTUS_CREAM[0]},${LOTUS_CREAM[1]},${LOTUS_CREAM[2]},${a * 0.5})`);
    grad.addColorStop(1, `rgba(${LOTUS_CREAM[0]},${LOTUS_CREAM[1]},${LOTUS_CREAM[2]},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, ang - halfW, ang + halfW);
    ctx.closePath();
    ctx.fill();
    // 花瓣上的放射细线
    ctx.strokeStyle = `rgba(${LOTUS_TIP[0]},${LOTUS_TIP[1]},${LOTUS_TIP[2]},${a * 0.3})`;
    ctx.lineWidth = 0.8;
    for (let k = -2; k <= 2; k++) {
      const la = ang + k * halfW / 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(la) * R * 0.15, cy + Math.sin(la) * R * 0.15);
      ctx.lineTo(cx + Math.cos(la) * R * 0.95, cy + Math.sin(la) * R * 0.95);
      ctx.stroke();
    }
  }
  // 内层小扇形
  for (let i = 0; i < l.inner; i++) {
    const ang = (i / l.inner) * Math.PI * 2 + sway + 0.3;
    const halfW = 0.15;
    const grad = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 0.6);
    grad.addColorStop(0, `rgba(${LOTUS_CREAM[0]},${LOTUS_CREAM[1]},${LOTUS_CREAM[2]},${a})`);
    grad.addColorStop(1, `rgba(${LOTUS_CREAM[0]},${LOTUS_CREAM[1]},${LOTUS_CREAM[2]},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R * 0.6, ang - halfW, ang + halfW);
    ctx.closePath();
    ctx.fill();
  }
  // 花心
  ctx.fillStyle = `rgba(210,185,130,${a * 0.9})`;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawLeaf(lf) {
  const cx = lf.x * W, cy = lf.y * H;
  const r = lf.r * Math.min(W, H);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, `rgba(${LEAF_GREEN[0]},${LEAF_GREEN[1]},${LEAF_GREEN[2]},${lf.alpha})`);
  grad.addColorStop(0.8, `rgba(${LEAF_GREEN[0]},${LEAF_GREEN[1]},${LEAF_GREEN[2]},${lf.alpha * 0.4})`);
  grad.addColorStop(1, `rgba(${LEAF_GREEN[0]},${LEAF_GREEN[1]},${LEAF_GREEN[2]},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.6, lf.drift, 0, Math.PI * 2);
  ctx.fill();
}

/* ============================================================ */
function frame() {
  ctx.clearRect(0, 0, W, H);

  if (fistActive) {
    bctx.fillStyle = 'rgba(214, 207, 192, 0.05)';
    bctx.fillRect(0, 0, W, H);
  }

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
    rp.alpha *= fistActive ? 0.9 : 0.98;
    if (rp.r > rp.maxR || rp.alpha < 0.02) { ripples.splice(i, 1); continue; }
    drawRipple(rp);
  }

  for (let i = lotuses.length - 1; i >= 0; i--) {
    const l = lotuses[i];
    l.age += fistActive ? 2 : 1;
    if (fistActive && l.age > 120) { lotuses.splice(i, 1); continue; }
    drawLotus(l);
  }

  for (let i = leaves.length - 1; i >= 0; i--) {
    const lf = leaves[i];
    lf.x += Math.sin(lf.drift) * 0.0004;
    lf.y += 0.0003;
    lf.alpha *= fistActive ? 0.92 : 0.999;
    if (lf.alpha < 0.02) { leaves.splice(i, 1); continue; }
    drawLeaf(lf);
  }

  // 调试：左上角显示当前手势
  ctx.fillStyle = 'rgba(80,70,60,0.5)';
  ctx.font = '11px sans-serif';
  ctx.fillText(`${currentGesture}  pinch=${lastPinchDist.toFixed(3)}`, 14, 20);

  requestAnimationFrame(frame);
}

/* ============================================================ */
let pinchHold = 0;
let lotusCooldown = 0;
let rippleCooldown = 0;

function onResults(results) {
  hint.classList.add('fade');

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    currentGesture = 'none';
    fistActive = false;
    pinchHold = 0;
    return;
  }

  const lm = results.multiHandLandmarks[0];
  const g = classifyGesture(lm);
  if (stableGesture(g)) currentGesture = g;

  if (currentGesture === 'peace') {
    for (let i = 0; i < 2; i++) spawnStream(Math.random());
    fistActive = false;
  }

  if (currentGesture === 'point') {
    fistActive = false;
    rippleCooldown--;
    const tipSpeed = Math.hypot(indexTip.x - indexTip.px, indexTip.y - indexTip.py);
    if (tipSpeed > 0.02 && rippleCooldown <= 0) {
      spawnRipple(indexTip.x, indexTip.y);
      rippleCooldown = 16;
    }
  }

  if (currentGesture === 'pinch') {
    fistActive = false;
    pinchHold++;
    lotusCooldown--;
    if (pinchHold > 20 && lotusCooldown <= 0) {
      spawnLotus(palmX, palmY);
      lotusCooldown = 80;
    }
  } else {
    pinchHold = 0;
  }

  if (currentGesture === 'fist') fistActive = true;
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
  .then(() => { hint.textContent = '比耶·倾泻色层   轻点·水面涟漪   捏手·薄纱荷花   握拳·色层隐去'; })
  .catch(() => { hint.textContent = '摄像头启动失败，请检查浏览器权限后刷新'; });

frame();
