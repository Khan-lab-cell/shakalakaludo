// Pure game logic. No React, no Supabase — just functions over the board state.
// Board shape: { red: [piece,piece,piece,piece], blue: [...], green: [...], yellow: [...] }
// piece shape:
//   'home'                          — sitting in the home base
//   { type: 'main', index: 0..51 }   — on the main 52-cell loop
//   { type: 'homePath', index: 0..4 } — in the color's home column
//   'finished'                      — reached the final home (center)

import {
  COLORS, PATH, PATH_LENGTH, HOME_COLUMN_LENGTH,
  START, HOME_ENTRY, HOME_PATH, FINAL_HOME, SAFE_SQUARES, HOME_SLOTS,
} from './boardPaths.js';

export { PATH, PATH_LENGTH, HOME_COLUMN_LENGTH, START, HOME_ENTRY, HOME_PATH, FINAL_HOME, SAFE_SQUARES, HOME_SLOTS };

export const createInitialBoard = () => ({
  red: ['home', 'home', 'home', 'home'],
  blue: ['home', 'home', 'home', 'home'],
  green: ['home', 'home', 'home', 'home'],
  yellow: ['home', 'home', 'home', 'home'],
});

export const rollDice = () => ({
  die1: 1 + Math.floor(Math.random() * 6),
  die2: 1 + Math.floor(Math.random() * 6),
});

export const isDoubleSix = (dice) => dice && dice.die1 === 6 && dice.die2 === 6;
export const hasSix = (dice) => dice && (dice.die1 === 6 || dice.die2 === 6);

const allHome = (board, color) => board[color].every((p) => p === 'home');

// Count finished pieces for a color.
const countFinished = (board, color) =>
  board[color].filter((p) => p === 'finished').length;

export const hasWon = (board, color) => countFinished(board, color) === 4;

// Get the grid coordinate of a piece (for rendering).
export const pieceCoord = (piece, color, slot) => {
  if (piece === 'home') return HOME_SLOTS[color][slot];
  if (piece === 'finished') return FINAL_HOME[color];
  if (piece.type === 'main') return PATH[piece.index];
  if (piece.type === 'homePath') return HOME_PATH[color][piece.index];
  return null;
};

// Compute the path a piece slides along for a given move. Used for animation.
export const piecePathBetween = (from, to, color) => {
  if (!from || !to) return [];
  // home -> main start
  if (from === 'home') {
    const start = PATH[START[color]];
    return [start];
  }
  if (from.type === 'main' && to.type === 'main') {
    const out = [];
    for (let i = 1; i <= ((to.index - from.index + PATH_LENGTH) % PATH_LENGTH); i++) {
      out.push(PATH[(from.index + i) % PATH_LENGTH]);
    }
    return out;
  }
  if (from.type === 'main' && to.type === 'homePath') {
    const out = [];
    let s = (from.index + 1) % PATH_LENGTH;
    while (s !== HOME_ENTRY[color]) {
      out.push(PATH[s]);
      const next = (s + 1) % PATH_LENGTH;
      if (next === HOME_ENTRY[color]) break;
      s = next;
    }
    for (let i = 0; i <= to.index; i++) out.push(HOME_PATH[color][i]);
    return out;
  }
  if (from.type === 'homePath' && to.type === 'homePath') {
    const out = [];
    for (let i = from.index + 1; i <= to.index; i++) out.push(HOME_PATH[color][i]);
    return out;
  }
  if (from.type === 'homePath' && to === 'finished') {
    const out = [];
    for (let i = from.index + 1; i < HOME_COLUMN_LENGTH; i++) out.push(HOME_PATH[color][i]);
    out.push(FINAL_HOME[color]);
    return out;
  }
  return [];
};

// ------------------------------------------------------------------
// Move validation
// ------------------------------------------------------------------

// True if `piece` can move by `steps` from its current state.
const canMoveBy = (board, color, piece, steps) => {
  if (piece === 'home') return false; // handled by canBringOut
  if (piece === 'finished') return false;
  if (piece.type === 'main') {
    const entry = HOME_ENTRY[color];
    const target = piece.index + steps;
    if (target < entry) return true;
    if (target === entry) return true; // enters home column
    return false; // overshoots home entry
  }
  if (piece.type === 'homePath') {
    const target = piece.index + steps;
    return target <= HOME_COLUMN_LENGTH; // == HOME_COLUMN_LENGTH means 'finished'
  }
  return false;
};

