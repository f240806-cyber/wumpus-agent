import { KnowledgeBase, getAdjacent } from './logic.js';

// ─── Cell states ──────────────────────────────────────────────────────────────
export const CELL = {
  UNKNOWN: 'unknown',
  VISITED: 'visited',
  SAFE: 'safe',
  PIT: 'pit',
  WUMPUS: 'wumpus',
  DANGER: 'danger',  // could be pit or wumpus but not confirmed
};

// ─── Create World ─────────────────────────────────────────────────────────────
export function createWorld(rows, cols, numPits = null) {
  const total = rows * cols;
  const pitCount = numPits ?? Math.max(1, Math.floor(total * 0.15));

  // Place hazards randomly, never at (0,0)
  const positions = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!(r === 0 && c === 0)) positions.push([r, c]);

  shuffle(positions);

  const pits = new Set();
  let wumpusPos = null;

  for (let i = 0; i < Math.min(pitCount, positions.length - 1); i++) {
    pits.add(posKey(positions[i][0], positions[i][1]));
  }
  wumpusPos = positions[pitCount];

  // Cells grid: stores display-layer state
  const cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r, col: c,
      state: CELL.UNKNOWN,
      hasPit: pits.has(posKey(r, c)),
      hasWumpus: wumpusPos ? (wumpusPos[0] === r && wumpusPos[1] === c) : false,
      percept: { breeze: false, stench: false, glitter: false },
      revealed: false,
    }))
  );

  // Compute percepts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const adj = getAdjacent(r, c, rows, cols);
      for (const [ar, ac] of adj) {
        if (cells[ar][ac].hasPit) cells[r][c].percept.breeze = true;
        if (cells[ar][ac].hasWumpus) cells[r][c].percept.stench = true;
      }
    }
  }

  return {
    rows, cols,
    cells,
    wumpusPos,
    wumpusAlive: true,
    pits,
    agentPos: [0, 0],
    hasGold: true,
    goldPos: positions[positions.length - 1], // last position
    score: 0,
    gameOver: false,
    won: false,
    kb: new KnowledgeBase(),
    log: [],
    moveHistory: [],
  };
}

// ─── Step: move agent ─────────────────────────────────────────────────────────
export function stepAgent(world, targetRow, targetCol) {
  if (world.gameOver) return world;

  const { rows, cols, cells, kb } = world;
  const [ar, ac] = world.agentPos;
  const newLog = [...world.log];

  // Visit the new cell
  const cell = cells[targetRow][targetCol];
  cell.state = CELL.VISITED;
  cell.revealed = true;

  const percept = cell.percept;
  newLog.push({
    type: 'move',
    text: `→ Moved to (${targetRow},${targetCol}) | Percepts: ${formatPercepts(percept)}`,
    pos: [targetRow, targetCol],
  });

  // TELL KB
  kb.tellPercept(targetRow, targetCol, percept, rows, cols);

  // Check for death
  if (cell.hasPit) {
    newLog.push({ type: 'death', text: '💀 Fell into a PIT! Game Over.' });
    return { ...world, agentPos: [targetRow, targetCol], log: newLog, gameOver: true, won: false, score: world.score - 1000 };
  }
  if (cell.hasWumpus && world.wumpusAlive) {
    newLog.push({ type: 'death', text: '💀 Eaten by the WUMPUS! Game Over.' });
    return { ...world, agentPos: [targetRow, targetCol], log: newLog, gameOver: true, won: false, score: world.score - 1000 };
  }

  // Gold check
  let won = world.won;
  let score = world.score - 1; // cost per step
  let hasGold = world.hasGold;
  if (world.hasGold && world.goldPos && targetRow === world.goldPos[0] && targetCol === world.goldPos[1]) {
    score += 1000;
    hasGold = false;
    won = true;
    newLog.push({ type: 'win', text: '🏆 GOLD FOUND! Victory!' });
  }

  // ASK KB: infer safety of all unvisited adjacent cells
  const adjCells = getAdjacent(targetRow, targetCol, rows, cols);
  let totalInferenceSteps = 0;

  for (const [nr, nc] of adjCells) {
    const nc_cell = cells[nr][nc];
    if (nc_cell.state === CELL.UNKNOWN) {
      const result = kb.isSafe(nr, nc);
      totalInferenceSteps += result.steps;
      if (result.safe) {
        nc_cell.state = CELL.SAFE;
        newLog.push({ type: 'infer', text: `✓ KB proved (${nr},${nc}) SAFE [${result.steps} steps]` });
      }
    }
  }

  if (totalInferenceSteps > 0) {
    newLog.push({ type: 'kb', text: `KB size: ${kb.getClauseCount()} clauses | Total inference steps: ${kb.inferenceSteps}` });
  }

  return {
    ...world,
    agentPos: [targetRow, targetCol],
    cells: cells.map(row => [...row]),
    log: newLog.slice(-50), // keep last 50 entries
    moveHistory: [...world.moveHistory, [targetRow, targetCol]],
    score,
    hasGold,
    won,
    gameOver: won,
  };
}

// ─── Get valid moves from agent's current position ────────────────────────────
export function getValidMoves(world) {
  const [ar, ac] = world.agentPos;
  const adj = getAdjacent(ar, ac, world.rows, world.cols);
  return adj.map(([r, c]) => ({
    row: r, col: c,
    state: world.cells[r][c].state,
    isSafe: world.cells[r][c].state === CELL.SAFE || world.cells[r][c].state === CELL.VISITED,
  }));
}

// ─── Reveal actual hazards (game over or debug) ───────────────────────────────
export function revealAll(world) {
  const cells = world.cells.map(row =>
    row.map(cell => ({
      ...cell,
      revealed: true,
      state: cell.hasPit ? CELL.PIT :
             (cell.hasWumpus && world.wumpusAlive) ? CELL.WUMPUS :
             cell.state,
    }))
  );
  return { ...world, cells };
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function posKey(r, c) { return `${r},${c}`; }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function formatPercepts(p) {
  const parts = [];
  if (p.breeze) parts.push('Breeze');
  if (p.stench) parts.push('Stench');
  if (p.glitter) parts.push('Glitter');
  return parts.length ? parts.join(', ') : 'None';
}
