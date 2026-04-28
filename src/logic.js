/**
 * Propositional Logic Knowledge Base with Resolution Refutation
 * Implements CNF conversion and resolution for Wumpus World inference.
 */

// ─── Literal helpers ──────────────────────────────────────────────────────────
export function lit(name, negated = false) { return { name, negated }; }
export function negLit(l) { return { name: l.name, negated: !l.negated }; }
export function litKey(l) { return (l.negated ? '¬' : '') + l.name; }
function litEq(a, b) { return a.name === b.name && a.negated === b.negated; }
function clauseKey(clause) { return [...clause].map(litKey).sort().join('∨'); }

// ─── CNF Clause (disjunction of literals) ─────────────────────────────────────
function resolve(c1, c2) {
  const results = [];
  for (const l of c1) {
    const complement = negLit(l);
    if (c2.some(m => litEq(m, complement))) {
      // Resolve on l / ¬l
      const merged = [
        ...c1.filter(x => !litEq(x, l)),
        ...c2.filter(x => !litEq(x, complement)),
      ];
      // Remove duplicates
      const unique = [];
      const seen = new Set();
      for (const m of merged) {
        const k = litKey(m);
        if (!seen.has(k)) { seen.add(k); unique.push(m); }
      }
      // Tautology check: if contains both P and ¬P, discard
      const names = unique.map(x => x.name);
      const isTaut = names.some(n =>
        unique.some(x => x.name === n && !x.negated) &&
        unique.some(x => x.name === n && x.negated)
      );
      if (!isTaut) results.push(unique);
    }
  }
  return results;
}

// ─── Knowledge Base ────────────────────────────────────────────────────────────
export class KnowledgeBase {
  constructor() {
    this.clauses = [];   // Array of clauses (each clause = array of literals)
    this.inferenceSteps = 0;
  }

  /** Add a clause (disjunction of literals) to the KB */
  tell(clause) {
    const key = clauseKey(clause);
    if (!this.clauses.some(c => clauseKey(c) === key)) {
      this.clauses.push(clause);
    }
  }

  /** Tell a conjunction of clauses (CNF formula) */
  tellCNF(clauses) {
    clauses.forEach(c => this.tell(c));
  }

  /**
   * Tell percepts for a cell (row, col):
   *  breeze → biconditional with adjacent pits (converted to CNF)
   *  stench → biconditional with adjacent wumpus positions
   *  no breeze/stench → negative facts
   */
  tellPercept(row, col, percept, rows, cols) {
    const adjCells = getAdjacent(row, col, rows, cols);

    if (percept.breeze) {
      // B_{r,c} is true → add: ∨(P_adj) for all adjacent
      // Also: for each adj, ¬B_{r,c} ∨ P_adj NOT needed here;
      // We encode: breeze iff at least one adjacent pit
      // Forward: B → P_a ∨ P_b ∨ ...
      this.tell(adjCells.map(([ar, ac]) => lit(`P_${ar}_${ac}`)));
      // Backward: ¬B ← ¬P_a ∧ ¬P_b ... → for each adj: P_adj → B
      adjCells.forEach(([ar, ac]) => {
        this.tell([lit(`P_${ar}_${ac}`, true), lit(`B_${row}_${col}`)]);
      });
      // Assert breeze is true at this cell
      this.tell([lit(`B_${row}_${col}`)]);
    } else {
      // No breeze → no adjacent pits
      adjCells.forEach(([ar, ac]) => {
        this.tell([lit(`P_${ar}_${ac}`, true)]);
      });
      this.tell([lit(`B_${row}_${col}`, true)]);
    }

    if (percept.stench) {
      this.tell(adjCells.map(([ar, ac]) => lit(`W_${ar}_${ac}`)));
      adjCells.forEach(([ar, ac]) => {
        this.tell([lit(`W_${ar}_${ac}`, true), lit(`S_${row}_${col}`)]);
      });
      this.tell([lit(`S_${row}_${col}`)]);
    } else {
      adjCells.forEach(([ar, ac]) => {
        this.tell([lit(`W_${ar}_${ac}`, true)]);
      });
      this.tell([lit(`S_${row}_${col}`, true)]);
    }
  }

  /**
   * Resolution Refutation: Ask if `alpha` (a positive literal string) is entailed.
   * To prove α, we add ¬α and try to derive ⊥.
   * Returns { entailed: bool, steps: number }
   */
  ask(literalName, negated = false) {
    // We want to prove: lit(literalName, negated)
    // Add negation of query to KB copy
    const queryNeg = [lit(literalName, !negated)];

    const workingClauses = [...this.clauses.map(c => [...c]), queryNeg];
    const seen = new Set(workingClauses.map(clauseKey));
    let steps = 0;
    const maxSteps = 2000;

    // BFS/saturation resolution
    let changed = true;
    while (changed && steps < maxSteps) {
      changed = false;
      const n = workingClauses.length;
      for (let i = 0; i < n && steps < maxSteps; i++) {
        for (let j = i + 1; j < n && steps < maxSteps; j++) {
          const resolvents = resolve(workingClauses[i], workingClauses[j]);
          steps++;
          for (const r of resolvents) {
            if (r.length === 0) {
              // Empty clause → contradiction → query is entailed
              this.inferenceSteps += steps;
              return { entailed: true, steps };
            }
            const key = clauseKey(r);
            if (!seen.has(key)) {
              seen.add(key);
              workingClauses.push(r);
              changed = true;
            }
          }
        }
      }
    }

    this.inferenceSteps += steps;
    return { entailed: false, steps };
  }

  /**
   * Check if a cell is provably safe (no pit AND no wumpus)
   */
  isSafe(row, col) {
    const noPit = this.ask(`P_${row}_${col}`, true);   // prove ¬P
    const noWumpus = this.ask(`W_${row}_${col}`, true); // prove ¬W
    return {
      safe: noPit.entailed && noWumpus.entailed,
      steps: noPit.steps + noWumpus.steps,
      noPit: noPit.entailed,
      noWumpus: noWumpus.entailed,
    };
  }

  getClauseCount() { return this.clauses.length; }
}

// ─── Grid helpers ──────────────────────────────────────────────────────────────
export function getAdjacent(row, col, rows, cols) {
  const adj = [];
  if (row > 0) adj.push([row - 1, col]);
  if (row < rows - 1) adj.push([row + 1, col]);
  if (col > 0) adj.push([row, col - 1]);
  if (col < cols - 1) adj.push([row, col + 1]);
  return adj;
}
