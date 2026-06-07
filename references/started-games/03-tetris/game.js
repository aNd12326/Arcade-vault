'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// ---- Temas visuales / skins ----
// Cada skin define su paleta de piezas, el fondo del canvas, el color de la
// rejilla y un `style` que selecciona la estrategia de dibujo en drawBlock().
const SKINS = {
  retro: {
    label: 'Retro',
    style: 'flat',
    boardBg: '#1a1a25',
    gridColor: '#22222e',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#7986cb', '#ffb74d'],
  },
  neon: {
    label: 'Neón',
    style: 'neon',
    boardBg: '#000000',
    gridColor: '#0d0d22',
    colors: [null, '#00f0ff', '#fff200', '#ff35d4', '#00ff66', '#ff0040', '#4d6bff', '#ff9500'],
  },
  pastel: {
    label: 'Pastel',
    style: 'rounded',
    boardBg: '#2b2b38',
    gridColor: '#35354a',
    colors: [null, '#a0e7e5', '#fbe7a1', '#d6b5e8', '#b5ead7', '#ffb3ba', '#bcc8ef', '#ffd8b1'],
  },
  pixel: {
    label: 'Pixel art',
    style: 'pixel',
    boardBg: '#161620',
    gridColor: '#22222e',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#7986cb', '#ffb74d'],
  },
};

const SKIN_KEY = 'tetris-skin';

function loadSkinName() {
  const saved = localStorage.getItem(SKIN_KEY);
  return saved && SKINS[saved] ? saved : 'retro';
}

let currentSkinName = loadSkinName();
let skin = SKINS[currentSkinName];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const skinSelect = document.getElementById('skin-select');

// Menú de pausa
const pauseMenu = document.getElementById('pause-menu');
const menuMain = document.getElementById('menu-main');
const menuControls = document.getElementById('menu-controls');
const resumeBtn = document.getElementById('resume-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const levelMinusBtn = document.getElementById('level-minus');
const levelPlusBtn = document.getElementById('level-plus');
const startLevelValue = document.getElementById('start-level-value');

const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 15;

const overlayRecordsEl = document.getElementById('overlay-records');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveBtn = document.getElementById('save-btn');
const startOverlay = document.getElementById('start-overlay');
const startRecordsEl = document.getElementById('start-records');
const playBtn = document.getElementById('play-btn');
const resetBtn = document.getElementById('reset-btn');

let board, current, next, score, lines, level, combo, maxCombo, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let startLevel = 1; // nivel con el que comienza la próxima partida

/* ---------- Records (localStorage) ---------- */
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (data && Array.isArray(data.scores)) {
      return {
        scores: data.scores,
        bestCombo: data.bestCombo || 0,
        maxLines: data.maxLines || 0,
      };
    }
  } catch (e) { /* corrupt data — start fresh */ }
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function resetRecords() {
  localStorage.removeItem(RECORDS_KEY);
}

function qualifiesForTop(sc) {
  if (sc <= 0) return false;
  const { scores } = loadRecords();
  if (scores.length < MAX_RECORDS) return true;
  return sc > scores[scores.length - 1].score;
}

function addScore(name, sc, ln, cb) {
  const records = loadRecords();
  const entry = { name, score: sc, lines: ln, combo: cb };
  records.scores.push(entry);
  records.scores.sort((a, b) => b.score - a.score);
  records.scores = records.scores.slice(0, MAX_RECORDS);
  saveRecords(records);
  return { records, index: records.scores.indexOf(entry) };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderRecords(container, records, highlightIndex = -1) {
  let rows;
  if (records.scores.length === 0) {
    rows = '<li class="empty">Aún no hay récords</li>';
  } else {
    rows = records.scores.map((s, i) => {
      const hl = i === highlightIndex ? ' class="hl"' : '';
      return `<li${hl}>` +
        `<span class="rank">${i + 1}</span>` +
        `<span class="rname">${escapeHtml(s.name)}</span>` +
        `<span class="rscore">${(s.score || 0).toLocaleString()}</span>` +
        `</li>`;
    }).join('');
  }
  container.innerHTML =
    `<p class="records-title">RÉCORDS</p>` +
    `<ol class="records-list">${rows}</ol>` +
    `<div class="records-stats">` +
      `<span>Mejor combo <b>${records.bestCombo}</b></span>` +
      `<span>Líneas máx <b>${records.maxLines}</b></span>` +
    `</div>`;
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
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
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
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
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    score += (LINE_SCORES[cleared] || 0) * level;
    if (combo > 1) score += 50 * (combo - 1) * level; // bonus por combo
    level = startLevel + Math.floor(lines / 10);
    dropInterval = dropIntervalForLevel(level);
    updateHUD();
  } else {
    combo = 0;
  }
}

