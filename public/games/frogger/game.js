// Frogger — vanilla canvas engine for Arcade Vault.
// Contract: renders into <canvas id="av-canvas" width=640 height=560>,
// emits window CustomEvents av:score / av:lives / av:level / av:gameOver,
// exposes window.FROGGER = { pause, resume, restart, setSkin, getSkins }.
// The React modal owns the "GAME OVER" overlay — this engine never draws it.
(function () {
  "use strict";

  // ---- Grid / geometry ----------------------------------------------------
  const COLS = 16;
  const ROWS = 14;
  const CELL = 40; // px
  const CANVAS_W = COLS * CELL; // 640
  const CANVAS_H = ROWS * CELL; // 560

  // Zone row indices (0 = top).
  const ROW_GOALS = 0; // 5 destination bays
  const ROW_RIVER_TOP = 1;
  const ROW_RIVER_BOT = 6;
  const ROW_SAFE_MID = 7; // central safe strip
  const ROW_ROAD_TOP = 8;
  const ROW_ROAD_BOT = 12;
  const ROW_START = 13; // bottom safe base

  // ---- Visual skins -------------------------------------------------------
  const SKINS = {
    clasico: {
      label: "Clásico",
      style: "flat",
      // zone backgrounds
      boardBg: "#0a0a0f",
      goalsBg: "#0d2818",
      riverBg: "#0a1f3a",
      safeBg: "#16331f",
      roadBg: "#141417",
      startBg: "#16331f",
      // goal bay
      goalFill: "#0f3d24",
      goalBorder: "#d4af37",
      // entities
      carColors: ["#e03b3b", "#e0c83b", "#3b7be0"],
      truckBody: "#8a8a96",
      truckCab: "#5a5a66",
      logFill: "#6b3f1d",
      logBark: "#4d2c12",
      turtleBody: "#2e8b57",
      turtleShell: "#1f5e3a",
      turtleSubStroke: "rgba(60,180,120,0.4)",
      // frog
      frogBody: "#39d353",
      frogLeg: "#1f7a33",
      // hud
      hudText: "#ffffff",
      hudFrogDot: "#39d353",
      goalFilledDot: "#39d353",
      // time bar colours at 100% / 50% / 25%
      timeHigh: "#39d353",
      timeMid: "#e0c83b",
      timeLow: "#e03b3b",
    },
    retro: {
      label: "Retro",
      style: "flat",
      boardBg: "#0e0e14",
      goalsBg: "#112210",
      riverBg: "#091525",
      safeBg: "#122210",
      roadBg: "#111115",
      startBg: "#122210",
      goalFill: "#0d2e1a",
      goalBorder: "#b89030",
      carColors: ["#cc3030", "#ccaa20", "#2255bb"],
      truckBody: "#707080",
      truckCab: "#505060",
      logFill: "#5a3318",
      logBark: "#3d2210",
      turtleBody: "#267548",
      turtleShell: "#194d30",
      turtleSubStroke: "rgba(40,150,100,0.35)",
      frogBody: "#28bb44",
      frogLeg: "#176628",
      hudText: "#c8c8d0",
      hudFrogDot: "#28bb44",
      goalFilledDot: "#28bb44",
      timeHigh: "#28bb44",
      timeMid: "#ccaa20",
      timeLow: "#cc3030",
    },
    neon: {
      label: "Neón",
      style: "neon",
      boardBg: "#000000",
      goalsBg: "#001a0d",
      riverBg: "#00091a",
      safeBg: "#001a0d",
      roadBg: "#060608",
      startBg: "#001a0d",
      goalFill: "#001a0d",
      goalBorder: "#ffd700",
      carColors: ["#ff2255", "#ffee00", "#00aaff"],
      truckBody: "#aaaacc",
      truckCab: "#7777aa",
      logFill: "#7b4920",
      logBark: "#5a3212",
      turtleBody: "#00ff88",
      turtleShell: "#00cc66",
      turtleSubStroke: "rgba(0,255,136,0.5)",
      frogBody: "#00ff66",
      frogLeg: "#00cc44",
      hudText: "#ffffff",
      hudFrogDot: "#00ff66",
      goalFilledDot: "#00ff66",
      timeHigh: "#00ff66",
      timeMid: "#ffee00",
      timeLow: "#ff2255",
    },
  };

  const SKIN_KEY = "frogger-skin";

  function loadSkinName() {
    try {
      const saved = localStorage.getItem(SKIN_KEY);
      return saved && SKINS[saved] ? saved : "clasico";
    } catch {
      return "clasico";
    }
  }

  let currentSkinName = loadSkinName();
  let skin = SKINS[currentSkinName];

  function applySkin(name) {
    if (!SKINS[name]) return;
    currentSkinName = name;
    skin = SKINS[name];
    try {
      localStorage.setItem(SKIN_KEY, name);
    } catch {
      /* ignore */
    }
  }

  // ---- Gameplay tuning ----------------------------------------------------
  const HOP_MS = 120; // jump animation duration
  const ROUND_TIME = 15; // seconds, base
  const GOAL_COUNT = 5; // destination bays to fill
  const START_LIVES = 3;
  const TURTLE_VISIBLE_MS = 3000;
  const TURTLE_SUBMERGED_MS = 1500;

  // 5 bays of 2 cols each, evenly spread across 16 cols (cols 1,4,7,10,13).
  const GOAL_COLS = [1, 4, 7, 10, 13];
  const GOAL_W = 2;

  // ---- State --------------------------------------------------------------
  // Lane:   { row, speed, dir(1|-1), kind:'road'|'river', entities:[Entity] }
  // Entity: { col, width, type:'car'|'truck'|'log'|'turtle', submerged?,
  //           cycleT? }  (cycleT only for turtle groups)
  // Frog:   { col, row, animating, animT, fromCol, fromRow, targetCol, targetRow }

  let canvas = null;
  let ctx = null;
  let rafId = null;
  let lastTs = 0;

  let paused = false;
  let running = false;

  let lanes = [];
  let frog = null;
  let goalsFilled = []; // boolean[GOAL_COUNT]
  let pendingDir = null; // 'up'|'down'|'left'|'right'|null
  let rowReached = ROW_START; // highest (smallest) row scored this round

  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let timeLeft = ROUND_TIME; // seconds remaining in round

  // ---- Event emitters -----------------------------------------------------
  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
  // Emit only on change.
  let lastScore = -1,
    lastLives = -1,
    lastLevel = -1;
  function syncHud() {
    if (score !== lastScore) {
      lastScore = score;
      emit("av:score", { score });
    }
    if (lives !== lastLives) {
      lastLives = lives;
      emit("av:lives", { lives });
    }
    if (level !== lastLevel) {
      lastLevel = level;
      emit("av:level", { level });
    }
  }

  // ---- Lane construction --------------------------------------------------
  // Speeds scale +15% per level above 1.
  function levelScale(lv) {
    return Math.pow(1.15, lv - 1);
  }

  // Lay out entities along a lane with gaps so it stays crossable.
  // `pattern` = array of { width, gap } repeated until the row is filled.
  function layEntities(type, pattern, startCol) {
    const out = [];
    let col = startCol;
    let i = 0;
    // Fill a bit beyond COLS so wrap-around looks continuous.
    while (col < COLS + 4) {
      const p = pattern[i % pattern.length];
      const e = { col, width: p.width, type };
      if (type === "turtle") {
        e.submerged = false;
        // Stagger immersion phase per group so they don't sync.
        e.cycleT = (i * 700) % (TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS);
      }
      out.push(e);
      col += p.width + p.gap;
      i++;
    }
    return out;
  }

  function buildLanes(lv) {
    const s = levelScale(lv);
    const result = [];

    // Road lanes (rows 8..12). Base speeds 1.5..4 px/frame, alternating dir.
    const roadBase = [
      {
        row: 8,
        speed: 2.0,
        dir: -1,
        type: "car",
        pattern: [
          { width: 1, gap: 3 },
          { width: 2, gap: 4 },
        ],
      },
      {
        row: 9,
        speed: 3.0,
        dir: 1,
        type: "truck",
        pattern: [
          { width: 3, gap: 4 },
          { width: 1, gap: 3 },
        ],
      },
      {
        row: 10,
        speed: 1.5,
        dir: -1,
        type: "car",
        pattern: [
          { width: 1, gap: 2 },
          { width: 1, gap: 4 },
        ],
      },
      {
        row: 11,
        speed: 4.0,
        dir: 1,
        type: "car",
        pattern: [{ width: 2, gap: 5 }],
      },
      {
        row: 12,
        speed: 2.5,
        dir: -1,
        type: "truck",
        pattern: [
          { width: 3, gap: 5 },
          { width: 2, gap: 4 },
        ],
      },
    ];
    for (let k = 0; k < roadBase.length; k++) {
      const b = roadBase[k];
      result.push({
        row: b.row,
        kind: "road",
        dir: b.dir,
        speed: b.speed * s,
        entities: layEntities(b.type, b.pattern, k * 2),
      });
    }

    // River lanes (rows 1..6). Base speeds 1..3 px/frame, alternating dir.
    // Mix of logs (2..4 wide) and turtle groups (2..3 wide).
    const riverBase = [
      {
        row: 1,
        speed: 1.0,
        dir: -1,
        type: "log",
        pattern: [
          { width: 4, gap: 2 },
          { width: 2, gap: 2 },
        ],
      },
      {
        row: 2,
        speed: 2.0,
        dir: 1,
        type: "turtle",
        pattern: [
          { width: 3, gap: 3 },
          { width: 2, gap: 3 },
        ],
      },
      {
        row: 3,
        speed: 1.5,
        dir: -1,
        type: "log",
        pattern: [
          { width: 3, gap: 2 },
          { width: 2, gap: 2 },
        ],
      },
      {
        row: 4,
        speed: 3.0,
        dir: 1,
        type: "log",
        pattern: [
          { width: 2, gap: 3 },
          { width: 4, gap: 3 },
        ],
      },
      {
        row: 5,
        speed: 2.0,
        dir: -1,
        type: "turtle",
        pattern: [
          { width: 2, gap: 2 },
          { width: 3, gap: 3 },
        ],
      },
      {
        row: 6,
        speed: 1.2,
        dir: 1,
        type: "log",
        pattern: [
          { width: 4, gap: 2 },
          { width: 3, gap: 2 },
        ],
      },
    ];
    for (let k = 0; k < riverBase.length; k++) {
      const b = riverBase[k];
      result.push({
        row: b.row,
        kind: "river",
        dir: b.dir,
        speed: b.speed * s,
        entities: layEntities(b.type, b.pattern, k * 2),
      });
    }

    return result;
  }

  // ---- Helpers ------------------------------------------------------------
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  // Cells/frame from px/frame speed, normalized to dt (16ms = 1 frame).
  function colDelta(lane, dt) {
    return (lane.speed / CELL) * lane.dir * (dt / 16);
  }
  function laneAt(row) {
    for (let i = 0; i < lanes.length; i++)
      if (lanes[i].row === row) return lanes[i];
    return null;
  }

  function startHop(dir) {
    const fromCol = Math.round(frog.col);
    let tc = fromCol;
    let tr = frog.row;
    if (dir === "up") tr -= 1;
    else if (dir === "down") tr += 1;
    else if (dir === "left") tc -= 1;
    else if (dir === "right") tc += 1;
    // Clamp to board; no move off the lateral edges or past top/bottom rows.
    tr = Math.max(ROW_GOALS, Math.min(ROW_START, tr));
    tc = Math.max(0, Math.min(COLS - 1, tc));
    if (tc === fromCol && tr === frog.row) return; // blocked by edge
    frog.col = fromCol;
    frog.fromCol = fromCol;
    frog.fromRow = frog.row;
    frog.targetCol = tc;
    frog.targetRow = tr;
    frog.animating = true;
    frog.animT = 0;
  }

  function onHopComplete() {
    // Forward-progress scoring: +10 the first time a higher row is reached.
    if (frog.row < rowReached) {
      score += 10 * (rowReached - frog.row);
      rowReached = frog.row;
    }
    if (frog.row === ROW_GOALS) {
      checkGoal();
    }
  }

  // ---- Loop ---------------------------------------------------------------
  function update(dt) {
    // Round timer.
    timeLeft -= dt / 1000;
    if (timeLeft <= 0) {
      timeLeft = 0;
      killFrog();
      return;
    }

    // Move all lane entities; wrap at edges; cycle turtle immersion.
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const d = colDelta(lane, dt);
      for (let j = 0; j < lane.entities.length; j++) {
        const e = lane.entities[j];
        e.col += d;
        if (lane.dir > 0 && e.col >= COLS) e.col = -e.width;
        else if (lane.dir < 0 && e.col <= -e.width) e.col = COLS;
        if (e.type === "turtle") {
          e.cycleT =
            (e.cycleT + dt) % (TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS);
          e.submerged = e.cycleT >= TURTLE_VISIBLE_MS;
        }
      }
    }

    // Frog hop animation / input.
    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= HOP_MS) {
        frog.animating = false;
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        onHopComplete();
      }
    } else if (pendingDir) {
      startHop(pendingDir);
      pendingDir = null;
    }

    // Settled-on-river logic: ride support or drown / drift off edge.
    if (
      !frog.animating &&
      frog.row >= ROW_RIVER_TOP &&
      frog.row <= ROW_RIVER_BOT
    ) {
      const sup = getSupport(frog, lanes);
      if (!sup) {
        killFrog();
        return;
      }
      const lane = laneAt(frog.row);
      if (lane) frog.col += colDelta(lane, dt);
      if (frog.col < 0 || frog.col > COLS - 1) {
        killFrog();
        return;
      }
    }

    // Road collision when settled on a traffic row.
    if (
      !frog.animating &&
      frog.row >= ROW_ROAD_TOP &&
      frog.row <= ROW_ROAD_BOT
    ) {
      if (checkRoadCollision(frog, lanes)) {
        killFrog();
        return;
      }
    }
  }

  // ---- Drawing ------------------------------------------------------------
  function draw() {
    if (!ctx) return;

    // Zone backgrounds (read from active skin).
    ctx.fillStyle = skin.boardBg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = skin.goalsBg;
    ctx.fillRect(0, ROW_GOALS * CELL, CANVAS_W, CELL);
    ctx.fillStyle = skin.riverBg;
    ctx.fillRect(
      0,
      ROW_RIVER_TOP * CELL,
      CANVAS_W,
      (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL
    );
    ctx.fillStyle = skin.safeBg;
    ctx.fillRect(0, ROW_SAFE_MID * CELL, CANVAS_W, CELL);
    ctx.fillStyle = skin.roadBg;
    ctx.fillRect(
      0,
      ROW_ROAD_TOP * CELL,
      CANVAS_W,
      (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL
    );
    ctx.fillStyle = skin.startBg;
    ctx.fillRect(0, ROW_START * CELL, CANVAS_W, CELL);

    // Lane entities.
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      for (let j = 0; j < lane.entities.length; j++) {
        drawEntity(lane.entities[j], lane.row);
      }
    }

    // Destination bays.
    drawGoals();

    // Frog (interpolated during a hop).
    let fx = frog.col;
    let fy = frog.row;
    if (frog.animating) {
      const t = Math.min(1, frog.animT / HOP_MS);
      fx = lerp(frog.fromCol, frog.targetCol, t);
      fy = lerp(frog.fromRow, frog.targetRow, t);
    }
    drawFrog(fx * CELL, fy * CELL, frog.animating);

    // HUD overlay.
    drawHud();
  }

  function drawEntity(e, row) {
    const x = e.col * CELL;
    const y = row * CELL;
    const w = e.width * CELL;
    const isNeon = skin.style === "neon";

    if (e.type === "car") {
      const color = skin.carColors[(e.col | 0) % 3];
      ctx.fillStyle = color;
      if (isNeon) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = color;
      }
      roundRect(x + 3, y + 7, w - 6, CELL - 14, 6);
      ctx.fill();
      if (isNeon) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        roundRect(x + 3, y + 7, w - 6, CELL - 14, 6);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = "#111";
      circle(x + 9, y + CELL - 7, 4);
      circle(x + w - 9, y + CELL - 7, 4);
    } else if (e.type === "truck") {
      ctx.fillStyle = skin.truckBody;
      if (isNeon) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = skin.truckBody;
      }
      roundRect(x + 3, y + 6, w - 6, CELL - 12, 4);
      ctx.fill();
      ctx.fillStyle = skin.truckCab;
      ctx.fillRect(x + 3, y + 6, CELL * 0.7, CELL - 12);
      if (isNeon) ctx.shadowBlur = 0;
      ctx.fillStyle = "#111";
      circle(x + 11, y + CELL - 6, 4);
      circle(x + w - 11, y + CELL - 6, 4);
    } else if (e.type === "log") {
      ctx.fillStyle = skin.logFill;
      if (isNeon) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = skin.logFill;
      }
      roundRect(x + 1, y + 6, w - 2, CELL - 12, 10);
      ctx.fill();
      if (isNeon) ctx.shadowBlur = 0;
      ctx.strokeStyle = skin.logBark;
      ctx.lineWidth = 2;
      for (let k = 1; k < e.width; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * CELL, y + 8);
        ctx.lineTo(x + k * CELL, y + CELL - 8);
        ctx.stroke();
      }
    } else if (e.type === "turtle") {
      for (let k = 0; k < e.width; k++) {
        const cx = x + k * CELL + CELL / 2;
        const cy = y + CELL / 2;
        if (e.submerged) {
          ctx.strokeStyle = skin.turtleSubStroke;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, CELL / 2 - 6, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          if (isNeon) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = skin.turtleBody;
          }
          ctx.fillStyle = skin.turtleBody;
          circle(cx, cy, CELL / 2 - 4);
          if (isNeon) ctx.shadowBlur = 0;
          ctx.fillStyle = skin.turtleShell;
          circle(cx, cy, CELL / 2 - 10);
        }
      }
    }
  }

  function drawGoals() {
    for (let i = 0; i < GOAL_COLS.length; i++) {
      const x = GOAL_COLS[i] * CELL;
      const w = GOAL_W * CELL;
      const isNeon = skin.style === "neon";

      ctx.fillStyle = skin.goalFill;
      ctx.fillRect(x, ROW_GOALS * CELL, w, CELL);
      ctx.strokeStyle = skin.goalBorder;
      ctx.lineWidth = 2;
      if (isNeon) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = skin.goalBorder;
      }
      ctx.strokeRect(x + 2, ROW_GOALS * CELL + 2, w - 4, CELL - 4);
      if (isNeon) ctx.shadowBlur = 0;

      if (goalsFilled[i]) {
        if (isNeon) {
          ctx.shadowBlur = 14;
          ctx.shadowColor = skin.goalFilledDot;
        }
        ctx.fillStyle = skin.goalFilledDot;
        circle(x + w / 2, ROW_GOALS * CELL + CELL / 2, CELL / 3);
        if (isNeon) ctx.shadowBlur = 0;
      }
    }
  }

  function drawFrog(px, py, animating) {
    const cx = px + CELL / 2;
    const cy = py + CELL / 2;
    const isNeon = skin.style === "neon";

    // Legs splay during a hop.
    ctx.fillStyle = skin.frogLeg;
    if (isNeon) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = skin.frogBody;
    }
    const legOut = animating ? 7 : 3;
    ctx.fillRect(cx - 12 - legOut, cy - 4, 6, 10);
    ctx.fillRect(cx + 6 + legOut, cy - 4, 6, 10);
    // Body.
    ctx.fillStyle = skin.frogBody;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    if (isNeon) {
      ctx.strokeStyle = skin.frogBody;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // Eyes.
    ctx.fillStyle = "#fff";
    circle(cx - 5, cy - 6, 4);
    circle(cx + 5, cy - 6, 4);
    ctx.fillStyle = "#111";
    circle(cx - 5, cy - 6, 2);
    circle(cx + 5, cy - 6, 2);
  }

  function drawHud() {
    const isNeon = skin.style === "neon";
    ctx.fillStyle = skin.hudText;
    ctx.font = "16px monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("SCORE " + score, 8, 6);
    ctx.textAlign = "center";
    ctx.fillText("LVL " + level, CANVAS_W / 2, 6);
    // Lives top-right (one frog dot per life).
    for (let i = 0; i < lives; i++) {
      if (isNeon) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = skin.hudFrogDot;
      }
      ctx.fillStyle = skin.hudFrogDot;
      circle(CANVAS_W - 14 - i * 18, 14, 6);
      if (isNeon) ctx.shadowBlur = 0;
    }
    // Time bar across the goals row top edge.
    const frac = Math.max(0, timeLeft / roundTime());
    const barW = CANVAS_W * frac;
    const barColor =
      frac > 0.5 ? skin.timeHigh : frac > 0.25 ? skin.timeMid : skin.timeLow;
    if (isNeon) {
      ctx.shadowBlur = 6;
      ctx.shadowColor = barColor;
    }
    ctx.fillStyle = barColor;
    ctx.fillRect(0, 0, barW, 4);
    if (isNeon) ctx.shadowBlur = 0;
  }

  // Round time shrinks with level (min 6s).
  function roundTime() {
    return Math.max(6, ROUND_TIME - (level - 1));
  }

  // ---- Canvas primitives --------------------------------------------------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Collision / support / goal ----------------------------------------
  // Frog occupies the cell span [frog.col, frog.col + 1); entity occupies
  // [e.col, e.col + e.width). Overlap = AABB in cell units.
  function overlaps(fcol, e) {
    return fcol < e.col + e.width && fcol + 1 > e.col;
  }

  function checkRoadCollision(f, ls) {
    for (let i = 0; i < ls.length; i++) {
      const lane = ls[i];
      if (lane.kind !== "road" || lane.row !== f.row) continue;
      for (let j = 0; j < lane.entities.length; j++) {
        if (overlaps(f.col, lane.entities[j])) return true;
      }
    }
    return false;
  }

  function getSupport(f, ls) {
    const center = f.col + 0.5;
    for (let i = 0; i < ls.length; i++) {
      const lane = ls[i];
      if (lane.kind !== "river" || lane.row !== f.row) continue;
      for (let j = 0; j < lane.entities.length; j++) {
        const e = lane.entities[j];
        if (e.type === "turtle" && e.submerged) continue;
        if (center >= e.col && center < e.col + e.width) return e;
      }
    }
    return null;
  }

  function checkGoal() {
    const fc = Math.round(frog.col);
    let idx = -1;
    for (let i = 0; i < GOAL_COLS.length; i++) {
      if (fc >= GOAL_COLS[i] && fc < GOAL_COLS[i] + GOAL_W) {
        idx = i;
        break;
      }
    }
    // Missed a bay, or landed on one already filled → death.
    if (idx < 0 || goalsFilled[idx]) {
      killFrog();
      return;
    }
    goalsFilled[idx] = true;
    score += 50 + Math.ceil(Math.max(0, timeLeft)) * 10; // bay + time bonus
    if (goalsFilled.every(Boolean)) {
      completeRound();
    } else {
      respawnFrog();
    }
  }

  // Return frog to the start base without touching lives/round state.
  function respawnFrog() {
    const mid = Math.floor(COLS / 2);
    frog.col = mid;
    frog.row = ROW_START;
    frog.fromCol = mid;
    frog.fromRow = ROW_START;
    frog.targetCol = mid;
    frog.targetRow = ROW_START;
    frog.animating = false;
    frog.animT = 0;
    pendingDir = null;
    rowReached = ROW_START;
    timeLeft = roundTime();
  }

  // ---- Round completion ---------------------------------------------------
  function completeRound() {
    score += 200; // round clear bonus
    level += 1; // syncHud() emits av:level
    goalsFilled = new Array(GOAL_COUNT).fill(false);
    lanes = buildLanes(level); // faster traffic / current
    respawnFrog(); // also resets timer to the new (shorter) roundTime()
  }

  // ---- Death --------------------------------------------------------------
  function killFrog() {
    lives -= 1;
    if (lives <= 0) {
      lives = 0;
      syncHud(); // pushes av:lives 0 (and any pending score/level)
      emit("av:gameOver", { score });
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      return;
    }
    // Still alive: HUD update happens on next frame's syncHud().
    respawnFrog();
  }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(64, ts - lastTs || 16);
    lastTs = ts;
    if (!paused) update(dt);
    draw();
    syncHud();
    rafId = requestAnimationFrame(frame);
  }

  // ---- Lifecycle ----------------------------------------------------------
  function init() {
    canvas = document.getElementById("av-canvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    reset();
    running = true;
    lastTs = 0;
    rafId = requestAnimationFrame(frame);
  }

  function reset() {
    score = 0;
    lives = START_LIVES;
    level = 1;
    timeLeft = ROUND_TIME;
    goalsFilled = new Array(GOAL_COUNT).fill(false);
    pendingDir = null;
    rowReached = ROW_START;
    frog = {
      col: Math.floor(COLS / 2),
      row: ROW_START,
      animating: false,
      animT: 0,
      fromCol: Math.floor(COLS / 2),
      fromRow: ROW_START,
      targetCol: Math.floor(COLS / 2),
      targetRow: ROW_START,
    };
    lanes = buildLanes(level);
    lastScore = lastLives = lastLevel = -1;
  }

  // ---- Input --------------------------------------------------------------
  const KEYMAP = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right",
  };
  function onKeyDown(e) {
    const dir = KEYMAP[e.code];
    if (!dir) return;
    e.preventDefault();
    if (!paused) pendingDir = dir;
  }
  document.addEventListener("keydown", onKeyDown);

  // ---- Public API ---------------------------------------------------------
  window.FROGGER = {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    restart() {
      reset();
      paused = false;
      if (!running) {
        running = true;
        lastTs = 0;
        rafId = requestAnimationFrame(frame);
      }
    },
    setSkin(name) {
      applySkin(name);
    },
    getSkins() {
      return Object.keys(SKINS).map((k) => ({ key: k, label: SKINS[k].label }));
    },
  };

  init();
})();
