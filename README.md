# WumpusLogic — Knowledge-Based Agent

> AI 2002 – Artificial Intelligence (Spring 2026) · Assignment 6 · NUCES Faisalabad

A web-based **Knowledge-Based Agent** that navigates a dynamic Wumpus World grid using **Propositional Logic** and **Resolution Refutation** to infer safe cells before moving.

---

## Links

| | URL |
|---|---|
| 🌐 Live Demo | (https://wumpus-agent-six.vercel.app/) |


---

## Features

- **Dynamic Grid** — Configurable rows × columns (3×3 up to 10×10)
- **Random Hazards** — Pits and Wumpus placed randomly each episode; agent has zero prior knowledge
- **Percept Engine** — Breeze if adjacent to a Pit, Stench if adjacent to the Wumpus
- **Propositional Logic KB** — Percept biconditionals encoded as CNF clauses via `TELL`
- **Resolution Refutation** — Proves `¬Pit ∧ ¬Wumpus` for adjacent cells before marking them safe
- **Real-Time Dashboard** — Inference step counter, KB clause count, active percepts, score
- **KB Viewer** — Expandable panel showing live CNF clauses with positive/negative literals

### Cell Legend

| Symbol | Meaning |
|---|---|
| `◈` | Agent (current position) |
| `◎` | Inferred Safe (proved by resolution) |
| `○` | Visited |
| `·` | Unknown / Unvisited |
| `◉` | Pit |
| `☠` | Wumpus |
| `◆` | Gold |

---

## How the Inference Works

1. **TELL** — On visiting cell `(r,c)`, percept rules are converted to CNF and added to the KB.  
   Example: `Breeze_(r,c)` → `(P_a ∨ P_b ∨ …)` and `¬P_adj ← ¬Breeze`

2. **ASK** — To check if cell `(r,c)` is safe, the engine adds `P_(r,c)` (negation of the query) to a working copy of the KB and runs pairwise resolution until the empty clause `⊥` is derived — proving `¬P_(r,c)`.

3. **Safe** — A cell is marked safe only when both `¬Pit` and `¬Wumpus` are proved.

---

## Project Structure

```
src/
├── logic.js    # KnowledgeBase class, CNF encoding, Resolution Refutation
├── world.js    # Grid creation, hazard placement, percepts, TELL/ASK loop
├── App.jsx     # React UI — Grid, MetricsDash, LogPanel, KBViewer
├── App.css     # Design system
└── index.css   # CSS variables, animations
```

---

## Local Development

```bash
npm install
npm run dev     # → http://localhost:5173
```

## Deploy to Vercel

```bash
npm run build   # outputs to /dist
```

1. Push to GitHub
2. Import repo at [vercel.com](https://vercel.com)
3. Framework auto-detected as **Vite**
4. Click **Deploy** — `vercel.json` is already configured

---

## Scoring

| Event | Points |
|---|---|
| Each move | −1 |
| Fell into pit / eaten by Wumpus | −1000 |
| Retrieved gold | +1000 |

---

## Submission

Rename zip as: `AI_A6_XXF-YYYY.zip`  
Include: source code + PDF report explaining the CNF encoding and resolution loop.
