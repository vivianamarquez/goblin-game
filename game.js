const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");
const scoreEl = document.querySelector("#score");
const waveEl = document.querySelector("#wave");
const healthEl = document.querySelector("#health");
const bestEl = document.querySelector("#best");
const streakEl = document.querySelector("#streak");

const W = canvas.width;
const H = canvas.height;
const keys = new Set();
const touchDirs = new Set();
const walls = [
  { x: 136, y: 140, w: 164, h: 34 },
  { x: 418, y: 78, w: 36, h: 166 },
  { x: 656, y: 132, w: 178, h: 34 },
  { x: 142, y: 382, w: 210, h: 34 },
  { x: 532, y: 352, w: 34, h: 160 },
  { x: 690, y: 432, w: 120, h: 34 },
];

let best = Number(localStorage.getItem("goblin-grotto-best") || 0);
let last = 0;
let running = false;
let score = 0;
let wave = 1;
let streak = 0;
let gold = [];
let sentries = [];
let sparks = [];

const player = {
  x: 92,
  y: 92,
  r: 18,
  vx: 0,
  vy: 0,
  health: 3,
  dash: 0,
  invuln: 0,
};

bestEl.textContent = best;

function reset() {
  score = 0;
  wave = 1;
  streak = 0;
  player.x = 92;
  player.y = 92;
  player.vx = 0;
  player.vy = 0;
  player.health = 3;
  player.dash = 0;
  player.invuln = 0;
  gold = [];
  sentries = [];
  sparks = [];
  spawnWave();
  syncHud();
}

function spawnWave() {
  gold = Array.from({ length: 7 + wave }, () => placeAwayFromWalls(14));
  sentries = Array.from({ length: 3 + Math.floor(wave * 0.85) }, (_, i) => {
    const p = placeAwayFromWalls(20, 220);
    return {
      ...p,
      r: 19,
      speed: 88 + wave * 8 + i * 3,
      phase: Math.random() * Math.PI * 2,
      stun: 0,
    };
  });
}

function placeAwayFromWalls(radius, fromPlayer = 80) {
  for (let tries = 0; tries < 600; tries += 1) {
    const p = {
      x: radius + 30 + Math.random() * (W - radius * 2 - 60),
      y: radius + 40 + Math.random() * (H - radius * 2 - 80),
      r: radius,
    };
    if (
      dist(p, player) > fromPlayer &&
      !walls.some((wall) => circleRectHit(p, wall))
    ) {
      return p;
    }
  }
  return { x: W - 80, y: H - 80, r: radius };
}

function syncHud() {
  scoreEl.textContent = score;
  waveEl.textContent = wave;
  healthEl.textContent = player.health;
  streakEl.textContent = streak;
  bestEl.textContent = best;
}

function start() {
  reset();
  running = true;
  overlay.classList.add("is-hidden");
  last = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  update(dt);
  draw(now / 1000);
  if (running) requestAnimationFrame(loop);
}

function update(dt) {
  let ax = 0;
  let ay = 0;
  if (keys.has("arrowleft") || keys.has("a") || touchDirs.has("left")) ax -= 1;
  if (keys.has("arrowright") || keys.has("d") || touchDirs.has("right")) ax += 1;
  if (keys.has("arrowup") || keys.has("w") || touchDirs.has("up")) ay -= 1;
  if (keys.has("arrowdown") || keys.has("s") || touchDirs.has("down")) ay += 1;

  const mag = Math.hypot(ax, ay) || 1;
  const dashing = player.dash > 0;
  const speed = dashing ? 470 : 230;
  player.vx = (ax / mag) * speed;
  player.vy = (ay / mag) * speed;
  moveCircle(player, player.vx * dt, player.vy * dt);
  player.dash = Math.max(0, player.dash - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  for (const sentry of sentries) {
    sentry.stun = Math.max(0, sentry.stun - dt);
    const angle = Math.atan2(player.y - sentry.y, player.x - sentry.x);
    const wobble = Math.sin(performance.now() / 500 + sentry.phase) * 0.72;
    const pace = sentry.stun > 0 ? 0 : sentry.speed;
    moveCircle(sentry, Math.cos(angle + wobble) * pace * dt, Math.sin(angle + wobble) * pace * dt);
    if (dist(player, sentry) < player.r + sentry.r && player.invuln <= 0) {
      if (player.dash > 0) {
        sentry.stun = 1.1;
        burst(sentry.x, sentry.y, "#f1c84c", 10);
      } else {
        player.health -= 1;
        player.invuln = 1.3;
        streak = 0;
        burst(player.x, player.y, "#e06458", 14);
        if (player.health <= 0) endRun();
      }
    }
  }

  gold = gold.filter((coin) => {
    if (dist(player, coin) < player.r + coin.r + 4) {
      score += 10 + wave * 2;
      streak += 1;
      burst(coin.x, coin.y, "#f1c84c", 8);
      return false;
    }
    return true;
  });

  if (gold.length === 0) {
    wave += 1;
    player.health = Math.min(5, player.health + 1);
    spawnWave();
    burst(W / 2, H / 2, "#79b75d", 24);
  }

  for (const spark of sparks) {
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.life -= dt;
  }
  sparks = sparks.filter((spark) => spark.life > 0);
  syncHud();
}

function moveCircle(actor, dx, dy) {
  actor.x = clamp(actor.x + dx, actor.r + 8, W - actor.r - 8);
  for (const wall of walls) pushOut(actor, wall, "x");
  actor.y = clamp(actor.y + dy, actor.r + 8, H - actor.r - 8);
  for (const wall of walls) pushOut(actor, wall, "y");
}

function pushOut(circle, rect, axis) {
  if (!circleRectHit(circle, rect)) return;
  if (axis === "x") {
    circle.x = circle.x < rect.x + rect.w / 2 ? rect.x - circle.r : rect.x + rect.w + circle.r;
  } else {
    circle.y = circle.y < rect.y + rect.h / 2 ? rect.y - circle.r : rect.y + rect.h + circle.r;
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 190;
    sparks.push({
      x,
      y,
      color,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.45,
    });
  }
}

function endRun() {
  running = false;
  best = Math.max(best, score);
  localStorage.setItem("goblin-grotto-best", String(best));
  syncHud();
  overlay.querySelector("h1").textContent = "Run Over";
  overlay.querySelector("p").textContent = `You escaped with ${score} loot. Best haul: ${best}.`;
  startButton.textContent = "Try Again";
  overlay.classList.remove("is-hidden");
}

function draw(t) {
  ctx.clearRect(0, 0, W, H);
  drawCave();
  for (const coin of gold) drawCoin(coin, t);
  for (const wall of walls) drawWall(wall);
  for (const sentry of sentries) drawSentry(sentry, t);
  drawGoblin(player, t);
  for (const spark of sparks) drawSpark(spark);
  drawVignette();
}

function drawCave() {
  ctx.fillStyle = "#15170f";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(246,240,220,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 80, H);
    ctx.stroke();
  }
  for (let y = 36; y < H; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y + Math.sin(y) * 12);
    ctx.stroke();
  }
}