function dropIntervalForLevel(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
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

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo > 1 ? `x${combo}` : '—';
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
    case 'neon': {
      // glow exterior + núcleo translúcido tipo tubo de neón
      context.shadowBlur = 14;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      context.shadowBlur = 0;
      context.fillStyle = 'rgba(0,0,0,0.45)';
      context.fillRect(px + 4, py + 4, s - 8, s - 8);
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 1, py + 1, s - 2, s - 2);
      break;
    }
    case 'rounded': {
      // bloques con esquinas redondeadas y brillo superior suave
      const r = Math.max(3, size * 0.22);
      context.fillStyle = color;
      roundRect(context, px, py, s, s, r);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.28)';
      roundRect(context, px + 2, py + 2, s - 4, (s - 4) * 0.4, r * 0.6);
      context.fill();
      break;
    }
    case 'pixel': {
      // textura dither 4x4 + bisel para aspecto pixel-art
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      const n = 4;
      const cell = s / n;
      context.fillStyle = 'rgba(255,255,255,0.10)';
      for (let rr = 0; rr < n; rr++)
        for (let cc = 0; cc < n; cc++)
          if ((rr + cc) % 2 === 0)
            context.fillRect(px + cc * cell, py + rr * cell, cell, cell);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(px, py, s, 3);
      context.fillRect(px, py, 3, s);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(px, py + s - 3, s, 3);
      context.fillRect(px + s - 3, py, 3, s);
      break;
    }
    default: { // 'flat' (Retro)
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px, py, s, 4);
    }
  }
  context.restore();
}

function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  currentSkinName = name;
  skin = SKINS[name];
  localStorage.setItem(SKIN_KEY, name);
  canvas.style.background = skin.boardBg;
  nextCanvas.style.background = skin.boardBg;
  if (skinSelect) skinSelect.value = name;
  // Re-dibuja inmediatamente con las nuevas constantes (sin recargar)
  if (board && current) {
    draw();
    drawNext();
  }
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

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
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

  // Actualiza estadísticas globales (combo / líneas) aunque no entre al top.
  const records = loadRecords();
  if (maxCombo > records.bestCombo) records.bestCombo = maxCombo;
  if (lines > records.maxLines) records.maxLines = lines;
  saveRecords(records);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  if (qualifiesForTop(score)) {
    overlayScore.textContent += ' — ¡Nuevo récord!';
    nameEntry.classList.remove('hidden');
    restartBtn.classList.add('hidden');
    nameInput.value = '';
    setTimeout(() => nameInput.focus(), 0);
  } else {
    nameEntry.classList.add('hidden');
    restartBtn.classList.remove('hidden');
  }

  renderRecords(overlayRecordsEl, records);
  overlay.classList.remove('hidden');
}

function pauseGame() {
  if (gameOver || paused) return;
  paused = true;
  cancelAnimationFrame(animId);
  showMenuView('main');
  pauseMenu.classList.remove('hidden');
}

function resumeGame() {
  if (gameOver || !paused) return;
  paused = false;
  pauseMenu.classList.add('hidden');
  lastTime = performance.now();
  loop(lastTime);
}

function saveCurrentScore() {
  const name = (nameInput.value.trim() || 'ANÓNIMO').slice(0, 12);
  const { records, index } = addScore(name, score, lines, maxCombo);
  nameEntry.classList.add('hidden');
  restartBtn.classList.remove('hidden');
  renderRecords(overlayRecordsEl, records, index);
}

function showStart() {
  renderRecords(startRecordsEl, loadRecords());
  startOverlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  if (paused) resumeGame();
  else pauseGame();
}

function showMenuView(view) {
  const showControls = view === 'controls';
  menuControls.classList.toggle('hidden', !showControls);
  menuMain.classList.toggle('hidden', showControls);
}

function setStartLevel(value) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(MIN_START_LEVEL, value));
  startLevelValue.textContent = startLevel;
  levelMinusBtn.disabled = startLevel <= MIN_START_LEVEL;
  levelPlusBtn.disabled = startLevel >= MAX_START_LEVEL;
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
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  showMenuView('main');
  startOverlay.classList.add('hidden');
  nameEntry.classList.add('hidden');
  restartBtn.classList.remove('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    // Si estamos viendo los controles, Esc/P regresa al menú principal
    if (paused && !menuControls.classList.contains('hidden')) {
      showMenuView('main');
    } else {
      togglePause();
    }
    return;
  }
  // Inputs del juego bloqueados mientras el menú de pausa está abierto
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
playBtn.addEventListener('click', init);

if (skinSelect) {
  skinSelect.addEventListener('change', e => applySkin(e.target.value));
}

applySkin(currentSkinName);

// ---- Eventos del menú de pausa ----
resumeBtn.addEventListener('click', resumeGame);
menuRestartBtn.addEventListener('click', init);
showControlsBtn.addEventListener('click', () => showMenuView('controls'));
controlsBackBtn.addEventListener('click', () => showMenuView('main'));
levelMinusBtn.addEventListener('click', () => setStartLevel(startLevel - 1));
levelPlusBtn.addEventListener('click', () => setStartLevel(startLevel + 1));

// ---- Eventos de la tabla de récords ----
saveBtn.addEventListener('click', saveCurrentScore);
nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveCurrentScore();
  e.stopPropagation();
});

resetBtn.addEventListener('click', () => {
  if (confirm('¿Borrar todos los récords guardados?')) {
    resetRecords();
    renderRecords(startRecordsEl, loadRecords());
  }
});

setStartLevel(startLevel);
showStart();
