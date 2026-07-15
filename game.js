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

    // Colisión plataformas (fijas + móviles)
    this.onGround = false;
    const allPlats = [...currentLevel.platforms, ...currentLevel.movingPlatforms];
    for (const p of allPlats) {
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

  // ── NIVEL 1: ESPACIO ──
  if (n === 1) {
    return {
      bgColor: '#0a0a2e', bgType: 'space',
      platforms: [
        { x: 0,    y: 520, w: 400, h: 80, color: '#2d5a8e' },
        { x: 450,  y: 520, w: 300, h: 80, color: '#2d5a8e' },
        { x: 800,  y: 520, w: 400, h: 80, color: '#2d5a8e' },
        { x: 1250, y: 520, w: 350, h: 80, color: '#2d5a8e' },
        { x: 1650, y: 520, w: 500, h: 80, color: '#2d5a8e' },
        { x: 200,  y: 400, w: 120, h: 20, color: '#3d7abf' },
        { x: 420,  y: 340, w: 100, h: 20, color: '#3d7abf' },
        { x: 600,  y: 280, w: 130, h: 20, color: '#3d7abf' },
        { x: 780,  y: 360, w: 110, h: 20, color: '#3d7abf' },
        { x: 950,  y: 300, w: 140, h: 20, color: '#3d7abf' },
        { x: 1100, y: 380, w: 100, h: 20, color: '#3d7abf' },
        { x: 1280, y: 320, w: 120, h: 20, color: '#3d7abf' },
        { x: 1450, y: 260, w: 130, h: 20, color: '#3d7abf' },
        { x: 1620, y: 340, w: 110, h: 20, color: '#3d7abf' },
      ],
      movingPlatforms: [],
      spikes: [],
      coins: mkCoins([[250,370],[470,310],[650,250],[830,330],[1000,270],[1150,350],[1330,290],[1500,230],[1670,310]]),
      enemies: [
        { x: 500,  y: 490, w: 36, h: 36, vx: 1.5,  minX: 450,  maxX: 730,  type: 'walk', dead: false },
        { x: 850,  y: 490, w: 36, h: 36, vx: -1.5, minX: 800,  maxX: 1180, type: 'walk', dead: false },
        { x: 1300, y: 490, w: 36, h: 36, vx: 1.5,  minX: 1250, maxX: 1580, type: 'walk', dead: false },
        { x: 630,  y: 250, w: 36, h: 36, vx: 1.2,  minX: 600,  maxX: 720,  type: 'walk', dead: false },
      ],
      goal: { x: 2000, y: 430, w: 60, h: 90 },
      width: 2200
    };
  }

  // ── NIVEL 2: BOSQUE ──
  if (n === 2) {
    return {
      bgColor: '#0a2010', bgType: 'forest',
      platforms: [
        { x: 0,    y: 520, w: 350, h: 80, color: '#3a6b2a' },
        { x: 420,  y: 520, w: 280, h: 80, color: '#3a6b2a' },
        { x: 780,  y: 520, w: 350, h: 80, color: '#3a6b2a' },
        { x: 1200, y: 520, w: 300, h: 80, color: '#3a6b2a' },
        { x: 1600, y: 520, w: 500, h: 80, color: '#3a6b2a' },
        { x: 180,  y: 420, w: 110, h: 20, color: '#4a8a3a' },
        { x: 500,  y: 360, w: 100, h: 20, color: '#4a8a3a' },
        { x: 900,  y: 300, w: 120, h: 20, color: '#4a8a3a' },
        { x: 1100, y: 380, w: 110, h: 20, color: '#4a8a3a' },
        { x: 1350, y: 300, w: 130, h: 20, color: '#4a8a3a' },
        { x: 1550, y: 380, w: 100, h: 20, color: '#4a8a3a' },
      ],
      movingPlatforms: [
        { x: 650,  y: 280, w: 110, h: 20, color: '#5aaa4a', minX: 600,  maxX: 800,  vy: 0, vx: 1.5 },
        { x: 1200, y: 260, w: 110, h: 20, color: '#5aaa4a', minX: 1150, maxX: 1380, vy: 0, vx: -1.5 },
        { x: 1700, y: 350, w: 100, h: 20, color: '#5aaa4a', minX: 1650, maxX: 1900, vy: 0, vx: 1.2 },
      ],
      spikes: [
        { x: 400,  y: 508, w: 20, h: 12 },
        { x: 760,  y: 508, w: 20, h: 12 },
        { x: 1180, y: 508, w: 20, h: 12 },
        { x: 1580, y: 508, w: 20, h: 12 },
      ],
      coins: mkCoins([[230,390],[540,330],[700,250],[950,270],[1140,350],[1390,270],[1590,350],[1750,290]]),
      enemies: [
        { x: 450,  y: 490, w: 36, h: 36, vx: 2,    minX: 420,  maxX: 680,  type: 'walk', dead: false },
        { x: 820,  y: 490, w: 36, h: 36, vx: -2,   minX: 780,  maxX: 1100, type: 'walk', dead: false },
        { x: 1250, y: 490, w: 36, h: 36, vx: 2,    minX: 1200, maxX: 1480, type: 'jump', dead: false, jumpTimer: 0 },
        { x: 1650, y: 490, w: 36, h: 36, vx: -2,   minX: 1600, maxX: 1950, type: 'jump', dead: false, jumpTimer: 60 },
        { x: 900,  y: 270, w: 36, h: 36, vx: 1.5,  minX: 900,  maxX: 1000, type: 'walk', dead: false },
      ],
      goal: { x: 2050, y: 430, w: 60, h: 90 },
      width: 2300
    };
  }

  // ── NIVEL 3: VOLCÁN ──
  return {
    bgColor: '#1a0500', bgType: 'volcano',
    platforms: [
      { x: 0,    y: 520, w: 300, h: 80, color: '#6b2a0a' },
      { x: 380,  y: 520, w: 250, h: 80, color: '#6b2a0a' },
      { x: 720,  y: 520, w: 300, h: 80, color: '#6b2a0a' },
      { x: 1120, y: 520, w: 280, h: 80, color: '#6b2a0a' },
      { x: 1500, y: 520, w: 600, h: 80, color: '#6b2a0a' },
      { x: 150,  y: 420, w: 100, h: 20, color: '#8b4a1a' },
      { x: 480,  y: 360, w: 100, h: 20, color: '#8b4a1a' },
      { x: 850,  y: 300, w: 110, h: 20, color: '#8b4a1a' },
      { x: 1150, y: 380, w: 100, h: 20, color: '#8b4a1a' },
      { x: 1400, y: 300, w: 110, h: 20, color: '#8b4a1a' },
    ],
    movingPlatforms: [
      { x: 650,  y: 260, w: 100, h: 20, color: '#cc5500', minX: 580,  maxX: 820,  vx: 2,    vy: 0 },
      { x: 1250, y: 240, w: 100, h: 20, color: '#cc5500', minX: 1100, maxX: 1380, vx: -2,   vy: 0 },
      { x: 1700, y: 400, w: 90,  h: 20, color: '#cc5500', minX: 1500, maxX: 1900, vx: 0,    vy: 1.5, minY: 350, maxY: 480 },
    ],
    spikes: [
      { x: 360,  y: 508, w: 20, h: 12 },
      { x: 700,  y: 508, w: 20, h: 12 },
      { x: 720,  y: 508, w: 20, h: 12 },
      { x: 1100, y: 508, w: 20, h: 12 },
      { x: 1480, y: 508, w: 20, h: 12 },
      { x: 1500, y: 508, w: 20, h: 12 },
    ],
    coins: mkCoins([[200,390],[520,330],[700,270],[900,270],[1200,350],[1450,270],[1700,370]]),
    enemies: [
      { x: 400,  y: 490, w: 36, h: 36, vx: 2.5,  minX: 380,  maxX: 600,  type: 'chase', dead: false },
      { x: 750,  y: 490, w: 36, h: 36, vx: -2.5, minX: 720,  maxX: 980,  type: 'chase', dead: false },
      { x: 1150, y: 490, w: 36, h: 36, vx: 2.5,  minX: 1120, maxX: 1370, type: 'jump',  dead: false, jumpTimer: 0 },
      { x: 1550, y: 490, w: 36, h: 36, vx: -2.5, minX: 1500, maxX: 1950, type: 'chase', dead: false },
      { x: 860,  y: 270, w: 36, h: 36, vx: 2,    minX: 850,  maxX: 940,  type: 'walk',  dead: false },
      { x: 1410, y: 270, w: 36, h: 36, vx: -2,   minX: 1400, maxX: 1490, type: 'walk',  dead: false },
    ],
    goal: { x: 2100, y: 430, w: 60, h: 90 },
    width: 2400
  };
}

