(function () {
  const canvas = document.getElementById("av-canvas");
  const ctx = canvas.getContext("2d");

  // Low-fx en móvil (SPEC 11): desactiva el glow (shadowBlur) bajo 768 px.
  function lowFx() {
    return window.innerWidth < 768;
  }

  // ---- FPS overlay (dev-only, SPEC 11) ----
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

  const CELL = 32;
  const COLS = 25;
  const ROWS = 25;

  // ---- Visual skins ----
  const SKINS = {
    clasico: {
      label: "Clásico",
      style: "rounded",
      boardBg: "#0f172a",
      gridColor: "rgba(255,255,255,0.04)",
      headColor: "#86efac",
      bodyColor: "#4ade80",
      fruitBg: "#facc15",
    },
    retro: {
      label: "Retro",
      style: "flat",
      boardBg: "#1a1a25",
      gridColor: "rgba(255,255,255,0.06)",
      headColor: "#a3e635",
      bodyColor: "#65a30d",
      fruitBg: "#f97316",
    },
    neon: {
      label: "Neón",
      style: "neon",
      boardBg: "#000000",
      gridColor: "rgba(0,255,100,0.05)",
      headColor: "#39ff14",
      bodyColor: "#00cc44",
      fruitBg: "#ff00cc",
    },
  };

  const SKIN_KEY = "snake-skin";

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

  const FRUIT_KEYS = Object.keys(window.SPRITE_ATLAS.fruits);

  const fruitsImg = new Image();
  let imgReady = false;
  fruitsImg.onload = () => {
    imgReady = true;
  };
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
    window.dispatchEvent(new CustomEvent(name, { detail }));
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

    // Exclude last segment: it moves away this step (tail chase is valid)
    for (let i = 0; i < snake.length - 1; i++) {
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

  function drawSegment(seg, isHead) {
    const color = isHead ? skin.headColor : skin.bodyColor;
    const pad = 2;
    const px = seg.x * CELL + pad;
    const py = seg.y * CELL + pad;
    const s = CELL - pad * 2;

    ctx.save();
    switch (skin.style) {
      case "neon": {
        ctx.shadowBlur = lowFx() ? 0 : 12;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, s, s);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(px + 4, py + 4, s - 8, s - 8);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 1, py + 1, s - 2, s - 2);
        break;
      }
      case "flat": {
        ctx.fillStyle = color;
        ctx.fillRect(px, py, s, s);
        // CRT highlight: 4px white strip at top
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(px, py, s, 4);
        break;
      }
      default: {
        // rounded (clasico)
        drawRoundedRect(px, py, s, s, 4, color);
        break;
      }
    }
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = skin.boardBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = skin.gridColor;
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

    for (let i = snake.length - 1; i >= 0; i--) {
      drawSegment(snake[i], i === 0);
    }

    const fx = fruit.x * CELL + CELL / 2;
    const fy = fruit.y * CELL + CELL / 2;
    const fr = CELL / 2 - 2;

    // solid circle fallback — always visible regardless of sprite
    if (skin.style === "neon") {
      ctx.save();
      ctx.shadowBlur = lowFx() ? 0 : 16;
      ctx.shadowColor = skin.fruitBg;
      ctx.fillStyle = skin.fruitBg;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = skin.fruitBg;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fill();
    }

    if (imgReady) {
      const sp = window.SPRITE_ATLAS?.fruits?.[fruit.sprite];
      if (sp) {
        const drawSize = CELL - 4;
        try {
          ctx.globalAlpha = 0.92;
          ctx.drawImage(
            fruitsImg,
            sp.x,
            sp.y,
            sp.w,
            sp.h,
            fruit.x * CELL + 2,
            fruit.y * CELL + 2,
            drawSize,
            drawSize
          );
        } finally {
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  function applySkin(name) {
    if (!SKINS[name]) name = "clasico";
    currentSkinName = name;
    skin = SKINS[name];
    try {
      localStorage.setItem(SKIN_KEY, name);
    } catch (e) {}
    canvas.style.background = skin.boardBg;
    const skinSelect = document.getElementById("snake-skin-select");
    if (skinSelect) skinSelect.value = name;
    window.dispatchEvent(
      new CustomEvent("av:skin", { detail: { skin: name } })
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
    if (fpsMeter) {
      fpsMeter.tick(ts);
      fpsMeter.draw(ctx);
    }
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

  applySkin(currentSkinName);
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
    setSkin(name) {
      applySkin(name);
    },
    getSkins() {
      return Object.entries(SKINS).map(([key, s]) => ({ key, label: s.label }));
    },
  };
})();
