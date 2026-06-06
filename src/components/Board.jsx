// Ludo board: 15x15 grid. Home bases, main path, home columns, and the center
// are all rendered as cells. Pieces are absolutely positioned over the grid
// using percentage-based top/left so they animate smoothly when gridPosition
// changes (CSS transitions on `top`/`left`).

import { useMemo, useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  BOARD_SIZE, PATH, HOME_PATH, HOME_BASE, HOME_SLOTS, FINAL_HOME, SAFE_SQUARES, START, COLORS, SEAT_COLORS,
} from '../game/boardPaths.js';
import { pieceCoord } from '../game/gameLogic.js';
import { Piece } from './Piece.jsx';

const COLOR_HEX = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
};
const COLOR_LIGHT = {
  red: '#fecaca', blue: '#bfdbfe', green: '#bbf7d0', yellow: '#fef08a',
};
const COLOR_DARK = {
  red: '#7f1d1d', blue: '#1e3a8a', green: '#14532d', yellow: '#713f12',
};

const isHomeBaseCell = (r, c) => {
  for (const color of COLORS) {
    const { rows, cols } = HOME_BASE[color];
    if (r >= rows[0] && r <= rows[1] && c >= cols[0] && c <= cols[1]) return color;
  }
  return null;
};

const isHomeColumnCell = (r, c) => {
  // Home column cells: row 7 for red/yellow (cols 0-4 and 10-14), col 7 for blue/green (rows 0-4 and 10-14)
  if (r === 7 && (c >= 0 && c <= 4)) return 'red';
  if (r === 7 && (c >= 10 && c <= 14)) return 'yellow';
  if (c === 7 && (r >= 0 && r <= 4)) return 'blue';
  if (c === 7 && (r >= 10 && r <= 14)) return 'green';
  return null;
};

const isMainPathCell = (r, c) => PATH.some((p) => p.r === r && p.c === c);
const mainPathIndex = (r, c) => PATH.findIndex((p) => p.r === r && p.c === c);

// Build a lookup: (r,c) -> { type: 'main'|'homePath'|'base'|'center', color, index? }
function buildCellMap() {
  const m = {};
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const base = isHomeBaseCell(r, c);
      if (base) { m[`${r},${c}`] = { type: 'base', color: base }; continue; }
      const col = isHomeColumnCell(r, c);
      if (col) {
        const idx = HOME_PATH[col].findIndex((p) => p.r === r && p.c === c);
        m[`${r},${c}`] = { type: 'homePath', color: col, index: idx };
        continue;
      }
      const idx = mainPathIndex(r, c);
      if (idx >= 0) {
        m[`${r},${c}`] = { type: 'main', index: idx };
        continue;
      }
      // Center 3x3 (rows 6-8, cols 6-8) — but we already covered most of these.
      // The four "final home" cells around the center.
      if (r === 7 && c === 5) m[`${r},${c}`] = { type: 'final', color: 'red' };
      else if (r === 5 && c === 7) m[`${r},${c}`] = { type: 'final', color: 'blue' };
      else if (r === 7 && c === 9) m[`${r},${c}`] = { type: 'final', color: 'yellow' };
      else if (r === 9 && c === 7) m[`${r},${c}`] = { type: 'final', color: 'green' };
      else if (r === 7 && c === 7) m[`${r},${c}`] = { type: 'center' };
    }
  }
  return m;
}

