(function () {
  "use strict";

  const canvas = document.getElementById("av-canvas");
  const ctx = canvas.getContext("2d");
  const W = 800;
  const H = 600;

  // Low-fx en móvil (SPEC 11): desactiva shadowBlur bajo 768 px, donde el glow
  // gaussiano por-frame es el coste dominante y el viewport pequeño lo hace
  // prescindible para la legibilidad. El glow se mantiene en escritorio.
  function lowFx() {
    return window.innerWidth < 768;
  }

  // ── FPS overlay (dev-only, SPEC 11) ──
  let fpsMeter = null;
  (function loadFps() {
    const mk = () => {
      if (window.AVFps) fpsMeter = window.AVFps.create();
    };
    if (window.AVFps) mk();
    else {
      const s = document.createElement("script");
      s.src = "/games/_shared/fps.js";
      s.onload = mk;
      document.head.appendChild(s);
    }
  })();

  // ── Visual skins ──────────────────────────────────────────────────────────────
  const SKINS = {
    clasico: {
      label: "Clásico",
      boardBg: "#000000",
      shipColor: "#ffffff",
      asteroidColor: "#ffffff",
      bulletColor: "#ffffff",
      particleColor: "255,255,255",
      thrustColor: "rgba(255,130,0,0.85)",
      hudColor: "#ffffff",
      lifeColor: "#ffffff",
      shadowBlur: 0,
      shadowColor: "transparent",
      asteroidLineWidth: 1.5,
      shipLineWidth: 1.5,
    },
    retro: {
      label: "Retro",
      boardBg: "#0d1a0d",
      shipColor: "#39ff14",
      asteroidColor: "#a0c878",
      bulletColor: "#c8ff80",
      particleColor: "160,200,120",
      thrustColor: "rgba(255,200,0,0.80)",
      hudColor: "#39ff14",
      lifeColor: "#39ff14",
      shadowBlur: 0,
      shadowColor: "transparent",
      asteroidLineWidth: 1.5,
      shipLineWidth: 1.5,
    },
    neon: {
      label: "Neón",
      boardBg: "#000000",
      shipColor: "#00f0ff",
      asteroidColor: "#ff35d4",
      bulletColor: "#fff200",
      particleColor: "255,53,212",
      thrustColor: "rgba(0,240,255,0.90)",
      hudColor: "#00f0ff",
      lifeColor: "#00f0ff",
      shadowBlur: 14,
      shadowColor: "#00f0ff",
      asteroidLineWidth: 2,
      shipLineWidth: 2,
    },
  };

  const SKIN_KEY = "asteroids-skin";

  function loadSkinName() {
    try {
      const saved = localStorage.getItem(SKIN_KEY);
      return saved && SKINS[saved] ? saved : "clasico";
    } catch (e) {
      return "clasico";
    }
  }

  let currentSkinName = loadSkinName();
  let skin = SKINS[currentSkinName];

  function applySkin(name) {
    if (!SKINS[name]) name = "clasico";
    currentSkinName = name;
    skin = SKINS[name];
    try {
      localStorage.setItem(SKIN_KEY, name);
    } catch (e) {}
    canvas.style.background = skin.boardBg;
    window.dispatchEvent(
      new CustomEvent("av:skin", { detail: { skin: name } })
    );
  }

  // ── Input ─────────────────────────────────────────────────────────────────────
  const keys = {};
  const justPressed = {};

  window.addEventListener("keydown", (e) => {
    justPressed[e.code] = !keys[e.code];
    keys[e.code] = true;
    if (
      ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
        e.code
      )
    )
      e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  function pressed(code) {
    const val = justPressed[code];
    justPressed[code] = false;
    return val;
  }

  // ── Utils ─────────────────────────────────────────────────────────────────────
  const wrap = (v, max) => ((v % max) + max) % max;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));

  // ── Bullet ────────────────────────────────────────────────────────────────────
  class Bullet {
    constructor(x, y, angle) {
      this.x = x;
      this.y = y;
      const SPEED = 520;
      this.vx = Math.cos(angle) * SPEED;
      this.vy = Math.sin(angle) * SPEED;
      this.ttl = 1.1;
      this.radius = 2;
      this.dead = false;
    }

    update(dt) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      ctx.save();
      if (skin.shadowBlur > 0 && !lowFx()) {
        ctx.shadowBlur = skin.shadowBlur * 0.6;
        ctx.shadowColor = skin.bulletColor;
      }
      ctx.fillStyle = skin.bulletColor;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Asteroid ──────────────────────────────────────────────────────────────────
  const RADII = [0, 16, 30, 50];
  const SPEEDS = [0, 85, 55, 32];
  const POINTS = [0, 100, 50, 20];

  class Asteroid {
    constructor(x, y, size = 3) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.radius = RADII[size];
      this.dead = false;

      const angle = rand(0, Math.PI * 2);
      const speed = SPEEDS[size] + rand(-15, 15);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.rotSpeed = rand(-1.2, 1.2);
      this.rot = rand(0, Math.PI * 2);

      const n = randInt(8, 13);
      this.verts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }

    update(dt) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.rot += this.rotSpeed * dt;
    }

    split() {
      if (this.size <= 1) return [];
      return [
        new Asteroid(this.x, this.y, this.size - 1),
        new Asteroid(this.x, this.y, this.size - 1),
      ];
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      if (skin.shadowBlur > 0 && !lowFx()) {
        ctx.shadowBlur = skin.shadowBlur;
        ctx.shadowColor = skin.asteroidColor;
      }
      ctx.strokeStyle = skin.asteroidColor;
      ctx.lineWidth = skin.asteroidLineWidth;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(this.verts[0][0], this.verts[0][1]);
      for (let i = 1; i < this.verts.length; i++)
        ctx.lineTo(this.verts[i][0], this.verts[i][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Ship ──────────────────────────────────────────────────────────────────────
  class Ship {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = W / 2;
      this.y = H / 2;
      this.angle = -Math.PI / 2;
      this.vx = 0;
      this.vy = 0;
      this.radius = 12;
      this.thrusting = false;
      this.invincible = 3;
      this.shootCooldown = 0;
      this.dead = false;
    }

    update(dt) {
      if (this.dead) return;
      if (this.invincible > 0) this.invincible -= dt;
      if (this.shootCooldown > 0) this.shootCooldown -= dt;

      const ROT = 3.5;
      const THRUST = 260;
      const DRAG = 0.987;

      if (keys["ArrowLeft"]) this.angle -= ROT * dt;
      if (keys["ArrowRight"]) this.angle += ROT * dt;

      this.thrusting = !!keys["ArrowUp"];
      if (this.thrusting) {
        this.vx += Math.cos(this.angle) * THRUST * dt;
        this.vy += Math.sin(this.angle) * THRUST * dt;
      }

      this.vx *= DRAG;
      this.vy *= DRAG;
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
    }

    tryShoot() {
      if (this.shootCooldown > 0 || this.dead) return [];
      this.shootCooldown = 0.2;
      const NOSE = 21;
      const ox = this.x + Math.cos(this.angle) * NOSE;
      const oy = this.y + Math.sin(this.angle) * NOSE;
      return [new Bullet(ox, oy, this.angle)];
    }

    draw() {
      if (this.dead) return;
      if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
        return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      if (skin.shadowBlur > 0 && !lowFx()) {
        ctx.shadowBlur = skin.shadowBlur;
        ctx.shadowColor = skin.shadowColor;
      }
      ctx.strokeStyle = skin.shipColor;
      ctx.lineWidth = skin.shipLineWidth;
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-12, -9);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, 9);
      ctx.closePath();
      ctx.stroke();

      if (this.thrusting && Math.random() > 0.35) {
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-8 - rand(6, 14), 0);
        ctx.lineTo(-8, 4);
        ctx.strokeStyle = skin.thrustColor;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // ── Partículas (explosión) ────────────────────────────────────────────────────
  class Particle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 130);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = rand(0.4, 1.1);
      this.ttl = this.life;
      this.dead = false;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      const alpha = this.ttl / this.life;
      ctx.strokeStyle = `rgba(${skin.particleColor},${alpha.toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
      ctx.stroke();
    }
  }

  // ── CustomEvent helpers ───────────────────────────────────────────────────────
  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  // ── Estado del juego ──────────────────────────────────────────────────────────
  let ship, bullets, asteroids, particles;
  let score, lives, level;
  let state; // 'playing' | 'dead' | 'gameover'
  let deadTimer;
  let paused = false;
  let loopRunning = false;

  function spawnAsteroids(count) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    spawnAsteroids(4);
    emit("av:score", { score });
    emit("av:lives", { lives });
    emit("av:level", { level });
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    ship.reset();
    spawnAsteroids(3 + level);
    emit("av:level", { level });
  }

  function explode(x, y, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    emit("av:lives", { lives });
    if (lives <= 0) {
      state = "gameover";
      emit("av:gameOver", { score });
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────────
  function update(dt) {
    if (state === "gameover") {
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);

    const newAsteroids = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
        }
      }
    }
    if (newAsteroids.length > 0 || asteroids.some((a) => a.dead)) {
      emit("av:score", { score });
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    if (asteroids.length === 0) nextLevel();
  }

  // ── Draw ──────────────────────────────────────────────────────────────────────
  function drawLifeIcon(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    if (skin.shadowBlur > 0 && !lowFx()) {
      ctx.shadowBlur = skin.shadowBlur * 0.5;
      ctx.shadowColor = skin.lifeColor;
    }
    ctx.strokeStyle = skin.lifeColor;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    if (skin.shadowBlur > 0 && !lowFx()) {
      ctx.shadowBlur = skin.shadowBlur * 0.5;
      ctx.shadowColor = skin.hudColor;
    }
    ctx.fillStyle = skin.hudColor;
    ctx.font = "15px monospace";

    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${score}`, 14, 26);

    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${level}`, W / 2, 26);
    ctx.restore();

    for (let i = 0; i < lives; i++) drawLifeIcon(W - 16 - i * 22, 18);
  }

  function draw() {
    ctx.fillStyle = skin.boardBg;
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw());
    asteroids.forEach((a) => a.draw());
    bullets.forEach((b) => b.draw());
    ship.draw();

    drawHUD();
  }

  // ── Loop principal ────────────────────────────────────────────────────────────
  let lastTime = null;
  let rafId = null; // single in-flight requestAnimationFrame handle

  // Schedule the loop only if no frame is already queued → idempotent: callers
  // can't stack duplicate loops by pausing/resuming or restarting repeatedly.
  function schedule() {
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function loop(ts) {
    rafId = null;
    if (paused || state === "gameover") {
      loopRunning = false;
      return; // do NOT re-schedule while paused/over
    }
    loopRunning = true;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    if (fpsMeter) {
      fpsMeter.tick(ts);
      fpsMeter.draw(ctx);
    }
    rafId = requestAnimationFrame(loop);
  }

  // ── API de control expuesta a React ──────────────────────────────────────────
  function pause() {
    paused = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    loopRunning = false;
  }

  function resume() {
    if (paused && state !== "gameover") {
      paused = false;
      lastTime = null;
      schedule();
    }
  }

  function restart() {
    paused = false;
    lastTime = null;
    initGame();
    schedule();
  }

  applySkin(currentSkinName);
  initGame();
  schedule();

  window.ASTEROIDS = {
    pause,
    resume,
    restart,
    setSkin(name) {
      applySkin(name);
    },
    getSkins() {
      return Object.entries(SKINS).map(([key, s]) => ({ key, label: s.label }));
    },
  };
})();
