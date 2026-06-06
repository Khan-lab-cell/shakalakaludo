import { useMemo } from 'react';
import clsx from 'clsx';
import { getValidOptions } from '../game/gameLogic.js';

const COLOR_BG = {
  red: 'bg-ludo-red', blue: 'bg-ludo-blue', green: 'bg-ludo-green', yellow: 'bg-ludo-yellow',
};

const COLOR_RING = {
  red: 'ring-ludo-red', blue: 'ring-ludo-blue', green: 'ring-ludo-green', yellow: 'ring-ludo-yellow',
};

function OptionCard({ label, title, body, enabled, selected, onClick, diceColor, canPickPieces, pickedSlots, onPickPiece }) {
  return (
    <div
      className={clsx(
        'rounded-xl border-2 p-3 transition-all',
        enabled ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800' : 'border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 opacity-60',
        selected && 'ring-2 ring-indigo-500 border-indigo-500',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-sm', enabled ? 'bg-indigo-600' : 'bg-slate-400')}>
          {label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-900 dark:text-white text-sm">{title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{body}</div>
        </div>
      </div>

      {enabled && (
        <div className="mt-2">
          {selected ? (
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from({ length: canPickPieces }).map((_, i) => (
                <PiecePicker key={i} index={i} slots={pickedSlots} onPick={(s) => onPickPiece(i, s)} />
              ))}
            </div>
          ) : (
            <button
              onClick={onClick}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Choose this option →
            </button>
          )}
        </div>
      )}

      {!enabled && (
        <div className="mt-1 text-[10px] text-slate-400 italic">no valid moves</div>
      )}
    </div>
  );
}

function PiecePicker({ index, slots, onPick }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase text-slate-500">{index === 0 ? 'A' : 'B'}</span>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className={clsx(
              'w-7 h-7 rounded-full border-2 text-[10px] font-bold flex items-center justify-center transition-all',
              slots[index] === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600',
            )}
          >
            {s + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MoveSelector({ board, color, dice, pendingOption, setPendingOption, pickedSlots, setPickedSlots, onConfirm }) {
  const opts = useMemo(() => (board && color && dice ? getValidOptions(board, color, dice) : { A: [], B: [], C: [], D: [], bringOut: [], skipTurn: false }), [board, color, dice]);

  if (!dice) return null;

  if (opts.skipTurn) {
    return (
      <div className="p-4 text-center text-sm text-slate-600 dark:text-slate-300">
        No moves available — turn skipped.
      </div>
    );
  }

  const select = (key) => {
    setPendingOption(key);
    setPickedSlots([null, null]);
  };

  const handlePick = (which, slot) => {
    const next = [...pickedSlots];
    next[which] = slot;
    setPickedSlots(next);
  };

  const canConfirm = () => {
    if (!pendingOption) return false;
    if (pendingOption === 'bringOut') return pickedSlots[0] != null;
    if (pendingOption === 'A' || pendingOption === 'C' || pendingOption === 'D') return pickedSlots[0] != null;
    if (pendingOption === 'B') return pickedSlots[0] != null && pickedSlots[1] != null && pickedSlots[0] !== pickedSlots[1];
    return false;
  };

  const handleConfirm = () => {
    if (!canConfirm()) return;
    if (pendingOption === 'bringOut') {
      onConfirm([{ slot: pickedSlots[0], steps: 0 }]);
      return;
    }
    if (pendingOption === 'A' || pendingOption === 'C' || pendingOption === 'D') {
      const step = pendingOption === 'A' ? dice.die1 + dice.die2 : (pendingOption === 'C' ? dice.die1 : dice.die2);
      onConfirm([{ slot: pickedSlots[0], steps: step }]);
    } else if (pendingOption === 'B') {
      onConfirm([
        { slot: pickedSlots[0], steps: dice.die1 },
        { slot: pickedSlots[1], steps: dice.die2 },
      ]);
    }
  };

  return (
    <div className="p-3 space-y-2">
      <div className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 px-1">Choose a move</div>

      {opts.bringOut.length > 0 && (
        <OptionCard
          label="⬆" title="Bring out (using 6)" body="Move one piece from home to the start square. Other die forfeited."
          enabled={true} selected={pendingOption === 'bringOut'} onClick={() => select('bringOut')}
          canPickPieces={1} pickedSlots={pickedSlots} onPickPiece={handlePick}
        />
      )}

      <OptionCard
        label="A" title={`Sum (${dice.die1}+${dice.die2}=${dice.die1+dice.die2})`} body="Move one piece by the combined total."
        enabled={opts.A.length > 0} selected={pendingOption === 'A'} onClick={() => select('A')}
        canPickPieces={1} pickedSlots={pickedSlots} onPickPiece={handlePick}
      />
      <OptionCard
        label="B" title={`Split (${dice.die1} & ${dice.die2})`} body="Move two pieces, one by each die. Or bring one out (6) and move another by the other die."
        enabled={opts.B.length > 0} selected={pendingOption === 'B'} onClick={() => select('B')}
        canPickPieces={2} pickedSlots={pickedSlots} onPickPiece={handlePick}
      />
      <OptionCard
        label="C" title={`Die 1 (${dice.die1})`} body="Move one piece by die 1 only."
        enabled={opts.C.length > 0} selected={pendingOption === 'C'} onClick={() => select('C')}
        canPickPieces={1} pickedSlots={pickedSlots} onPickPiece={handlePick}
      />
      <OptionCard
        label="D" title={`Die 2 (${dice.die2})`} body="Move one piece by die 2 only."
        enabled={opts.D.length > 0} selected={pendingOption === 'D'} onClick={() => select('D')}
        canPickPieces={1} pickedSlots={pickedSlots} onPickPiece={handlePick}
      />

      {pendingOption && (
        <button
          onClick={handleConfirm}
          disabled={!canConfirm()}
          className="btn-primary w-full mt-2"
        >
          Confirm move
        </button>
      )}
    </div>
  );
}