function drawWall(wall) {
  ctx.fillStyle = "#34382b";
  roundRect(wall.x, wall.y, wall.w, wall.h, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(246,240,220,0.12)";
  ctx.stroke();
}

function drawCoin(coin, t) {
  const bob = Math.sin(t * 5 + coin.x) * 3;
  ctx.save();
  ctx.translate(coin.x, coin.y + bob);
  ctx.fillStyle = "#f1c84c";
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 15, Math.sin(t * 4) * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff0a6";
  ctx.fillRect(-2, -9, 4, 18);
  ctx.restore();
}

function drawGoblin(g, t) {
  const blink = g.invuln > 0 && Math.floor(t * 16) % 2 === 0;
  if (blink) return;
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.fillStyle = "#79b75d";
  ctx.beginPath();
  ctx.moveTo(-18, -6);
  ctx.lineTo(-34, -20);
  ctx.lineTo(-23, 2);
  ctx.moveTo(18, -6);
  ctx.lineTo(34, -20);
  ctx.lineTo(23, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#203017";
  ctx.beginPath();
  ctx.arc(-8, -4, 3, 0, Math.PI * 2);
  ctx.arc(8, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#203017";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 4, 9, 0.1, Math.PI - 0.1);
  ctx.stroke();
  ctx.fillStyle = "#f6f0dc";
  ctx.fillRect(-4, 11, 3, 7);
  ctx.fillRect(3, 11, 3, 7);
  ctx.restore();
}

function drawSentry(s, t) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(Math.sin(t * 2 + s.phase) * 0.12);
  ctx.fillStyle = s.stun > 0 ? "#8f9272" : "#e06458";
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a1010";
  ctx.fillRect(-12, -3, 8, 5);
  ctx.fillRect(4, -3, 8, 5);
  ctx.strokeStyle = "#f6f0dc";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, 10);
  ctx.lineTo(8, 10);
  ctx.stroke();
  ctx.restore();
}

function drawSpark(spark) {
  ctx.globalAlpha = clamp(spark.life * 2.5, 0, 1);
  ctx.fillStyle = spark.color;
  ctx.beginPath();
  ctx.arc(spark.x, spark.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawVignette() {
  const gradient = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, W * 0.72);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circleRectHit(circle, rect) {
  const nx = clamp(circle.x, rect.x, rect.x + rect.w);
  const ny = clamp(circle.y, rect.y, rect.y + rect.h);
  return Math.hypot(circle.x - nx, circle.y - ny) < circle.r;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function dash() {
  if (!running || player.dash > 0) return;
  player.dash = 0.16;
}

window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.code === "Space") {
    event.preventDefault();
    dash();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

for (const button of document.querySelectorAll(".touch-pad button")) {
  const dir = button.dataset.dir;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (dir === "dash") dash();
    else touchDirs.add(dir);
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointerup", () => touchDirs.delete(dir));
  button.addEventListener("pointercancel", () => touchDirs.delete(dir));
}

startButton.addEventListener("click", start);
draw(0);