// After moving to a main-path cell, does the move land on the start of a home column?
// (i.e., the cell IS the home entry for the moving color)
const entersHomeColumn = (piece, steps, color) =>
  piece.type === 'main' && piece.index + steps === HOME_ENTRY[color];

// After moving to a main-path cell, what is the new piece state?
const mainMoveResult = (piece, steps, color) => {
  if (entersHomeColumn(piece, steps, color)) return { type: 'homePath', index: 0 };
  return { type: 'main', index: piece.index + steps };
};

// Build a list of opponent pieces on a given main-path cell.
const opponentsOnMainCell = (board, color, index) => {
  const out = [];
  for (const c of COLORS) {
    if (c === color) continue;
    board[c].forEach((p, i) => {
      if (p && p.type === 'main' && p.index === index) out.push({ color: c, slot: i });
    });
  }
  return out;
};

// Pieces occupying a safe square cannot be captured; multiple pieces can stack.
const isSafeMainIndex = (i) => SAFE_SQUARES.has(i);

// Apply a single piece move (returns { board, captured, enteredHome, finished }).
export const applyPieceMove = (board, color, slot, steps) => {
  const piece = board[color][slot];
  const newBoard = { red: [...board.red], blue: [...board.blue], green: [...board.green], yellow: [...board.yellow] };
  let captured = [];
  let enteredHome = false;
  let finished = false;

  if (piece === 'home') {
    // Bring out to start square.
    newBoard[color][slot] = { type: 'main', index: START[color] };
    // Check for capture on the start square.
    const opp = opponentsOnMainCell(newBoard, color, START[color]);
    if (!isSafeMainIndex(START[color])) {
      opp.forEach(({ color: c, slot: s }) => {
        newBoard[c][s] = 'home';
        captured.push({ color: c, slot: s });
      });
    } else if (opp.length > 0) {
      // Safe square: can't capture, but the moving piece can't land here if blocker.
      // If >=1 opponent already on safe square, our piece can still land (stacking allowed on safe squares).
    }
    return { board: newBoard, captured, enteredHome: false, finished: false };
  }

  if (piece.type === 'main') {
    const newState = mainMoveResult(piece, steps, color);
    newBoard[color][slot] = newState;
    if (newState.type === 'homePath') enteredHome = true;
    // Capture only if landing on a main-path cell (not the home column).
    if (newState.type === 'main') {
      const opp = opponentsOnMainCell(newBoard, color, newState.index);
      const safe = isSafeMainIndex(newState.index);
      if (!safe && opp.length === 1) {
        const { color: c, slot: s } = opp[0];
        newBoard[c][s] = 'home';
        captured.push({ color: c, slot: s });
      }
      // If opp.length >= 2 on non-safe, it's a blocker — but we already placed our piece, so undo.
      if (!safe && opp.length >= 2) {
        // The piece can't land here. Revert.
        return { board, captured: [], enteredHome: false, finished: false, invalid: true };
      }
    }
    return { board: newBoard, captured, enteredHome, finished: false };
  }

  if (piece.type === 'homePath') {
    const target = piece.index + steps;
    if (target === HOME_COLUMN_LENGTH) {
      newBoard[color][slot] = 'finished';
      finished = true;
    } else if (target < HOME_COLUMN_LENGTH) {
      newBoard[color][slot] = { type: 'homePath', index: target };
    } else {
      return { board, captured: [], enteredHome: false, finished: false, invalid: true };
    }
    return { board: newBoard, captured, enteredHome, finished };
  }

  return { board, captured: [], enteredHome: false, finished: false };
};

// ------------------------------------------------------------------
// Move options
// ------------------------------------------------------------------

// Collect all valid single-piece moves for a given number of steps.
const collectSingleMoves = (board, color, steps) => {
  const moves = [];
  for (let s = 0; s < 4; s++) {
    const p = board[color][s];
    if (p === 'home' || p === 'finished') continue;
    if (canMoveBy(board, color, p, steps)) {
      moves.push({ kind: 'single', slot: s, steps });
    }
  }
  return moves;
};