function mkCoins(coords) {
  return coords.map(([x, y]) => ({ x, y, w: 20, h: 20, collected: false, bobOffset: Math.random() * Math.PI * 2 }));
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
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, currentLevel.bgColor);
  sky.addColorStop(1, '#050510');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (currentLevel.bgType === 'space') {
    // Estrellas
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    [[50,40],[150,80],[250,30],[350,90],[450,50],[550,20],[650,70],[750,45],[850,85],
     [100,120],[200,150],[300,100],[400,130],[500,110],[600,140],[700,90],[800,160],
     [120,200],[220,180],[320,220],[420,190],[520,210],[620,170],[720,230],[820,195]]
    .forEach(([sx,sy]) => {
      const px = ((sx - camera.x * 0.1) % canvas.width + canvas.width) % canvas.width;
      ctx.beginPath(); ctx.arc(px, sy, 1.5, 0, Math.PI*2); ctx.fill();
    });
    // Planeta lejano
    const pOff = ((camera.x * 0.05) % 900 + 900) % 900;
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 20;
    const pg = ctx.createRadialGradient(700 - pOff % 200, 120, 10, 700 - pOff % 200, 120, 50);
    pg.addColorStop(0, '#ffaa44'); pg.addColorStop(1, '#cc4400');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(700 - pOff % 200, 120, 50, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    // Montañas
    ctx.fillStyle = 'rgba(30,50,100,0.5)';
    ctx.beginPath(); ctx.moveTo(0, canvas.height);
    const mOff = camera.x * 0.3;
    [0,120,200,320,400,520,600,720,800,900].forEach((mx,i) => {
      ctx.lineTo(((mx-mOff)%900+900)%900, canvas.height - (i%2===0?200:140));
    });
    ctx.lineTo(canvas.width, canvas.height); ctx.closePath(); ctx.fill();
  }

  if (currentLevel.bgType === 'forest') {
    // Cielo verde
    ctx.fillStyle = 'rgba(0,80,20,0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Árboles lejanos
    const tOff = camera.x * 0.2;
    [80,200,320,440,560,680,800,920,1040].forEach((tx, i) => {
      const x = ((tx - tOff) % 1100 + 1100) % 1100;
      const h = 120 + (i % 3) * 40;
      ctx.fillStyle = `rgba(0,${60+i*8},0,0.5)`;
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - 80);
      ctx.lineTo(x - 40, canvas.height - 80 - h);
      ctx.lineTo(x + 40, canvas.height - 80 - h);
      ctx.closePath(); ctx.fill();
    });
    // Luna
    ctx.shadowColor = '#aaffaa'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#ccffcc';
    ctx.beginPath(); ctx.arc(800, 80, 35, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (currentLevel.bgType === 'volcano') {
    // Lava en el fondo
    ctx.fillStyle = 'rgba(180,40,0,0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Volcanes lejanos
    const vOff = camera.x * 0.25;
    [100,300,500,700,900].forEach((vx, i) => {
      const x = ((vx - vOff) % 1000 + 1000) % 1000;
      const h = 150 + i * 30;
      ctx.fillStyle = `rgba(${80+i*10},20,0,0.6)`;
      ctx.beginPath();
      ctx.moveTo(x - 60, canvas.height - 80);
      ctx.lineTo(x, canvas.height - 80 - h);
      ctx.lineTo(x + 60, canvas.height - 80);
      ctx.closePath(); ctx.fill();
      // Lava en la cima
      ctx.fillStyle = `rgba(255,${100+i*20},0,0.8)`;
      ctx.beginPath(); ctx.arc(x, canvas.height - 80 - h, 8, 0, Math.PI*2); ctx.fill();
    });
    // Partículas de lava flotando
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(255,100,0,0.6)';
    [[100,400],[300,350],[500,420],[700,380],[850,410]].forEach(([lx,ly]) => {
      const x = ((lx - camera.x*0.1)%900+900)%900;
      const bob = Math.sin(tick*0.03 + lx)*8;
      ctx.beginPath(); ctx.arc(x, ly+bob, 4, 0, Math.PI*2); ctx.fill();
    });
    ctx.shadowBlur = 0;
  }
}

// ═══════════════════════════════════════════════
//  PLATAFORMAS
// ═══════════════════════════════════════════════
function drawPlatforms() {
  const allPlats = [...currentLevel.platforms, ...currentLevel.movingPlatforms];
  allPlats.forEach(p => {
    const px = p.x - camera.x;
    if (px + p.w < 0 || px > canvas.width) return;
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    const grad = ctx.createLinearGradient(px, p.y, px, p.y + p.h);
    grad.addColorStop(0, lighten(p.color, 20));
    grad.addColorStop(1, p.color);
    ctx.fillStyle = grad;
    roundRect(ctx, px, p.y, p.w, p.h, p.h > 40 ? 6 : 10);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px+10, p.y+1); ctx.lineTo(px+p.w-10, p.y+1); ctx.stroke();
  });
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // Pinchos
  currentLevel.spikes.forEach(s => {
    const px = s.x - camera.x;
    if (px + s.w < 0 || px > canvas.width) return;
    ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#cc0000';
    ctx.beginPath();
    ctx.moveTo(px, s.y + s.h);
    ctx.lineTo(px + s.w/2, s.y);
    ctx.lineTo(px + s.w, s.y + s.h);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
  });
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
  const colors = {
    space:   { top: '#ff6b6b', bot: '#cc0000', shadow: '#ff4444', horn: '#ff8800' },
    forest:  { top: '#6bff6b', bot: '#007700', shadow: '#44ff44', horn: '#ffaa00' },
    volcano: { top: '#ff9944', bot: '#cc4400', shadow: '#ff6600', horn: '#ffff00' },
  };
  const c = colors[currentLevel.bgType] || colors.space;

  currentLevel.enemies.forEach(e => {
    if (e.dead) return;
    const px = e.x - camera.x;
    if (px + e.w < 0 || px > canvas.width) return;
    ctx.shadowColor = c.shadow; ctx.shadowBlur = 12;
    const grad = ctx.createLinearGradient(px, e.y, px + e.w, e.y + e.h);
    grad.addColorStop(0, c.top); grad.addColorStop(1, c.bot);
    ctx.fillStyle = grad;
    roundRect(ctx, px, e.y, e.w, e.h, 8); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px+10, e.y+12, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(px+26, e.y+12, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(px+11, e.y+13, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(px+27, e.y+13, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = c.horn;
    ctx.beginPath(); ctx.moveTo(px+8,e.y); ctx.lineTo(px+4,e.y-10); ctx.lineTo(px+14,e.y); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px+22,e.y); ctx.lineTo(px+18,e.y-10); ctx.lineTo(px+28,e.y); ctx.fill();
    // Signo de exclamación si persigue
    if (e.type === 'chase' && Math.abs(player.x - e.x) < 400) {
      ctx.fillStyle = '#ffff00'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
      ctx.fillText('!', px + e.w/2, e.y - 5);
    }
  });
  ctx.shadowBlur = 0;
}

function updateEnemies() {
  currentLevel.enemies.forEach(e => {
    if (e.dead) return;

    if (e.type === 'walk') {
      e.x += e.vx;
      if (e.x < e.minX || e.x + e.w > e.maxX) e.vx *= -1;
    }

    if (e.type === 'jump') {
      e.x += e.vx;
      if (e.x < e.minX || e.x + e.w > e.maxX) e.vx *= -1;
      e.jumpTimer = (e.jumpTimer || 0) + 1;
      if (!e.vy) e.vy = 0;
      e.vy += 0.5;
      e.y += e.vy;
      if (e.y >= e.baseY) { e.y = e.baseY; e.vy = 0; }
      if (e.jumpTimer > 80) { e.vy = -10; e.jumpTimer = 0; }
    }

    if (e.type === 'chase') {
      const dx = player.x - e.x;
      if (Math.abs(dx) < 400) e.vx = dx > 0 ? Math.abs(e.vx) : -Math.abs(e.vx);
      else { if (e.x < e.minX || e.x + e.w > e.maxX) e.vx *= -1; }
      e.x += e.vx;
    }

    if (!e.baseY) e.baseY = e.y;

    if (player.invincible > 0) return;
    if (rectOverlap(player, e)) {
      if (player.vy > 0 && player.y + player.h < e.y + e.h / 2) {
        e.dead = true; player.vy = -10;
        gameState.score += 200;
        spawnParticles(e.x + e.w/2, e.y + e.h/2, '#ff4444', 15);
        updateHUD();
      } else { loseLife(); }
    }
  });

  // Pinchos
  if (player.invincible === 0) {
    currentLevel.spikes.forEach(s => {
      if (rectOverlap(player, { x: s.x, y: s.y, w: s.w, h: s.h })) loseLife();
    });
  }
}

function updateMovingPlatforms() {
  currentLevel.movingPlatforms.forEach(p => {
    p.x += p.vx || 0;
    p.y += p.vy || 0;
    if (p.vx && (p.x < p.minX || p.x + p.w > p.maxX)) p.vx *= -1;
    if (p.vy && p.minY !== undefined && (p.y < p.minY || p.y > p.maxY)) p.vy *= -1;
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
  updateMovingPlatforms();
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
