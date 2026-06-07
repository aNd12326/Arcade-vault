(function () {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;

  // ---- Visual skins ----
  const SKINS = {
    retro: {
      label: "Retro",
      style: "flat",
      boardBg: "#1a1a25",
      gridColor: "#22222e",
      colors: [
        null,
        "#4dd0e1",
        "#ffd54f",
        "#ba68c8",
        "#81c784",
        "#e57373",
        "#7986cb",
        "#ffb74d",
      ],
    },
    neon: {
      label: "Neón",
      style: "neon",
      boardBg: "#000000",
      gridColor: "#0d0d22",
      colors: [
        null,
        "#00f0ff",
        "#fff200",
        "#ff35d4",
        "#00ff66",
        "#ff0040",
        "#4d6bff",
        "#ff9500",
      ],
    },
    pastel: {
      label: "Pastel",
      style: "rounded",
      boardBg: "#2b2b38",
      gridColor: "#35354a",
      colors: [
        null,
        "#a0e7e5",
        "#fbe7a1",
        "#d6b5e8",
        "#b5ead7",
        "#ffb3ba",
        "#bcc8ef",
        "#ffd8b1",
      ],
    },
    pixel: {
      label: "Pixel art",
      style: "pixel",
      boardBg: "#161620",
      gridColor: "#22222e",
      colors: [
        null,
        "#4dd0e1",
        "#ffd54f",
        "#ba68c8",
        "#81c784",
        "#e57373",
        "#7986cb",
        "#ffb74d",
      ],
    },
  };

  const SKIN_KEY = "tetris-skin";

  function loadSkinName() {
    try {
      const saved = localStorage.getItem(SKIN_KEY);
      return saved && SKINS[saved] ? saved : "retro";
    } catch (e) {
      return "retro";
    }
  }

  let currentSkinName = loadSkinName();
  let skin = SKINS[currentSkinName];

  const PIECES = [
    null,
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ], // I
    [
      [2, 2],
      [2, 2],
    ], // O
    [
      [0, 3, 0],
      [3, 3, 3],
      [0, 0, 0],
    ], // T
    [
      [0, 4, 4],
      [4, 4, 0],
      [0, 0, 0],
    ], // S
    [
      [5, 5, 0],
      [0, 5, 5],
      [0, 0, 0],
    ], // Z
    [
      [6, 0, 0],
      [6, 6, 6],
      [0, 0, 0],
    ], // J
    [
      [0, 0, 7],
      [7, 7, 7],
      [0, 0, 0],
    ], // L
  ];

  const LINE_SCORES = [0, 100, 300, 500, 800];

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const nextCanvas = document.getElementById("next-canvas");
  const nextCtx = nextCanvas.getContext("2d");
  const skinSelect = document.getElementById("skin-select");

  let board, current, next, score, lines, level, combo, maxCombo;
  let paused, gameOver, lastTime, dropAccum, dropInterval, animId;
  let startLevel = 1;

  function dropIntervalForLevel(lvl) {
    return Math.max(100, 1000 - (lvl - 1) * 90);
  }

  function createBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece() {
    const type = Math.floor(Math.random() * 7) + 1;
    const shape = PIECES[type].map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape, ox, oy) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape) {
    const rows = shape.length,
      cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      if (combo > 1) score += 50 * (combo - 1) * level;
      window.dispatchEvent(new CustomEvent("av:score", { detail: { score } }));
      level = startLevel + Math.floor(lines / 10);
      window.dispatchEvent(new CustomEvent("av:level", { detail: { level } }));
      window.dispatchEvent(new CustomEvent("av:combo", { detail: { combo } }));
      dropInterval = dropIntervalForLevel(level);
    } else {
      combo = 0;
      window.dispatchEvent(new CustomEvent("av:combo", { detail: { combo } }));
    }
  }

  function ghostY() {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    window.dispatchEvent(new CustomEvent("av:score", { detail: { score } }));
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      window.dispatchEvent(new CustomEvent("av:score", { detail: { score } }));
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      endGame();
    }
    drawNext();
  }

  function roundRect(context, x, y, w, h, r) {
    context.beginPath();
    if (context.roundRect) {
      context.roundRect(x, y, w, h, r);
    } else {
      context.moveTo(x + r, y);
      context.arcTo(x + w, y, x + w, y + h, r);
      context.arcTo(x + w, y + h, x, y + h, r);
      context.arcTo(x, y + h, x, y, r);
      context.arcTo(x, y, x + w, y, r);
      context.closePath();
    }
  }

  function drawBlock(context, x, y, colorIndex, size, alpha) {
    if (!colorIndex) return;
    const color = skin.colors[colorIndex];
    const px = x * size + 1;
    const py = y * size + 1;
    const s = size - 2;
    context.save();
    context.globalAlpha = alpha ?? 1;

    switch (skin.style) {
      case "neon": {
        context.shadowBlur = 14;
        context.shadowColor = color;
        context.fillStyle = color;
        context.fillRect(px, py, s, s);
        context.shadowBlur = 0;
        context.fillStyle = "rgba(0,0,0,0.45)";
        context.fillRect(px + 4, py + 4, s - 8, s - 8);
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.strokeRect(px + 1, py + 1, s - 2, s - 2);
        break;
      }
      case "rounded": {
        const r = Math.max(3, size * 0.22);
        context.fillStyle = color;
        roundRect(context, px, py, s, s, r);
        context.fill();
        context.fillStyle = "rgba(255,255,255,0.28)";
        roundRect(context, px + 2, py + 2, s - 4, (s - 4) * 0.4, r * 0.6);
        context.fill();
        break;
      }
      case "pixel": {
        context.fillStyle = color;
        context.fillRect(px, py, s, s);
        const n = 4;
        const cell = s / n;
        context.fillStyle = "rgba(255,255,255,0.10)";
        for (let rr = 0; rr < n; rr++)
          for (let cc = 0; cc < n; cc++)
            if ((rr + cc) % 2 === 0)
              context.fillRect(px + cc * cell, py + rr * cell, cell, cell);
        context.fillStyle = "rgba(255,255,255,0.35)";
        context.fillRect(px, py, s, 3);
        context.fillRect(px, py, 3, s);
        context.fillStyle = "rgba(0,0,0,0.35)";
        context.fillRect(px, py + s - 3, s, 3);
        context.fillRect(px + s - 3, py, 3, s);
        break;
      }
      default: {
        context.fillStyle = color;
        context.fillRect(px, py, s, s);
        context.fillStyle = "rgba(255,255,255,0.12)";
        context.fillRect(px, py, s, 4);
      }
    }
    context.restore();
  }

  function applySkin(name) {
    if (!SKINS[name]) name = "retro";
    currentSkinName = name;
    skin = SKINS[name];
    try {
      localStorage.setItem(SKIN_KEY, name);
    } catch (e) {}
    canvas.style.background = skin.boardBg;
    nextCanvas.style.background = skin.boardBg;
    if (skinSelect) skinSelect.value = name;
    if (board && current) {
      draw();
      drawNext();
    }
    window.dispatchEvent(
      new CustomEvent("av:skin", { detail: { skin: name } })
    );
  }

  function drawGrid() {
    ctx.strokeStyle = skin.gridColor;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            current.x + c,
            gy + r,
            current.shape[r][c],
            BLOCK,
            0.2
          );

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          ctx,
          current.x + c,
          current.y + r,
          current.shape[r][c],
          BLOCK
        );
  }

  function drawNext() {
    const NB = 30;
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  }

  function endGame() {
    gameOver = true;
    cancelAnimationFrame(animId);
    window.dispatchEvent(new CustomEvent("av:gameOver", { detail: { score } }));
  }

  function loop(ts) {
    const dt = ts - lastTime;
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
    draw();
    animId = requestAnimationFrame(loop);
  }

  function init() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = startLevel;
    combo = 0;
    maxCombo = 0;
    paused = false;
    gameOver = false;
    dropInterval = dropIntervalForLevel(startLevel);
    dropAccum = 0;
    lastTime = performance.now();
    next = randomPiece();
    spawn();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  document.addEventListener("keydown", (e) => {
    if (paused || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        e.preventDefault();
        hardDrop();
        break;
    }
  });

  if (skinSelect) {
    skinSelect.addEventListener("change", (e) => applySkin(e.target.value));
  }

  applySkin(currentSkinName);
  init();

  window.TETRIS = {
    pause() {
      if (!gameOver && !paused) {
        paused = true;
        cancelAnimationFrame(animId);
      }
    },
    resume() {
      if (!gameOver && paused) {
        paused = false;
        lastTime = performance.now();
        loop(lastTime);
      }
    },
    restart() {
      init();
    },
    setSkin(name) {
      applySkin(name);
    },
    getSkins() {
      return Object.entries(SKINS).map(([key, s]) => ({ key, label: s.label }));
    },
  };
})();
