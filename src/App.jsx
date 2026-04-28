import { useState, useCallback, useEffect, useRef } from 'react';
import { createWorld, stepAgent, getValidMoves, revealAll, CELL } from './world.js';
import './index.css';
import './App.css';

// ─── Grid Cell ────────────────────────────────────────────────────────────────
function GridCell({ cell, isAgent, isValidMove, isSafeMove, isGold, onClick, revealed }) {
  const getCellClass = () => {
    const base = 'grid-cell';
    if (isAgent) return `${base} cell-agent`;
    if ((cell.state === CELL.PIT || cell.hasPit) && revealed) return `${base} cell-pit`;
    if ((cell.state === CELL.WUMPUS || cell.hasWumpus) && revealed) return `${base} cell-wumpus`;
    if (cell.state === CELL.SAFE) return `${base} cell-safe`;
    if (cell.state === CELL.VISITED) return `${base} cell-visited`;
    return `${base} cell-unknown`;
  };

  const getIcon = () => {
    if (isAgent) return '◈';
    if ((cell.hasPit) && revealed) return '◉';
    if ((cell.hasWumpus) && revealed) return '☠';
    if (isGold) return '◆';
    if (cell.state === CELL.SAFE) return '◎';
    if (cell.state === CELL.VISITED) return '○';
    return '·';
  };

  const percepts = [];
  if (cell.percept?.breeze && (cell.state === CELL.VISITED || isAgent)) percepts.push('B');
  if (cell.percept?.stench && (cell.state === CELL.VISITED || isAgent)) percepts.push('S');

  return (
    <div
      className={`${getCellClass()}${isValidMove ? ' cell-clickable' : ''}`}
      onClick={() => isValidMove ? onClick(cell.row, cell.col) : null}
      title={`(${cell.row},${cell.col})${percepts.length ? ' — ' + percepts.join(', ') : ''}`}
    >
      <span className="cell-coord">{cell.row},{cell.col}</span>
      <span className="cell-icon">{getIcon()}</span>
      {percepts.length > 0 && (
        <span className="cell-percepts">{percepts.join(' ')}</span>
      )}
      {isValidMove && !isAgent && (
        <span className={`cell-move-hint ${isSafeMove ? 'hint-safe' : 'hint-unknown'}`}>
          {isSafeMove ? '✓' : '?'}
        </span>
      )}
    </div>
  );
}

