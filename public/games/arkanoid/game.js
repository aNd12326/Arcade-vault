(function () {
  const canvas = document.getElementById("av-canvas");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;

  // --- Rejilla ---
  const BLOCK_W = 72;
  const BLOCK_H = 36;
  const GAP = 4;
  const GRID_TOP = 60;

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
    paddle.x = mx - paddle.w / 2; // centra paddle en cursor
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

  // Click/espacio: avanza nivel si completado, si no lanza la bola
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
    // Fin de partida o transición: sin movimiento hasta continuar/reiniciar
    if (
      game.state === "won" ||
      game.state === "lost" ||
      game.state === "level_complete"
    )
      return;

    // Teclado mueve el paddle; mouse lo movió ya en su evento.
    // Última entrada gana por frame.
    if (keys.left) paddle.x -= paddle.speed;
    if (keys.right) paddle.x += paddle.speed;
    clampPaddle();

    // Bola pegada sigue al paddle
    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2 - ball.w / 2;
      ball.y = paddle.y - ball.h;
      return;
    }

    // Movimiento
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Bola perdida por abajo
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

    // Rebote paredes laterales
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
    // Rebote techo
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = -ball.vy;
      playSound("bounce");
    }

    // Rebote en paddle: ángulo por punto de impacto
    if (
      ball.vy > 0 &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h &&
      ball.x + ball.w >= paddle.x &&
      ball.x <= paddle.x + paddle.w
    ) {
      const ballCenter = ball.x + ball.w / 2;
      const paddleCenter = paddle.x + paddle.w / 2;
      let hit = (ballCenter - paddleCenter) / (paddle.w / 2); // [-1, 1]
      if (hit < -1) hit = -1;
      if (hit > 1) hit = 1;

      const MAX_ANGLE = Math.PI / 3; // 60° desde la vertical
      const angle = hit * MAX_ANGLE;
      const speed = LEVELS[game.level].speed;
      ball.vx = speed * Math.sin(angle);
      ball.vy = -speed * Math.cos(angle);
      ball.y = paddle.y - ball.h; // evita re-colisión
      playSound("bounce");
    }

    // Limpiar explosiones terminadas
    explosions = explosions.filter((e) => now - e.start < EXPLOSION_DURATION);

    // Colisión con bloques (un bloque por frame)
    for (const b of blocks) {
      if (!b.alive) continue;
      if (
        ball.x + ball.w >= b.x &&
        ball.x <= b.x + b.w &&
        ball.y + ball.h >= b.y &&
        ball.y <= b.y + b.h
      ) {
        b.alive = false;
        game.score += 10;
        window.dispatchEvent(
          new CustomEvent("av:score", { detail: { score: game.score } })
        );
        ball.vy = -ball.vy; // rebote vertical
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
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    for (const b of blocks) {
      if (!b.alive) continue;
      drawSprite(ctx, "block_" + b.color, b.x, b.y, b.w, b.h);
    }

    for (const e of explosions) {
      const frame = Math.min(
        Math.floor((now - e.start) / (EXPLOSION_DURATION / 4)),
        3
      );
      drawFrame(ctx, EXPLOSION_FRAMES[e.color][frame], e.x, e.y, e.w, e.h);
    }

    drawSprite(ctx, "paddle", paddle.x, paddle.y, paddle.w, paddle.h);
    drawSprite(ctx, "ball", ball.x, ball.y, ball.w, ball.h);

    drawHUD();
  }

  function drawHUD() {
    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    ctx.textBaseline = "top";

    ctx.textAlign = "left";
    ctx.fillText("Score: " + game.score, 12, 12);

    ctx.textAlign = "center";
    ctx.fillText("Nivel: " + (game.level + 1), W / 2, 12);

    // Vidas como sprites de bola, alineadas a la derecha
    const ICON = 18;
    const ICON_GAP = 6;
    for (let i = 0; i < game.lives; i++) {
      const x = W - 12 - (i + 1) * ICON - i * ICON_GAP;
      drawSprite(ctx, "ball", x, 12, ICON, ICON);
    }
  }

  function loop(now) {
    update(now);
    draw(now);
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
      resetGame();
      rafId = requestAnimationFrame(loop);
    },
  };

  buildBlocks();

  loadSpritesheet(() => {
    rafId = requestAnimationFrame(loop);
  });
})();
