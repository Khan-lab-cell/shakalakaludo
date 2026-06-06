// CPU bot move selection. Prioritizes: capture > advance furthest > bring out > safe square.
// All bots think for the same color (passed in by the caller), choosing among the
// valid options returned by getValidOptions.

import { COLORS, PATH_LENGTH, HOME_ENTRY, HOME_PATH, HOME_COLUMN_LENGTH, START } from './boardPaths.js';
import { applyMoves, getValidOptions, rollDice } from './gameLogic.js';

const pieceProgress = (piece, color) => {
  if (piece === 'home') return -1;
  if (piece === 'finished') return PATH_LENGTH + HOME_COLUMN_LENGTH + 1;
  if (piece.type === 'main') {
    const entry = HOME_ENTRY[color];
    const i = piece.index;
    if (i <= entry) return i;
    return i - PATH_LENGTH; // past entry
  }
  if (piece.type === 'homePath') return PATH_LENGTH + piece.index;
  return 0;
};

// Pick the best single-piece move from a list of {slot, steps} candidates.
const pickBestSingle = (board, color, candidates, dice) => {
  // Score each candidate; higher = better.
  let best = null;
  for (const cand of candidates) {
    let score = 0;
    const before = board[color][cand.slot];
    // Simulate the move
    const { board: after } = applyMoves(board, color, [{ slot: cand.slot, steps: cand.steps }]);
    if (after === board) continue; // invalid

    // 1) Capture: +100
    const beforeCounts = countColorsOnMain(after, color, before);
    // (The applyMoves already returns captured list; recompute via diff is heavier — approximate)
    score += captureScore(board, after, color, cand.slot, cand.steps);

    // 2) Reaching home / final
    if (after[color][cand.slot] === 'finished') score += 80;
    if (after[color][cand.slot]?.type === 'homePath' && before?.type === 'main') score += 40;

    // 3) Advance furthest
    const beforeProgress = pieceProgress(before, color);
    const afterProgress = pieceProgress(after[color][cand.slot], color);
    score += afterProgress * 2;

    // 4) Land on safe square
    if (after[color][cand.slot]?.type === 'main' && isSafeMain(after[color][cand.slot].index)) {
      score += 15;
    }

    // 5) Avoid being vulnerable (not a strong signal but small)
    score -= vulnerabilityPenalty(after, color, cand.slot);

    if (!best || score > best.score) best = { ...cand, score };
  }
  return best;
};

const isSafeMain = (i) => {
  // Mirror of SAFE_SQUARES from boardPaths (avoid circular import; list is short).
  const starts = [0, 13, 27, 40];
  const stars = [43, 4, 18, 31];
  return starts.includes(i) || stars.includes(i);
};

const captureScore = (before, after, color, slot, steps) => {
  // Did any opponent piece go from on-board to home?
  for (const c of COLORS) {
    if (c === color) continue;
    for (let i = 0; i < 4; i++) {
      const b = before[c][i];
      const a = after[c][i];
      const wasOnBoard = b && b !== 'home' && b !== 'finished';
      const isNowHome = a === 'home';
      if (wasOnBoard && isNowHome) return 100;
    }
  }
  return 0;
};

const vulnerabilityPenalty = (board, color, slot) => {
  // If our piece is now on a main-path cell that is NOT safe and there is an opponent
  // within 6 steps behind, penalize lightly.
  const p = board[color][slot];
  if (!p || p.type !== 'main') return 0;
  if (isSafeMain(p.index)) return 0;
  let penalty = 0;
  for (const c of COLORS) {
    if (c === color) continue;
    for (let i = 0; i < 4; i++) {
      const op = board[c][i];
      if (!op || op.type !== 'main') continue;
      const dist = (p.index - op.index + PATH_LENGTH) % PATH_LENGTH;
      if (dist > 0 && dist <= 6) penalty += 3;
    }
  }
  return penalty;
};

const countColorsOnMain = (board, color, piece) => 0; // placeholder, unused

// Pick the best split option.
const pickBestSplit = (board, color, candidates) => {
  let best = null;
  for (const cand of candidates) {
    const { board: after, invalid } = applyMoves(board, color, [
      { slot: cand.slots[0], steps: cand.steps[0] },
      { slot: cand.slots[1], steps: cand.steps[1] },
    ]);
    if (invalid) continue;
    let score = 0;
    score += captureScore(board, after, color);
    // Prefer splits that bring a piece out (using 6) AND advance another piece.
    if (board[color][cand.slots[0]] === 'home') score += 30;
    // Advance total
    for (const s of cand.slots) {
      score += Math.max(0, pieceProgress(after[color][s], color)) * 2;
    }
    if (!best || score > best.score) best = { ...cand, score };
  }
  return best;
};

// Main entry: chooseOption(board, color, dice, stats) -> { moves: [{slot,steps}], label }
export const chooseOption = (board, color, dice) => {
  const opts = getValidOptions(board, color, dice);
  if (opts.skipTurn) return { moves: [], label: 'skip' };
  if (!dice) return { moves: [], label: 'wait' };

  const allOpts = [
    { type: 'A', moves: opts.A, weight: 1.0 },
    { type: 'B', moves: opts.B, weight: 1.2 }, // split is usually good
    { type: 'C', moves: opts.C, weight: 0.9 },
    { type: 'D', moves: opts.D, weight: 0.9 },
  ];

  // If no other move is possible, use bring-out (with a 6) as a fallback.
  const anyStandardMoves = allOpts.some((o) => o.moves.length > 0);
  if (!anyStandardMoves && opts.bringOut.length > 0) {
    return { moves: [{ slot: opts.bringOut[0].slot, steps: 0 }], label: 'bringOut' };
  }

  // Score each option
  const scored = [];
  for (const o of allOpts) {
    if (!o.moves.length) continue;
    const pick = o.type === 'B'
      ? pickBestSplit(board, color, o.moves)
      : pickBestSingle(board, color, o.moves, dice);
    if (!pick) continue;
    scored.push({ type: o.type, pick, weight: o.weight });
  }

  if (!scored.length) {
    // Last resort: bring out.
    if (opts.bringOut.length > 0) {
      return { moves: [{ slot: opts.bringOut[0].slot, steps: 0 }], label: 'bringOut' };
    }
    return { moves: [], label: 'noop' };
  }

  // Pick the highest-scoring, with a small random factor.
  scored.sort((a, b) => (b.pick.score * b.weight + Math.random() * 5) - (a.pick.score * a.weight + Math.random() * 5));
  const chosen = scored[0];

  if (chosen.type === 'B') {
    return {
      moves: [
        { slot: chosen.pick.slots[0], steps: chosen.pick.steps[0] },
        { slot: chosen.pick.slots[1], steps: chosen.pick.steps[1] },
      ],
      label: 'B',
    };
  }
  return {
    moves: [{ slot: chosen.pick.slot, steps: chosen.pick.steps }],
    label: chosen.type,
  };
};

// Convenience: a complete bot turn.
export const botTakeTurn = (board, color) => {
  const dice = rollDice();
  const choice = chooseOption(board, color, dice);
  return { dice, choice };
};
