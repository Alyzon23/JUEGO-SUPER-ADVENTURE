// ═══════════════════════════════════════════════
//  SUPER ADVENTURE - Motor del juego
// ═══════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 900;
canvas.height = 600;

// ── Velocidad del jugador (configurable) ──
let playerSpeed = 4.5;

// ── Estado global ──
let gameState = { running: false, paused: false, score: 0, coins: 0, lives: 3, level: 1 };
let animId = null;
let particles = [];
let camera = { x: 0 };
let pipeAnim = null; // { timer, done }

// ── Input ──
const keys = {};
document.addEventListener('keydown', e => {
  if (e.code === 'Escape' && gameState.running) togglePause();
  if (!keys[e.code]) {
    keys[e.code] = true;
    if ((e.code === 'Space' || e.code === 'ArrowUp') && gameState.running && !gameState.paused) player.jump();
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ═══════════════════════════════════════════════
//  JUGADOR
// ═══════════════════════════════════════════════
const player = {
  x: 100, y: 300, w: 36, h: 44,
  vx: 0, vy: 0,
  onGround: false,
  jumpsLeft: 2,
  facing: 1,
  frame: 0, frameTimer: 0,
  invincible: 0,
  trail: [],

  jump() {
    if (this.jumpsLeft > 0) {
      this.vy = this.jumpsLeft === 2 ? -14 : -12;
      this.jumpsLeft--;
      spawnParticles(this.x + this.w / 2, this.y + this.h, '#00d4ff', 8);
    }
  },

  update() {
    // Movimiento horizontal
    const speed = playerSpeed;
    if (keys['ArrowLeft'])  { this.vx = -speed; this.facing = -1; }
    else if (keys['ArrowRight']) { this.vx = speed; this.facing = 1; }
    else this.vx *= 0.8;

    // Gravedad
    this.vy += 0.55;
    if (this.vy > 18) this.vy = 18;

    this.x += this.vx;
    this.y += this.vy;

    // Trail
    this.trail.push({ x: this.x + this.w / 2, y: this.y + this.h / 2 });
    if (this.trail.length > 8) this.trail.shift();

    // Colisión plataformas
    this.onGround = false;
    for (const p of currentLevel.platforms) {
      if (rectOverlap(this, p)) resolveCollision(this, p);
    }
    if (this.onGround) this.jumpsLeft = 2;

    // Límite izquierdo
    if (this.x < camera.x) { this.x = camera.x; this.vx = 0; }

    // Caída al vacío
    if (this.y > canvas.height + 50 && !gameState.dying) loseLife();

    // Animación
    this.frameTimer++;
    if (this.frameTimer > 8) { this.frame = (this.frame + 1) % 4; this.frameTimer = 0; }

    if (this.invincible > 0) this.invincible--;
  },

  draw() {
    // Trail - solo dibuja si hay suficientes puntos
    if (this.trail.length > 1) {
      this.trail.forEach((t, i) => {
        const alpha = ((i + 1) / this.trail.length) * 0.25;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#00d4ff';
        ctx.beginPath();
        ctx.arc(t.x - camera.x, t.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;

    const px = this.x - camera.x;
    const py = this.y;

    // Parpadea solo cuando fue golpeado (invincible bajo 80)
    if (this.invincible > 0 && this.invincible < 80 && Math.floor(this.invincible / 6) % 2 === 0) return;

    ctx.save();
    ctx.translate(px + this.w / 2, py + this.h / 2);
    ctx.scale(this.facing, 1);

    // Sombra
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 15;

    // Cuerpo
    const grad = ctx.createLinearGradient(-this.w / 2, -this.h / 2, this.w / 2, this.h / 2);
    grad.addColorStop(0, '#4fc3f7');
    grad.addColorStop(1, '#0080ff');
    ctx.fillStyle = grad;
    roundRect(ctx, -this.w / 2, -this.h / 2, this.w, this.h, 8);
    ctx.fill();

    // Visor
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    roundRect(ctx, -10, -this.h / 2 + 6, 20, 12, 4);
    ctx.fill();

    // Ojos
    ctx.fillStyle = '#001a33';
    ctx.beginPath(); ctx.arc(-4, -this.h / 2 + 12, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -this.h / 2 + 12, 3, 0, Math.PI * 2); ctx.fill();

    // Brillo
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    roundRect(ctx, -this.w / 2 + 4, -this.h / 2 + 4, 10, 16, 4);
    ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0;
  }
};

// ═══════════════════════════════════════════════
//  NIVELES
// ═══════════════════════════════════════════════
function buildLevel(n) {
  const colors = ['#1a3a6e', '#1a4a2e', '#4a1a3e'];
  const bgColor = colors[(n - 1) % colors.length];

  const platforms = [
    // Suelo base
    { x: 0,    y: 520, w: 400,  h: 80, color: '#2d5a8e' },
    { x: 450,  y: 520, w: 300,  h: 80, color: '#2d5a8e' },
    { x: 800,  y: 520, w: 400,  h: 80, color: '#2d5a8e' },
    { x: 1250, y: 520, w: 350,  h: 80, color: '#2d5a8e' },
    { x: 1650, y: 520, w: 500,  h: 80, color: '#2d5a8e' },
    // Plataformas flotantes
    { x: 200,  y: 400, w: 120,  h: 20, color: '#3d7abf' },
    { x: 420,  y: 340, w: 100,  h: 20, color: '#3d7abf' },
    { x: 600,  y: 280, w: 130,  h: 20, color: '#3d7abf' },
    { x: 780,  y: 360, w: 110,  h: 20, color: '#3d7abf' },
    { x: 950,  y: 300, w: 140,  h: 20, color: '#3d7abf' },
    { x: 1100, y: 380, w: 100,  h: 20, color: '#3d7abf' },
    { x: 1280, y: 320, w: 120,  h: 20, color: '#3d7abf' },
    { x: 1450, y: 260, w: 130,  h: 20, color: '#3d7abf' },
    { x: 1620, y: 340, w: 110,  h: 20, color: '#3d7abf' },
  ];

  const coins = [];
  [[250,370],[470,310],[650,250],[830,330],[1000,270],[1150,350],[1330,290],[1500,230],[1670,310],
   [280,370],[500,310],[680,250],[860,330],[1030,270]].forEach(([x,y]) => {
    coins.push({ x, y, w: 20, h: 20, collected: false, bobOffset: Math.random() * Math.PI * 2 });
  });

  const enemies = [
    { x: 500,  y: 490, w: 36, h: 36, vx: 1.5,  minX: 450,  maxX: 730,  frame: 0, ft: 0 },
    { x: 850,  y: 490, w: 36, h: 36, vx: -1.5, minX: 800,  maxX: 1180, frame: 0, ft: 0 },
    { x: 1300, y: 490, w: 36, h: 36, vx: 1.5,  minX: 1250, maxX: 1580, frame: 0, ft: 0 },
    { x: 630,  y: 250, w: 36, h: 36, vx: 1.2,  minX: 600,  maxX: 720,  frame: 0, ft: 0 },
    { x: 960,  y: 270, w: 36, h: 36, vx: -1.2, minX: 950,  maxX: 1070, frame: 0, ft: 0 },
  ];

  // Tubo verde al final
  const goal = { x: 2000, y: 430, w: 60, h: 90 };

  return { bgColor, platforms, coins, enemies, goal, width: 2200 };
}

let currentLevel = buildLevel(1);

// ═══════════════════════════════════════════════
//  PARTÍCULAS
// ═══════════════════════════════════════════════
function spawnParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 40 + Math.random() * 20,
      maxLife: 60,
      color,
      size: 3 + Math.random() * 4
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.15;
    p.vx *= 0.95;
    p.life--;
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0.01, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y, Math.max(0.1, p.size * (p.life / p.maxLife)), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

// ═══════════════════════════════════════════════
//  FONDO PARALLAX
// ═══════════════════════════════════════════════
function drawBackground() {
  // Cielo degradado
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, currentLevel.bgColor);
  sky.addColorStop(1, '#050510');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Estrellas (parallax lento)
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  const starSeed = [
    [50,40],[150,80],[250,30],[350,90],[450,50],[550,20],[650,70],[750,45],[850,85],
    [100,120],[200,150],[300,100],[400,130],[500,110],[600,140],[700,90],[800,160],
    [120,200],[220,180],[320,220],[420,190],[520,210],[620,170],[720,230],[820,195],
  ];
  starSeed.forEach(([sx, sy]) => {
    const px = ((sx - camera.x * 0.1) % canvas.width + canvas.width) % canvas.width;
    ctx.beginPath();
    ctx.arc(px, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Montañas lejanas (parallax medio)
  ctx.fillStyle = 'rgba(30,50,100,0.5)';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  const mOffset = camera.x * 0.3;
  [0,120,200,320,400,520,600,720,800,900].forEach((mx, i) => {
    const h = i % 2 === 0 ? 200 : 140;
    ctx.lineTo(((mx - mOffset) % 900 + 900) % 900, canvas.height - h);
  });
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fill();
}

// ═══════════════════════════════════════════════
//  PLATAFORMAS
// ═══════════════════════════════════════════════
function drawPlatforms() {
  currentLevel.platforms.forEach(p => {
    const px = p.x - camera.x;
    if (px + p.w < 0 || px > canvas.width) return;

    // Sombra suave
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    const grad = ctx.createLinearGradient(px, p.y, px, p.y + p.h);
    grad.addColorStop(0, lighten(p.color, 20));
    grad.addColorStop(1, p.color);
    ctx.fillStyle = grad;
    roundRect(ctx, px, p.y, p.w, p.h, p.h > 40 ? 6 : 10);
    ctx.fill();

    // Borde superior brillante
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 10, p.y + 1);
    ctx.lineTo(px + p.w - 10, p.y + 1);
    ctx.stroke();
  });
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
}

// ═══════════════════════════════════════════════
//  MONEDAS
// ═══════════════════════════════════════════════
function drawCoins(t) {
  currentLevel.coins.forEach(c => {
    if (c.collected) return;
    const px = c.x - camera.x;
    if (px + c.w < 0 || px > canvas.width) return;
    const bob = Math.sin(t * 0.05 + c.bobOffset) * 5;

    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 15;

    const grad = ctx.createRadialGradient(px + c.w/2, c.y + bob + c.h/2, 2, px + c.w/2, c.y + bob + c.h/2, c.w/2);
    grad.addColorStop(0, '#fff176');
    grad.addColorStop(1, '#ffa000');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px + c.w / 2, c.y + bob + c.h / 2, c.w / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(px + c.w / 2 - 3, c.y + bob + c.h / 2 - 3, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  });
}

function updateCoins() {
  currentLevel.coins.forEach(c => {
    if (c.collected) return;
    if (rectOverlap(player, { x: c.x, y: c.y, w: c.w, h: c.h })) {
      c.collected = true;
      gameState.coins++;
      gameState.score += 100;
      spawnParticles(c.x + c.w / 2, c.y + c.h / 2, '#ffd700', 10);
      updateHUD();
    }
  });
}

// ═══════════════════════════════════════════════
//  ENEMIGOS
// ═══════════════════════════════════════════════
function drawEnemies() {
  currentLevel.enemies.forEach(e => {
    if (e.dead) return;
    const px = e.x - camera.x;
    if (px + e.w < 0 || px > canvas.width) return;

    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 12;

    const grad = ctx.createLinearGradient(px, e.y, px + e.w, e.y + e.h);
    grad.addColorStop(0, '#ff6b6b');
    grad.addColorStop(1, '#cc0000');
    ctx.fillStyle = grad;
    roundRect(ctx, px, e.y, e.w, e.h, 8);
    ctx.fill();

    // Ojos
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px + 10, e.y + 12, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 26, e.y + 12, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(px + 11, e.y + 13, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 27, e.y + 13, 3, 0, Math.PI * 2); ctx.fill();

    // Cuernos
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.moveTo(px + 8, e.y); ctx.lineTo(px + 4, e.y - 10); ctx.lineTo(px + 14, e.y); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px + 22, e.y); ctx.lineTo(px + 18, e.y - 10); ctx.lineTo(px + 28, e.y); ctx.fill();
  });
  ctx.shadowBlur = 0;
}

function updateEnemies() {
  currentLevel.enemies.forEach(e => {
    if (e.dead) return;
    e.x += e.vx;
    if (e.x < e.minX || e.x + e.w > e.maxX) e.vx *= -1;

    if (player.invincible > 0) return;
    if (rectOverlap(player, e)) {
      // Saltar encima = matar enemigo
      if (player.vy > 0 && player.y + player.h < e.y + e.h / 2) {
        e.dead = true;
        player.vy = -10;
        gameState.score += 200;
        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#ff4444', 15);
        updateHUD();
      } else {
        loseLife();
      }
    }
  });
}

// ═══════════════════════════════════════════════
//  META / BANDERA
// ═══════════════════════════════════════════════
function drawGoal(t) {
  const g = currentLevel.goal;
  const px = g.x - camera.x;
  if (px + g.w < 0 || px > canvas.width) return;

  // Sombra tubo
  ctx.shadowColor = '#00aa00';
  ctx.shadowBlur = 18;

  // Cuerpo del tubo
  const tubeGrad = ctx.createLinearGradient(px, g.y, px + g.w, g.y);
  tubeGrad.addColorStop(0, '#1a7a1a');
  tubeGrad.addColorStop(0.4, '#44cc44');
  tubeGrad.addColorStop(1, '#1a5a1a');
  ctx.fillStyle = tubeGrad;
  roundRect(ctx, px + 5, g.y + 20, g.w - 10, g.h - 20, 6);
  ctx.fill();

  // Borde superior del tubo (más ancho)
  const topGrad = ctx.createLinearGradient(px, g.y, px + g.w, g.y);
  topGrad.addColorStop(0, '#1a6a1a');
  topGrad.addColorStop(0.4, '#55dd55');
  topGrad.addColorStop(1, '#1a4a1a');
  ctx.fillStyle = topGrad;
  roundRect(ctx, px, g.y, g.w, 24, 8);
  ctx.fill();

  // Brillo
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  roundRect(ctx, px + 8, g.y + 4, 12, g.h - 10, 4);
  ctx.fill();

  // Flecha animada arriba del tubo
  const bounce = Math.sin(t * 0.1) * 5;
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 10;
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('▼', px + g.w / 2, g.y - 10 + bounce);
  ctx.shadowBlur = 0;
}

function checkGoal() {
  const g = currentLevel.goal;
  if (rectOverlap(player, g) && !pipeAnim) {
    pipeAnim = { timer: 0 };
    player.vx = 0;
  }
}

function updatePipeAnim() {
  if (!pipeAnim) return;
  pipeAnim.timer++;

  // Fase 1 (0-20): jugador salta hacia arriba
  if (pipeAnim.timer <= 20) {
    player.vy = -6;
    player.vx = 0;
  }
  // Fase 2 (20-50): jugador baja dentro del tubo
  if (pipeAnim.timer > 20 && pipeAnim.timer <= 50) {
    player.vy = 4;
    player.vx = 0;
    // Encogerse
    player.h = Math.max(4, 44 - (pipeAnim.timer - 20) * 1.4);
  }
  // Fase 3 (50+): cambiar nivel
  if (pipeAnim.timer > 50) {
    player.h = 44;
    pipeAnim = null;
    gameState.score += 500;
    gameState.level++;
    if (gameState.level > 3) {
      showWinScreen();
    } else {
      spawnParticles(player.x + player.w / 2, player.y, '#ffd700', 20);
      loadLevel(gameState.level);
    }
  }
}

function showWinScreen() {
  // Fuegos artificiales en canvas antes de mostrar pantalla
  let fwTick = 0;
  const fwLoop = () => {
    fwTick++;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (fwTick % 18 === 0) {
      const colors = ['#ffd700','#ff4444','#00d4ff','#ff00ff','#00ff88'];
      const cx = 100 + Math.random() * 700;
      const cy = 50 + Math.random() * 300;
      spawnFirework(cx, cy, colors[Math.floor(Math.random() * colors.length)]);
    }
    updateParticles();
    drawParticles();
    if (fwTick < 180) {
      requestAnimationFrame(fwLoop);
    } else {
      showScreen('win-screen');
      document.getElementById('win-score').textContent = gameState.score;
      gameState.running = false;
    }
  };
  cancelAnimationFrame(animId);
  gameState.running = false;
  fwLoop();
}

function spawnFirework(x, y, color) {
  for (let i = 0; i < 30; i++) {
    const angle = (Math.PI * 2 / 30) * i;
    const speed = 3 + Math.random() * 5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 60 + Math.random() * 30,
      maxLife: 90,
      color,
      size: 4 + Math.random() * 4
    });
  }
}

// ═══════════════════════════════════════════════
//  COLISIONES
// ═══════════════════════════════════════════════
function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function resolveCollision(p, plat) {
  const overlapX = Math.min(p.x + p.w, plat.x + plat.w) - Math.max(p.x, plat.x);
  const overlapY = Math.min(p.y + p.h, plat.y + plat.h) - Math.max(p.y, plat.y);

  if (overlapX < overlapY) {
    if (p.x < plat.x) p.x -= overlapX; else p.x += overlapX;
    p.vx = 0;
  } else {
    if (p.y < plat.y) {
      p.y -= overlapY;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.y += overlapY;
      p.vy = 0;
    }
  }
}

// ═══════════════════════════════════════════════
//  CÁMARA
// ═══════════════════════════════════════════════
function updateCamera() {
  const target = player.x - canvas.width / 3;
  camera.x += (target - camera.x) * 0.1;
  camera.x = Math.max(0, Math.min(camera.x, currentLevel.width - canvas.width));
}

// ═══════════════════════════════════════════════
//  HUD
// ═══════════════════════════════════════════════
function updateHUD() {
  document.getElementById('lives').textContent = gameState.lives;
  document.getElementById('score').textContent = gameState.score;
  document.getElementById('coins').textContent = gameState.coins;
  document.getElementById('level').textContent = gameState.level;
}

// ═══════════════════════════════════════════════
//  VIDA / GAME OVER
// ═══════════════════════════════════════════════
function loseLife() {
  if (gameState.dying) return;
  gameState.dying = true;
  gameState.lives--;
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff4444', 20);
  updateHUD();

  if (gameState.lives <= 0) {
    gameState.running = false;
    cancelAnimationFrame(animId);
    setTimeout(() => {
      showScreen('gameover-screen');
      document.getElementById('final-score').textContent = gameState.score;
    }, 800);
  } else {
    setTimeout(() => {
      player.x = 100;
      player.y = 400;
      player.vx = 0;
      player.vy = 0;
      player.h = 44;
      player.invincible = 60;
      camera.x = 0;
      gameState.dying = false;
    }, 800);
  }
}

// ═══════════════════════════════════════════════
//  LOOP PRINCIPAL
// ═══════════════════════════════════════════════
let tick = 0;
function gameLoop() {
  if (!gameState.running || gameState.paused) return;
  tick++;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawPlatforms();
  drawCoins(tick);
  drawGoal(tick);
  drawEnemies();
  drawParticles();
  ctx.globalAlpha = 1;
  player.draw();

  if (!pipeAnim) player.update();
  updatePipeAnim();
  updateEnemies();
  updateCoins();
  checkGoal();
  updateCamera();
  updateParticles();

  animId = requestAnimationFrame(gameLoop);
}

function safeStartLoop() {
  cancelAnimationFrame(animId);
  animId = null;
  gameLoop();
}

// ═══════════════════════════════════════════════
//  PANTALLAS
// ═══════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showMenu() {
  gameState.running = false;
  cancelAnimationFrame(animId);
  showScreen('menu-screen');
}

function showControls() { showScreen('controls-screen'); }

function setSpeed(val) {
  playerSpeed = val;
  document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
  const map = { 2.5: 'speed-lento', 4.5: 'speed-normal', 7: 'speed-rapido', 10: 'speed-turbo' };
  const el = document.getElementById(map[val]);
  if (el) el.classList.add('active');
}

function loadLevel(n) {
  currentLevel = buildLevel(n);
  player.x = 100; player.y = 300;
  player.vx = 0; player.vy = 0;
  player.h = 44;
  player.invincible = 0;
  gameState.dying = false;
  pipeAnim = null;
  camera.x = 0;
  particles = [];
  updateHUD();
}

function startGame() {
  cancelAnimationFrame(animId);
  animId = null;
  gameState = { running: true, paused: false, score: 0, coins: 0, lives: 3, level: 1, dying: false };
  pipeAnim = null;
  loadLevel(1);
  showScreen('game-screen');
  gameLoop();
}

function togglePause() {
  gameState.paused = !gameState.paused;
  document.getElementById('pause-overlay').classList.toggle('hidden', !gameState.paused);
  if (!gameState.paused) { cancelAnimationFrame(animId); gameLoop(); }
}

function resumeGame() {
  gameState.paused = false;
  document.getElementById('pause-overlay').classList.add('hidden');
  cancelAnimationFrame(animId);
  gameLoop();
}

// ═══════════════════════════════════════════════
//  UTILIDADES
// ═══════════════════════════════════════════════
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lighten(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}
