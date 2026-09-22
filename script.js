(() => {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;

  const COLORS = {
    I: "#5eead4",
    O: "#facc15",
    T: "#c084fc",
    S: "#4ade80",
    Z: "#f87171",
    J: "#60a5fa",
    L: "#fb923c",
  };

  const SHAPES = {
    I: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
    O: [
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
    T: [
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
    S: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
    Z: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
    J: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
    L: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
  };

  const KICKS = [
    [0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1], [0, 1],
  ];

  const LEVEL_SPEED_MS = [
    800, 720, 630, 550, 470, 380, 300, 220, 170, 130, 100, 90, 80, 70, 60, 50,
  ];

  const boardCanvas = document.getElementById("board-canvas");
  const boardCtx = boardCanvas.getContext("2d");
  const nextCanvas = document.getElementById("next-canvas");
  const nextCtx = nextCanvas.getContext("2d");
  const holdCanvas = document.getElementById("hold-canvas");
  const holdCtx = holdCanvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const linesEl = document.getElementById("lines");
  const highScoreEl = document.getElementById("high-score");
  const overlay = document.getElementById("overlay");
  const overlayText = document.getElementById("overlay-text");
  const overlayButton = document.getElementById("overlay-button");

  const HIGH_SCORE_KEY = "tetris-high-score";

  let grid, current, bag, nextQueue, holdPiece, canHold;
  let score, level, lines, dropInterval, dropTimer, lastTime;
  let running, paused, gameOver;
  let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  highScoreEl.textContent = highScore;

  function createGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function refillBag() {
    const types = Object.keys(SHAPES);
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    return types;
  }

  function nextFromBag() {
    if (bag.length === 0) bag = refillBag();
    return bag.pop();
  }

  function spawnPiece(type) {
    return {
      type,
      rotation: 0,
      x: 3,
      y: -1,
    };
  }

  function cellsFor(piece) {
    return SHAPES[piece.type][piece.rotation].map(([cx, cy]) => [
      piece.x + cx,
      piece.y + cy,
    ]);
  }

  function collides(piece) {
    return cellsFor(piece).some(([x, y]) => {
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y < 0) return false;
      return grid[y][x] !== null;
    });
  }

  function lockPiece() {
    cellsFor(current).forEach(([x, y]) => {
      if (y >= 0) grid[y][x] = COLORS[current.type];
    });
    clearLines();
    spawnNext();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every((cell) => cell !== null)) {
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] * level;
      score += points;
      lines += cleared;
      const newLevel = Math.min(16, Math.floor(lines / 10) + 1);
      if (newLevel !== level) {
        level = newLevel;
        dropInterval = LEVEL_SPEED_MS[level - 1];
      }
      updateStats();
    }
  }

  function updateStats() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = lines;
    if (score > highScore) {
      highScore = score;
      highScoreEl.textContent = highScore;
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    }
  }

  function spawnNext() {
    const type = nextQueue.shift();
    nextQueue.push(nextFromBag());
    current = spawnPiece(type);
    canHold = true;
    if (collides(current)) {
      endGame();
    }
    drawNext();
  }

  function move(dx, dy) {
    const moved = { ...current, x: current.x + dx, y: current.y + dy };
    if (!collides(moved)) {
      current = moved;
      return true;
    }
    return false;
  }

  function rotate(dir) {
    const nextRotation = (current.rotation + dir + 4) % 4;
    for (const [kx, ky] of KICKS) {
      const attempt = { ...current, rotation: nextRotation, x: current.x + kx, y: current.y + ky };
      if (!collides(attempt)) {
        current = attempt;
        return;
      }
    }
  }

  function hardDrop() {
    let dropped = 0;
    while (move(0, 1)) dropped++;
    score += dropped * 2;
    lockPiece();
    updateStats();
  }

  function softDrop() {
    if (move(0, 1)) {
      score += 1;
      updateStats();
    } else {
      lockPiece();
    }
  }

  function holdCurrent() {
    if (!canHold) return;
    canHold = false;
    const type = current.type;
    if (holdPiece === null) {
      holdPiece = type;
      spawnNext();
    } else {
      const swap = holdPiece;
      holdPiece = type;
      current = spawnPiece(swap);
      if (collides(current)) endGame();
    }
    drawHold();
  }

  function ghostPiece() {
    let ghost = { ...current };
    while (!collides({ ...ghost, y: ghost.y + 1 })) {
      ghost = { ...ghost, y: ghost.y + 1 };
    }
    return ghost;
  }

  function drawCell(ctx, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.fillRect(x * size, y * size, size - 1, size - 1);
  }

  function drawBoard() {
    boardCtx.fillStyle = "#0b0c10";
    boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

    boardCtx.strokeStyle = "#20232d";
    for (let x = 0; x <= COLS; x++) {
      boardCtx.beginPath();
      boardCtx.moveTo(x * CELL, 0);
      boardCtx.lineTo(x * CELL, ROWS * CELL);
      boardCtx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      boardCtx.beginPath();
      boardCtx.moveTo(0, y * CELL);
      boardCtx.lineTo(COLS * CELL, y * CELL);
      boardCtx.stroke();
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x]) drawCell(boardCtx, x, y, grid[y][x], CELL);
      }
    }

    if (current && !gameOver) {
      const ghost = ghostPiece();
      boardCtx.globalAlpha = 0.25;
      cellsFor(ghost).forEach(([x, y]) => {
        if (y >= 0) drawCell(boardCtx, x, y, COLORS[current.type], CELL);
      });
      boardCtx.globalAlpha = 1;

      cellsFor(current).forEach(([x, y]) => {
        if (y >= 0) drawCell(boardCtx, x, y, COLORS[current.type], CELL);
      });
    }
  }

  function drawPreviewPiece(ctx, type, offsetY) {
    if (!type) return;
    const shape = SHAPES[type][0];
    const size = 22;
    const xs = shape.map((c) => c[0]);
    const ys = shape.map((c) => c[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const width = (maxX - minX + 1) * size;
    const offsetX = (nextCanvas.width - width) / 2 - minX * size;
    shape.forEach(([cx, cy]) => {
      drawCell(ctx, (cx * size + offsetX) / size, (cy * size + offsetY) / size, COLORS[type], size);
    });
  }

  function drawNext() {
    nextCtx.fillStyle = "#0b0c10";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextQueue.slice(0, 3).forEach((type, i) => {
      drawPreviewPiece(nextCtx, type, i * 90 + 20);
    });
  }

  function drawHold() {
    holdCtx.fillStyle = "#0b0c10";
    holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
    drawPreviewPiece(holdCtx, holdPiece, 30);
  }

  function endGame() {
    gameOver = true;
    running = false;
    stopLoop();
    overlayText.textContent = "GAME OVER";
    overlayButton.textContent = "RESTART";
    overlay.classList.remove("hidden");
  }

  function togglePause() {
    if (gameOver || !running) return;
    paused = !paused;
    if (paused) {
      stopLoop();
      overlayText.textContent = "PAUSED";
      overlayButton.textContent = "RESUME";
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
      lastTime = performance.now();
      loop(lastTime);
    }
  }

  function resetGame() {
    grid = createGrid();
    bag = refillBag();
    nextQueue = [nextFromBag(), nextFromBag(), nextFromBag()];
    holdPiece = null;
    canHold = true;
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = LEVEL_SPEED_MS[0];
    dropTimer = 0;
    paused = false;
    gameOver = false;
    running = true;
    updateStats();
    spawnNext();
    drawHold();
    overlay.classList.add("hidden");
    lastTime = performance.now();
    loop(lastTime);
  }

  let rafId = null;
  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function loop(time) {
    if (!running || paused || gameOver) return;
    const delta = time - lastTime;
    lastTime = time;
    dropTimer += delta;
    if (dropTimer >= dropInterval) {
      dropTimer = 0;
      if (!move(0, 1)) lockPiece();
    }
    drawBoard();
    rafId = requestAnimationFrame(loop);
  }

  const KEY_ALIASES = {
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    ArrowDown: "ArrowDown",
    ArrowUp: "ArrowUp",
    " ": "Space",
    Spacebar: "Space",
    x: "KeyX",
    X: "KeyX",
    z: "KeyZ",
    Z: "KeyZ",
    c: "KeyC",
    C: "KeyC",
    p: "KeyP",
    P: "KeyP",
  };

  function resolveAction(e) {
    if (e.code) return e.code;
    return KEY_ALIASES[e.key] || "";
  }

  const keyState = {};
  document.addEventListener("keydown", (e) => {
    const action = resolveAction(e);
    if (gameOver && action !== "KeyP") return;
    const repeatable = action === "KeyX" || action === "ArrowDown";
    if (!repeatable && keyState[action]) return;
    keyState[action] = true;

    switch (action) {
      case "ArrowLeft":
        move(-1, 0);
        break;
      case "ArrowRight":
        move(1, 0);
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "KeyX":
        rotate(1);
        break;
      case "KeyZ":
        rotate(-1);
        break;
      case "ArrowUp":
        e.preventDefault();
        hardDrop();
        break;
      case "KeyC":
        holdCurrent();
        break;
      case "KeyP":
        togglePause();
        break;
      default:
        return;
    }
    drawBoard();
  });

  document.addEventListener("keyup", (e) => {
    keyState[resolveAction(e)] = false;
  });

  function bindTouch(id, action) {
    const btn = document.getElementById(id);
    btn.addEventListener("click", () => {
      if (gameOver || paused) return;
      action();
      drawBoard();
    });
  }

  bindTouch("btn-left", () => move(-1, 0));
  bindTouch("btn-right", () => move(1, 0));
  bindTouch("btn-down", () => softDrop());
  bindTouch("btn-rotate-l", () => rotate(-1));
  bindTouch("btn-rotate-r", () => rotate(1));
  bindTouch("btn-drop", () => hardDrop());
  bindTouch("btn-hold", () => holdCurrent());
  document.getElementById("btn-pause").addEventListener("click", togglePause);

  overlayButton.addEventListener("click", () => {
    if (paused && running && !gameOver) {
      togglePause();
    } else {
      resetGame();
    }
  });

  overlayText.textContent = "TETRIS";
  overlayButton.textContent = "START";
  overlay.classList.remove("hidden");
  running = false;
  grid = createGrid();
  drawBoard();
})();
