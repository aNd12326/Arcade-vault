(function () {
  const canvas = document.getElementById("av-canvas");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;

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

  // --- Rejilla ---
  const BLOCK_W = 72;
  const BLOCK_H = 36;
  const GAP = 4;
  const GRID_TOP = 60;

  // ---- Visual skins ----
  // Each skin defines colors for the 6 row roles used across all levels:
  // red, yellow, green, cyan, magenta, hotpink
  // Plus paddle, ball, boardBg and a style hint.
  const SKINS = {
    clasico: {
      label: "Clásico",
      style: "classic",
      boardBg: "#0a0a0f",
      ballColor: "#e8e8e8",
      paddleColor: "#c0c0d0",
      paddleHighlight: "rgba(255,255,255,0.35)",
      rowColors: {
        red: "#e03030",
        yellow: "#e8c020",
        green: "#28b040",
        cyan: "#20b8d8",
        magenta: "#c020c0",
        hotpink: "#e8207a",
      },
    },
    retro: {
      label: "Retro",
      style: "flat",
      boardBg: "#1a1a25",
      ballColor: "#d0d0b8",
      paddleColor: "#4a6a8a",
      paddleHighlight: "rgba(255,255,255,0.20)",
      rowColors: {
        red: "#c04040",
        yellow: "#c8a830",
        green: "#4a9050",
        cyan: "#3898a8",
        magenta: "#905890",
        hotpink: "#b84070",
      },
    },
    neon: {
      label: "Neón",
      style: "neon",
      boardBg: "#000000",
      ballColor: "#ffffff",
      paddleColor: "#00d4ff",
      paddleHighlight: "rgba(0,212,255,0.40)",
      rowColors: {
        red: "#ff2050",
        yellow: "#fff200",
        green: "#00ff66",
        cyan: "#00f0ff",
        magenta: "#ff35d4",
        hotpink: "#ff69b4",
      },
    },
  };

  const SKIN_KEY = "arkanoid-skin";

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

  // --- Niveles ---
  const LEVELS = [
    {
      speed: 4,
      rows: 4,
      cols: 10,
      colorByRow: ["red", "yellow", "green", "cyan"],
    },
    {
      speed: 5,
      rows: 5,
      cols: 10,
      colorByRow: ["magenta", "red", "yellow", "green", "cyan"],
    },
    {
      speed: 6,
      rows: 6,
      cols: 10,
      colorByRow: ["hotpink", "magenta", "red", "yellow", "green", "cyan"],
    },
  ];

  // --- Estado global ---
  const game = {
    state: "ready", // 'ready' | 'playing' | 'level_complete' | 'won' | 'lost'
    score: 0,
    lives: 3,
    level: 0,
  };

  // --- Audio ---
  const sounds = {
    bounce: new Audio("assets/sounds/ball-bounce.mp3"),
    break: new Audio("assets/sounds/break-sound.mp3"),
  };
  let muted = false;

  function playSound(key) {
    if (muted) return;
    sounds[key].currentTime = 0;
    sounds[key].play();
  }

  // --- Paddle ---
  const paddle = {
    x: (W - 162) / 2,
    y: H - 40,
    w: 162,
    h: 14,
    speed: 7,
  };

  // --- Bola ---
  const ball = {
    x: paddle.x + paddle.w / 2 - 8,
    y: paddle.y - 16,
    w: 16,
    h: 16,
    vx: 0,
    vy: 0,
    stuck: true,
  };

  // --- Bloques ---
  let blocks = [];

  // Offscreen cache del campo de bloques (SPEC 11): los bloques no se mueven
  // entre roturas, así que se dibujan UNA vez al layer y se blitean cada frame
  // con drawImage. drawBlock (con su shadowBlur del skin neón) deja de correr
  // por-bloque por-frame; solo al invalidar (build / rotura / cambio de skin).
  const blockLayer = document.createElement("canvas");
  blockLayer.width = W;
  blockLayer.height = H;
  const layerCtx = blockLayer.getContext("2d");
  let blocksDirty = true;

  // --- Explosiones activas (visual, sin colisión) ---
  let explosions = [];

  let rafId;
  let gamePaused = false;

  function buildBlocks() {
    const lvl = LEVELS[game.level];
    const gridLeft = (W - (lvl.cols * BLOCK_W + (lvl.cols - 1) * GAP)) / 2;
    blocks = [];
    for (let row = 0; row < lvl.rows; row++) {
      for (let col = 0; col < lvl.cols; col++) {
        blocks.push({
          x: gridLeft + col * (BLOCK_W + GAP),
          y: GRID_TOP + row * (BLOCK_H + GAP),
          w: BLOCK_W,
          h: BLOCK_H,
          color: lvl.colorByRow[row],
          alive: true,
        });
      }
    }
    blocksDirty = true; // nuevo campo de bloques → re-render del layer
  }

  // --- Drawing helpers ---

  // Dibuja un bloque en el contexto `g` (por defecto el layer offscreen). El
  // shadowBlur del skin neón vive aquí, pero solo se ejecuta al re-renderizar el
  // layer (rotura / build / skin), no por-frame.
  function drawBlock(b, g) {
    const color = skin.rowColors[b.color] || "#888888";
    const x = b.x,
      y = b.y,
      w = b.w,
      h = b.h;

    g.save();
    if (skin.style === "neon") {
      g.shadowBlur = 12;
      g.shadowColor = color;
      g.fillStyle = color;
      g.fillRect(x + 1, y + 1, w - 2, h - 2);
      g.shadowBlur = 0;
      g.fillStyle = "rgba(0,0,0,0.45)";
      g.fillRect(x + 5, y + 4, w - 10, h - 8);
      g.strokeStyle = color;
      g.lineWidth = 1.5;
      g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    } else if (skin.style === "flat") {
      // retro: solid color + subtle top highlight, no glow
      g.fillStyle = color;
      g.fillRect(x + 1, y + 1, w - 2, h - 2);
      g.fillStyle = "rgba(255,255,255,0.14)";
      g.fillRect(x + 1, y + 1, w - 2, 4);
    } else {
      // clasico: NES-style with bright top edge and dark bottom edge
      g.fillStyle = color;
      g.fillRect(x + 1, y + 1, w - 2, h - 2);
      g.fillStyle = "rgba(255,255,255,0.30)";
      g.fillRect(x + 1, y + 1, w - 2, 4);
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(x + 1, y + h - 5, w - 2, 4);
    }
    g.restore();
  }

  // Re-renderiza el layer offscreen con los bloques vivos. Llamar solo al
  // invalidar (blocksDirty).
  function renderBlockLayer() {
    layerCtx.clearRect(0, 0, W, H);
    for (const b of blocks) {
      if (!b.alive) continue;
      drawBlock(b, layerCtx);
    }
    blocksDirty = false;
  }

  function drawPaddle() {
    const x = paddle.x,
      y = paddle.y,
      w = paddle.w,
      h = paddle.h;
    ctx.save();
    if (skin.style === "neon") {
      ctx.shadowBlur = 16;
      ctx.shadowColor = skin.paddleColor;
      ctx.fillStyle = skin.paddleColor;
      ctx.fillRect(x, y, w, h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x + 2, y + 2, w - 4, Math.floor(h * 0.35));
    } else {
      ctx.fillStyle = skin.paddleColor;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = skin.paddleHighlight;
      ctx.fillRect(x + 2, y + 1, w - 4, Math.floor(h * 0.4));
    }
    ctx.restore();
  }

  function drawBall() {
    const x = ball.x,
      y = ball.y,
      r = ball.w / 2;
    const cx = x + r,
      cy = y + r;
    ctx.save();
    if (skin.style === "neon") {
      ctx.shadowBlur = 14;
      ctx.shadowColor = skin.ballColor;
    }
    ctx.fillStyle = skin.ballColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function applySkin(name) {
    if (!SKINS[name]) name = "clasico";
    currentSkinName = name;
    skin = SKINS[name];
    blocksDirty = true; // colores/estilo cambian → re-render del layer
    try {
      localStorage.setItem(SKIN_KEY, name);
    } catch (e) {}
    canvas.style.background = skin.boardBg;
    const skinSelect = document.getElementById("arkanoid-skin-select");
    if (skinSelect) skinSelect.value = name;
    window.dispatchEvent(
      new CustomEvent("av:skin", { detail: { skin: name } })
    );
  }

  // --- Entrada ---
  const keys = { left: false, right: false };

  function clampPaddle() {
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x > W - paddle.w) paddle.x = W - paddle.w;
  }

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    paddle.x = mx - paddle.w / 2;
    clampPaddle();
  });

  function launchBall() {
    if (!ball.stuck) return;
    const speed = LEVELS[game.level].speed;
    ball.stuck = false;
    ball.vx = speed * 0.6;
    ball.vy = -speed;
    game.state = "playing";
  }

  function resetGame() {
    game.state = "ready";
    game.score = 0;
    game.lives = 3;
    game.level = 0;
    paddle.x = (W - paddle.w) / 2;
    ball.stuck = true;
    ball.vx = 0;
    ball.vy = 0;
    buildBlocks();
    explosions = [];
  }

  function advanceLevel() {
    game.level++;
    window.dispatchEvent(
      new CustomEvent("av:level", { detail: { level: game.level + 1 } })
    );
    game.state = "ready";
    paddle.x = (W - paddle.w) / 2;
    ball.stuck = true;
    ball.vx = 0;
    ball.vy = 0;
    buildBlocks();
    explosions = [];
  }

  function primaryAction() {
    if (game.state === "level_complete") {
      advanceLevel();
    } else {
      launchBall();
    }
  }

  canvas.addEventListener("mousedown", primaryAction);

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A")
      keys.left = true;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D")
      keys.right = true;
    if (e.key === " ") {
      e.preventDefault();
      primaryAction();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A")
      keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D")
      keys.right = false;
  });

  function update(now) {
    if (
      game.state === "won" ||
      game.state === "lost" ||
      game.state === "level_complete"
    )
      return;

    if (keys.left) paddle.x -= paddle.speed;
    if (keys.right) paddle.x += paddle.speed;
    clampPaddle();

    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2 - ball.w / 2;
      ball.y = paddle.y - ball.h;
      return;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.y > H) {
      game.lives -= 1;
      window.dispatchEvent(
        new CustomEvent("av:lives", { detail: { lives: game.lives } })
      );
      ball.stuck = true;
      ball.vx = 0;
      ball.vy = 0;
      if (game.lives <= 0) {
        game.state = "lost";
        window.dispatchEvent(
          new CustomEvent("av:gameOver", { detail: { score: game.score } })
        );
      }
      return;
    }

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = -ball.vx;
      playSound("bounce");
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -ball.vx;
      playSound("bounce");
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = -ball.vy;
      playSound("bounce");
    }

    if (
      ball.vy > 0 &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h &&
      ball.x + ball.w >= paddle.x &&
      ball.x <= paddle.x + paddle.w
    ) {
      const ballCenter = ball.x + ball.w / 2;
      const paddleCenter = paddle.x + paddle.w / 2;
      let hit = (ballCenter - paddleCenter) / (paddle.w / 2);
      if (hit < -1) hit = -1;
      if (hit > 1) hit = 1;

      const MAX_ANGLE = Math.PI / 3;
      const angle = hit * MAX_ANGLE;
      const speed = LEVELS[game.level].speed;
      ball.vx = speed * Math.sin(angle);
      ball.vy = -speed * Math.cos(angle);
      ball.y = paddle.y - ball.h;
      playSound("bounce");
    }

    explosions = explosions.filter((e) => now - e.start < EXPLOSION_DURATION);

    for (const b of blocks) {
      if (!b.alive) continue;
      if (
        ball.x + ball.w >= b.x &&
        ball.x <= b.x + b.w &&
        ball.y + ball.h >= b.y &&
        ball.y <= b.y + b.h
      ) {
        b.alive = false;
        blocksDirty = true; // bloque roto → re-render del layer offscreen
        game.score += 10;
        window.dispatchEvent(
          new CustomEvent("av:score", { detail: { score: game.score } })
        );
        ball.vy = -ball.vy;
        playSound("break");
        explosions.push({
          color: b.color,
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
          start: now,
        });
        if (blocks.every((bl) => !bl.alive)) {
          if (game.level < 2) {
            game.state = "level_complete";
          } else {
            game.state = "won";
            window.dispatchEvent(
              new CustomEvent("av:gameOver", { detail: { score: game.score } })
            );
          }
        }
        break;
      }
    }
  }

  function draw(now) {
    ctx.fillStyle = skin.boardBg;
    ctx.fillRect(0, 0, W, H);

    if (blocksDirty) renderBlockLayer();
    ctx.drawImage(blockLayer, 0, 0);

    for (const e of explosions) {
      const frame = Math.min(
        Math.floor((now - e.start) / (EXPLOSION_DURATION / 4)),
        3
      );
      drawFrame(ctx, EXPLOSION_FRAMES[e.color][frame], e.x, e.y, e.w, e.h);
    }

    drawPaddle();
    drawBall();

    drawHUD();
  }

  function drawHUD() {
    const textColor = skin.style === "neon" ? "#00f0ff" : "#ffffff";
    ctx.fillStyle = textColor;
    ctx.font = "20px monospace";
    ctx.textBaseline = "top";

    ctx.textAlign = "left";
    ctx.fillText("Score: " + game.score, 12, 12);

    ctx.textAlign = "center";
    ctx.fillText("Nivel: " + (game.level + 1), W / 2, 12);

    // Vidas como pequeños círculos de bola
    const ICON = 14;
    const ICON_GAP = 6;
    ctx.save();
    if (skin.style === "neon") {
      ctx.shadowBlur = 8;
      ctx.shadowColor = skin.ballColor;
    }
    ctx.fillStyle = skin.ballColor;
    for (let i = 0; i < game.lives; i++) {
      const bx = W - 12 - (i + 1) * ICON - i * ICON_GAP + ICON / 2;
      const by = 12 + ICON / 2;
      ctx.beginPath();
      ctx.arc(bx, by, ICON / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function loop(now) {
    update(now);
    draw(now);
    if (fpsMeter) {
      fpsMeter.tick(now);
      fpsMeter.draw(ctx);
    }
    rafId = requestAnimationFrame(loop);
  }

  window.ARKANOID = {
    pause() {
      if (!gamePaused) {
        gamePaused = true;
        cancelAnimationFrame(rafId);
      }
    },
    resume() {
      if (gamePaused) {
        gamePaused = false;
        rafId = requestAnimationFrame(loop);
      }
    },
    restart() {
      gamePaused = false;
      cancelAnimationFrame(rafId); // kill any in-flight loop before re-scheduling
      resetGame();
      rafId = requestAnimationFrame(loop);
    },
    setSkin(name) {
      applySkin(name);
    },
    getSkins() {
      return Object.entries(SKINS).map(([key, s]) => ({ key, label: s.label }));
    },
  };

  buildBlocks();
  applySkin(currentSkinName);

  loadSpritesheet(() => {
    rafId = requestAnimationFrame(loop);
  });
})();