const collectBringOutMoves = (board, color) => {
  const moves = [];
  for (let s = 0; s < 4; s++) {
    if (board[color][s] === 'home') moves.push({ kind: 'bringOut', slot: s, steps: 0 });
  }
  return moves;
};

// Compute all four move options for the current dice.
export const getValidOptions = (board, color, dice) => {
  if (!dice) return { A: [], B: [], C: [], D: [], bringOut: [], skipTurn: false };

  // Skip-turn rule: no 6 rolled AND every piece still at home.
  if (!hasSix(dice) && allHome(board, color)) {
    return { A: [], B: [], C: [], D: [], bringOut: [], skipTurn: true };
  }

  // Option C: d1 only, Option D: d2 only
  const C = collectSingleMoves(board, color, dice.die1);
  const D = collectSingleMoves(board, color, dice.die2);

  // Option A: d1 + d2
  const A = collectSingleMoves(board, color, dice.die1 + dice.die2);

  // Option B: split — one piece by d1, another by d2
  // A "split" can also be: bring one piece out (using a 6) and move another by the other die.
  const B = [];
  const canBring = hasSix(dice);
  if (canBring) {
    // Subcase B1: bring out from home + move another piece by the OTHER die.
    for (let s = 0; s < 4; s++) {
      if (board[color][s] !== 'home') continue;
      const otherDie = dice.die1 === 6 ? dice.die2 : dice.die1;
      for (let t = 0; t < 4; t++) {
        if (t === s) continue;
        const p = board[color][t];
        if (p === 'home' || p === 'finished') continue;
        if (canMoveBy(board, color, p, otherDie)) {
          B.push({ kind: 'split', slots: [s, t], steps: [0, otherDie] });
        }
      }
    }
  }
  // Subcase B2: two different pieces, one by d1 and one by d2 (both on board).
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (i === j) continue;
      const pi = board[color][i];
      const pj = board[color][j];
      if (pi === 'home' || pi === 'finished') continue;
      if (pj === 'home' || pj === 'finished') continue;
      if (canMoveBy(board, color, pi, dice.die1) && canMoveBy(board, color, pj, dice.die2)) {
        B.push({ kind: 'split', slots: [i, j], steps: [dice.die1, dice.die2] });
      }
    }
  }
  // Deduplicate B by slot-pair (anyDice1, anyDice2).
  const seen = new Set();
  const Buniq = B.filter((m) => {
    const k = `${m.slots[0]}-${m.slots[1]}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Standalone bring-out option: bring one piece out using the 6, forfeit the other die.
  const bringOut = canBring ? collectBringOutMoves(board, color) : [];

  return {
    A, B: Buniq, C, D, bringOut,
    skipTurn: false,
  };
};

// Resolve a chosen option to concrete piece(s) + steps to apply.
export const resolveOption = (option) => {
  if (!option) return [];
  if (option.kind === 'single' || option.kind === 'bringOut') {
    return [{ slot: option.slot, steps: option.steps }];
  }
  if (option.kind === 'split') {
    return [
      { slot: option.slots[0], steps: option.steps[0] },
      { slot: option.slots[1], steps: option.steps[1] },
    ];
  }
  return [];
};

// Apply a list of piece moves sequentially, returning final board and events.
export const applyMoves = (board, color, moves) => {
  let cur = board;
  const allCaptured = [];
  let anyEnteredHome = false;
  let anyFinished = false;
  for (const m of moves) {
    const r = applyPieceMove(cur, color, m.slot, m.steps);
    if (r.invalid) return { board: cur, captured: allCaptured, invalid: true };
    cur = r.board;
    if (r.captured.length) allCaptured.push(...r.captured);
    if (r.enteredHome) anyEnteredHome = true;
    if (r.finished) anyFinished = true;
  }
  return { board: cur, captured: allCaptured, enteredHome: anyEnteredHome, finished: anyFinished };
};

// Turn order: red → blue → green → yellow → red.
export const nextTurn = (current) => {
  const order = ['red', 'blue', 'green', 'yellow'];
  const i = order.indexOf(current);
  return order[(i + 1) % 4];
};
