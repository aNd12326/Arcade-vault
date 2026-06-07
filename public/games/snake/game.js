(function () {
  const canvas = document.getElementById("av-canvas");
  const ctx = canvas.getContext("2d");

  const CELL = 40;
  const COLS = 20;
  const ROWS = 20;

  const FRUIT_KEYS = Object.keys(window.SPRITE_ATLAS.fruits);

  const fruitsImg = new Image();
  fruitsImg.src = window.SPRITE_ATLAS.sources.fruits;

  let snake,
    dir,
    nextDir,
    fruit,
    score,
    level,
    paused,
    gameOver,
    rafId,
    lastTime,
    interval;
  let inputConsumed = false;

  function randomFreeCell() {
    const occupied = new Set(snake.map((s) => s.x + "," + s.y));
    const free = [];
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (!occupied.has(x + "," + y)) free.push({ x, y });
      }
    }
    return free[Math.floor(Math.random() * free.length)];
  }

  function randomSprite() {
    return FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)];
  }

  function resetState() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    level = 1;
    interval = 150;
    paused = false;
    gameOver = false;
    inputConsumed = false;
    const cell = randomFreeCell();
    fruit = { x: cell.x, y: cell.y, sprite: randomSprite() };
  }

  function emit(name, detail) {
    canvas.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  function eatFruit() {
    score += 10;
    emit("av:score", { score });
    if (score % 50 === 0) {
      level += 1;
      interval = Math.max(60, interval - 15);
      emit("av:level", { level });
    }
    const cell = randomFreeCell();
    fruit = { x: cell.x, y: cell.y, sprite: randomSprite() };
  }

  function triggerGameOver() {
    gameOver = true;
    cancelAnimationFrame(rafId);
    emit("av:gameOver", { score });
  }

  function step() {
    dir = { x: nextDir.x, y: nextDir.y };
    inputConsumed = false;

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      triggerGameOver();
      return;
    }

    for (let i = 0; i < snake.length; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        triggerGameOver();
        return;
      }
    }

    if (head.x === fruit.x && head.y === fruit.y) {
      snake.unshift(head);
      eatFruit();
    } else {
      snake.unshift(head);
      snake.pop();
    }
  }

  function drawRoundedRect(x, y, w, h, r, fill) {
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
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function draw() {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, ROWS * CELL);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(COLS * CELL, y * CELL);
      ctx.stroke();
    }

    const pad = 3;
    for (let i = snake.length - 1; i >= 0; i--) {
      const seg = snake[i];
      const isHead = i === 0;
      const color = isHead ? "#86efac" : "#4ade80";
      drawRoundedRect(
        seg.x * CELL + pad,
        seg.y * CELL + pad,
        CELL - pad * 2,
        CELL - pad * 2,
        6,
        color
      );
    }

    const sp = window.SPRITE_ATLAS.fruits[fruit.sprite];
    const margin = 4;
    ctx.drawImage(
      fruitsImg,
      sp.x,
      sp.y,
      sp.w,
      sp.h,
      fruit.x * CELL + margin,
      fruit.y * CELL + margin,
      CELL - margin * 2,
      CELL - margin * 2
    );
  }

  function loop(ts) {
    if (paused || gameOver) return;
    const elapsed = ts - lastTime;
    if (elapsed >= interval) {
      lastTime = ts;
      step();
      if (gameOver) {
        draw();
        return;
      }
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  document.addEventListener("keydown", function (e) {
    if (inputConsumed) return;
    const map = {
      w: { x: 0, y: -1 },
      a: { x: -1, y: 0 },
      s: { x: 0, y: 1 },
      d: { x: 1, y: 0 },
    };
    const nd = map[e.key.toLowerCase()];
    if (!nd) return;
    if (nd.x === -dir.x && nd.y === -dir.y) return;
    nextDir = nd;
    inputConsumed = true;
  });

  resetState();
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);

  window.SNAKE = {
    pause() {
      if (!gameOver && !paused) {
        paused = true;
        cancelAnimationFrame(rafId);
      }
    },
    resume() {
      if (!gameOver && paused) {
        paused = false;
        lastTime = performance.now();
        rafId = requestAnimationFrame(loop);
      }
    },
    restart() {
      cancelAnimationFrame(rafId);
      resetState();
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    },
  };
})();