// ─── Setup Panel ──────────────────────────────────────────────────────────────
function SetupPanel({ onStart }) {
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [pits, setPits] = useState(3);

  return (
    <div className="setup-wrapper">
      <div className="setup-panel">
        <div className="setup-header">
          <div className="logo-glyph">◈</div>
          <h1 className="logo-title">WUMPUS<span>LOGIC</span></h1>
          <p className="logo-sub">Knowledge-Based Agent · Propositional Resolution Refutation</p>
          <p className="logo-course">AI 2002 – Artificial Intelligence · NUCES Faisalabad</p>
        </div>

        <div className="setup-form">
          <div className="form-group">
            <label>GRID ROWS</label>
            <div className="number-input">
              <button onClick={() => setRows(r => Math.max(3, r - 1))}>−</button>
              <span>{rows}</span>
              <button onClick={() => setRows(r => Math.min(10, r + 1))}>+</button>
            </div>
          </div>
          <div className="form-group">
            <label>GRID COLS</label>
            <div className="number-input">
              <button onClick={() => setCols(c => Math.max(3, c - 1))}>−</button>
              <span>{cols}</span>
              <button onClick={() => setCols(c => Math.min(10, c + 1))}>+</button>
            </div>
          </div>
          <div className="form-group">
            <label>PIT COUNT</label>
            <div className="number-input">
              <button onClick={() => setPits(p => Math.max(1, p - 1))}>−</button>
              <span>{pits}</span>
              <button onClick={() => setPits(p => Math.min(Math.floor(rows * cols * 0.3), p + 1))}>+</button>
            </div>
          </div>
        </div>

        <button className="btn-start" onClick={() => onStart(rows, cols, pits)}>
          <span>INITIALIZE AGENT</span>
          <span className="btn-glyph">▶</span>
        </button>

        <div className="legend-section">
          <div className="legend-title">LEGEND</div>
          <div className="legend-row">
            <span className="leg-item leg-agent">◈ Agent</span>
            <span className="leg-item leg-safe">◎ Inferred Safe</span>
            <span className="leg-item leg-visited">○ Visited</span>
          </div>
          <div className="legend-row">
            <span className="leg-item leg-unknown">· Unknown</span>
            <span className="leg-item leg-pit">◉ Pit</span>
            <span className="leg-item leg-wumpus">☠ Wumpus</span>
            <span className="leg-item leg-gold">◆ Gold</span>
          </div>
        </div>

        <div className="info-box">
          <div className="info-title">HOW IT WORKS</div>
          <div className="info-text">
            The agent uses <strong>Propositional Logic</strong> and <strong>Resolution Refutation</strong> 
            to infer safe cells. It converts percept rules to CNF and resolves clauses 
            to prove ¬Pit ∧ ¬Wumpus before moving. Click <strong>green-highlighted</strong> cells to move.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Metrics Dashboard ─────────────────────────────────────────────────────────
function MetricsDash({ world }) {
  const { cells, agentPos, kb, score, moveHistory, won, gameOver } = world;
  const [ar, ac] = agentPos;
  const agentCell = cells[ar]?.[ac];
  const visited = cells.flat().filter(c => c.state === CELL.VISITED).length;
  const safeCells = cells.flat().filter(c => c.state === CELL.SAFE).length;

  const percepts = [];
  if (agentCell?.percept?.breeze) percepts.push({ label: 'BREEZE', cls: 'prc-breeze', sym: '≋' });
  if (agentCell?.percept?.stench) percepts.push({ label: 'STENCH', cls: 'prc-stench', sym: '⚠' });
  if (percepts.length === 0) percepts.push({ label: 'NONE', cls: 'prc-none', sym: '●' });

  return (
    <div className="metrics-dash">
      <div className="metrics-title">METRICS DASHBOARD</div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">INFERENCE STEPS</div>
          <div className="metric-value accent-blue">{kb.inferenceSteps.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">KB CLAUSES</div>
          <div className="metric-value accent-cyan">{kb.getClauseCount()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">SCORE</div>
          <div className={`metric-value ${score >= 0 ? 'accent-green' : 'accent-red'}`}>{score}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">MOVES</div>
          <div className="metric-value">{moveHistory.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">VISITED</div>
          <div className="metric-value">{visited}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">SAFE INFERRED</div>
          <div className="metric-value accent-green">{safeCells}</div>
        </div>
      </div>

      <div className="percept-section">
        <div className="percept-label">ACTIVE PERCEPTS @ ({ar},{ac})</div>
        <div className="percept-chips">
          {percepts.map(p => (
            <span key={p.label} className={`percept-chip ${p.cls}`}>{p.sym} {p.label}</span>
          ))}
        </div>
      </div>

      {(won || (gameOver && !won)) && (
        <div className={`status-banner ${won ? 'status-win' : 'status-lose'}`}>
          {won ? '🏆 GOLD RETRIEVED — MISSION COMPLETE' : '💀 AGENT TERMINATED'}
        </div>
      )}
    </div>
  );
}

// ─── Log Panel ─────────────────────────────────────────────────────────────────
function LogPanel({ log }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);

  return (
    <div className="log-panel">
      <div className="log-title">AGENT LOG</div>
      <div className="log-scroll" ref={ref}>
        {log.length === 0 && <div className="log-empty">Awaiting first move…<span className="blink">_</span></div>}
        {log.map((entry, i) => (
          <div key={i} className={`log-entry log-${entry.type}`}>
            <span className="log-num">{String(i + 1).padStart(3, '0')}</span>
            <span className="log-text">{entry.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KB Viewer ─────────────────────────────────────────────────────────────────
function KBViewer({ world }) {
  const [open, setOpen] = useState(false);
  const clauses = world.kb.clauses.slice(0, 50);

  return (
    <div className="kb-viewer">
      <button className="kb-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▲' : '▼'} KNOWLEDGE BASE ({world.kb.getClauseCount()} clauses in CNF)
      </button>
      {open && (
        <div className="kb-content">
          {clauses.map((clause, i) => (
            <div key={i} className="kb-clause">
              <span className="kb-num">{i + 1}.</span>
              {clause.length === 0
                ? <span className="kb-empty">⊥ (empty — contradiction)</span>
                : clause.map((l, j) => (
                    <span key={j}>
                      <span className={`kb-lit ${l.negated ? 'kb-neg' : 'kb-pos'}`}>
                        {l.negated ? '¬' : ''}{l.name}
                      </span>
                      {j < clause.length - 1 && <span className="kb-or"> ∨ </span>}
                    </span>
                  ))
              }
            </div>
          ))}
          {world.kb.clauses.length > 50 && (
            <div className="kb-truncated">…and {world.kb.clauses.length - 50} more clauses</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [world, setWorld] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const handleStart = useCallback((rows, cols, pits) => {
    const w = createWorld(rows, cols, pits);
    const w2 = stepAgent(w, 0, 0);
    setWorld(w2);
    setRevealed(false);
  }, []);

  const handleMove = useCallback((row, col) => {
    if (!world || world.gameOver) return;
    setWorld(prev => stepAgent(prev, row, col));
  }, [world]);

  const handleReveal = useCallback(() => {
    if (!world) return;
    setWorld(prev => revealAll(prev));
    setRevealed(true);
  }, [world]);

  const handleReset = useCallback(() => {
    setWorld(null);
    setRevealed(false);
  }, []);

  if (!world) return (
    <div className="app-shell">
      <SetupPanel onStart={handleStart} />
    </div>
  );

  const validMoves = world.gameOver ? [] : getValidMoves(world);
  const validSet = new Set(validMoves.map(m => `${m.row},${m.col}`));
  const safeMoveSet = new Set(validMoves.filter(m => m.isSafe).map(m => `${m.row},${m.col}`));
  const [ar, ac] = world.agentPos;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">◈</span>
          <span className="brand-name">WUMPUS<span>LOGIC</span></span>
          <span className="brand-sub">Resolution Refutation Agent</span>
        </div>
        <div className="header-controls">
          <button className="btn-sm btn-reveal" onClick={handleReveal} disabled={revealed}>
            {revealed ? '◉ REVEALED' : '◉ REVEAL ALL'}
          </button>
          <button className="btn-sm btn-reset" onClick={handleReset}>↺ NEW GAME</button>
        </div>
      </header>

      <div className="app-body">
        <div className="grid-panel">
          <div className="grid-label">
            GRID {world.rows}×{world.cols}
            <span className="grid-hint"> — Click adjacent cells to move agent</span>
          </div>
          <div
            className="wumpus-grid"
            style={{
              gridTemplateColumns: `repeat(${world.cols}, 1fr)`,
            }}
          >
            {world.cells.flat().map(cell => {
              const key = `${cell.row},${cell.col}`;
              const isAgent = cell.row === ar && cell.col === ac;
              const isGold = world.hasGold && world.goldPos &&
                cell.row === world.goldPos[0] && cell.col === world.goldPos[1] && revealed;
              return (
                <GridCell
                  key={key}
                  cell={cell}
                  isAgent={isAgent}
                  isValidMove={validSet.has(key)}
                  isSafeMove={safeMoveSet.has(key)}
                  isGold={isGold}
                  revealed={revealed}
                  onClick={handleMove}
                />
              );
            })}
          </div>

          <KBViewer world={world} />
        </div>

        <div className="side-panel">
          <MetricsDash world={world} />
          <LogPanel log={world.log} />
        </div>
      </div>
    </div>
  );
}