export default function Board({ board, players, you, selectedPiece, onPieceClick, validDestinations = [] }) {
  const cellMap = useMemo(buildCellMap, []);
  const [pulseKey, setPulseKey] = useState(0);

  // Build a list of pieces grouped by their current grid cell for stacking.
  const piecesAt = useMemo(() => {
    const map = new Map();
    if (!board) return map;
    for (const color of COLORS) {
      board[color].forEach((p, slot) => {
        const coord = pieceCoord(p, color, slot);
        if (!coord) return;
        const key = `${coord.r},${coord.c}`;
        if (!map.has(key)) map.set(key, []);
        const owner = players.find((pl) => pl.color === color);
        map.get(key).push({ color, slot, count: 1, ownerName: owner?.name || color });
      });
    }
    // Compute stacking count
    for (const arr of map.values()) arr.forEach((p) => { p.count = arr.length; });
    return map;
  }, [board, players]);

  // Rerender animation on board change
  useEffect(() => { setPulseKey((k) => k + 1); }, [board]);

  const cellPct = 100 / BOARD_SIZE;

  return (
    <div className="relative w-full mx-auto" style={{ maxWidth: 'min(96vw, 720px)' }}>
      <div
        className="relative w-full bg-slate-100 dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden"
        style={{ paddingTop: '100%' }}
      >
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`, gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)` }}>
          {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, i) => {
            const r = Math.floor(i / BOARD_SIZE);
            const c = i % BOARD_SIZE;
            const info = cellMap[`${r},${c}`];
            return (
              <div
                key={`${r},${c}`}
                className={clsx(
                  'relative border border-slate-300/60 dark:border-slate-700/60',
                )}
                style={cellStyle(info, r, c)}
              >
                {/* Star for safe squares */}
                {info?.type === 'main' && SAFE_SQUARES.has(info.index) && (
                  <span className="absolute inset-0 flex items-center justify-center text-amber-500 text-[60%] pointer-events-none">★</span>
                )}
                {/* Start arrow indicator */}
                {info?.type === 'main' && Object.values(START).includes(info.index) && (
                  <span className="absolute bottom-0.5 right-0.5 text-[50%] text-slate-400 pointer-events-none">▶</span>
                )}
                {/* Home column cell number */}
                {info?.type === 'homePath' && (
                  <span className="absolute inset-0 flex items-center justify-center text-white/80 text-[60%] font-bold pointer-events-none">
                    {info.index + 1}
                  </span>
                )}
                {/* Final home label */}
                {info?.type === 'final' && (
                  <span className="absolute inset-0 flex items-center justify-center text-white font-black text-[80%] pointer-events-none">⌂</span>
                )}
                {/* Center */}
                {info?.type === 'center' && <CenterLogo />}
                {/* Valid destination highlight */}
                {validDestinations.some((d) => d.r === r && d.c === c) && (
                  <span className="absolute inset-1 rounded-md bg-green-400/50 ring-2 ring-green-500 pointer-events-none animate-pulse-slow" />
                )}
              </div>
            );
          })}
        </div>

        {/* Pieces overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from(piecesAt.entries()).map(([key, arr]) => {
            const [r, c] = key.split(',').map(Number);
            return (
              <PieceCluster
                key={`${key}:${pulseKey}`}
                r={r}
                c={c}
                cellPct={cellPct}
                pieces={arr}
                you={you}
                selectedPiece={selectedPiece}
                onPieceClick={onPieceClick}
                validDestinations={validDestinations}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function cellStyle(info, r, c) {
  if (!info) return { backgroundColor: 'transparent' };
  if (info.type === 'base') {
    return {
      background: `linear-gradient(135deg, ${COLOR_HEX[info.color]} 0%, ${COLOR_LIGHT[info.color]} 60%, ${COLOR_DARK[info.color]} 100%)`,
    };
  }
  if (info.type === 'homePath') {
    return { backgroundColor: COLOR_HEX[info.color] };
  }
  if (info.type === 'final') {
    return { backgroundColor: COLOR_HEX[info.color] };
  }
  if (info.type === 'center') {
    return {
      background: `radial-gradient(circle, #fff 0%, #fff 30%, transparent 31%), conic-gradient(${COLOR_HEX.red} 0deg 90deg, ${COLOR_HEX.blue} 90deg 180deg, ${COLOR_HEX.yellow} 180deg 270deg, ${COLOR_HEX.green} 270deg 360deg)`,
    };
  }
  return { backgroundColor: 'rgba(255,255,255,0.9)' };
}

function CenterLogo() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-3/5 h-3/5 rounded-full bg-white shadow-inner flex items-center justify-center text-[10px] font-black text-slate-700">
        ★
      </div>
    </div>
  );
}

function PieceCluster({ r, c, cellPct, pieces, you, selectedPiece, onPieceClick, validDestinations }) {
  const left = (c + 0.5) * cellPct;
  const top = (r + 0.5) * cellPct;
  const stacked = pieces.length > 1;
  const size = stacked ? 'min(28%, 18px)' : 'min(72%, 60px)';

  return (
    <div
      className="absolute flex items-center justify-center pointer-events-auto transition-all duration-300 ease-in-out"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {pieces.length === 1 ? (
        <Piece
          color={pieces[0].color}
          slot={pieces[0].slot}
          count={pieces[0].count}
          ownerName={pieces[0].ownerName}
          selected={selectedPiece && selectedPiece.color === pieces[0].color && selectedPiece.slot === pieces[0].slot}
          faded={you && you.color !== pieces[0].color}
          onClick={() => onPieceClick && onPieceClick(pieces[0].color, pieces[0].slot)}
        />
      ) : (
        <div className="relative w-full h-full">
          {pieces.map((p, i) => {
            const angle = (i / pieces.length) * 2 * Math.PI;
            const radius = stacked ? 30 : 0;
            const dx = Math.cos(angle) * radius;
            const dy = Math.sin(angle) * radius;
            return (
              <div
                key={`${p.color}-${p.slot}`}
                className="absolute"
                style={{ left: `calc(50% + ${dx}%)`, top: `calc(50% + ${dy}%)`, transform: 'translate(-50%, -50%)', width: '60%', height: '60%' }}
              >
                <Piece
                  color={p.color}
                  slot={p.slot}
                  count={p.count}
                  ownerName={p.ownerName}
                  selected={selectedPiece && selectedPiece.color === p.color && selectedPiece.slot === p.slot}
                  faded={you && you.color !== p.color}
                  onClick={() => onPieceClick && onPieceClick(p.color, p.slot)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
