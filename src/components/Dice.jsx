import { useEffect, useState, memo } from 'react';
import clsx from 'clsx';

const FACE_DOTS = {
  1: [{ x: 1, y: 1 }],
  2: [{ x: 0, y: 0 }, { x: 2, y: 2 }],
  3: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }],
  4: [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 0 }, { x: 2, y: 2 }],
  5: [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 2, y: 2 }],
  6: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
};

function Die({ value, rolling }) {
  return (
    <div className="perspective-600 w-16 h-16 sm:w-20 sm:h-20">
      <div className={clsx('preserve-3d w-full h-full transition-transform duration-700', rolling && 'animate-roll')}>
        <div className="dice-face absolute inset-0">
          {FACE_DOTS[value].map((d, i) => (
            <span key={i} className="dice-dot" style={{ gridColumn: d.x + 1, gridRow: d.y + 1 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Dice({ value, rolling, isMyTurn, onRoll, disabled, currentTurnName }) {
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (value) {
      setShowResult(true);
    } else {
      setShowResult(false);
    }
  }, [value]);

  const v1 = showResult && value ? value.die1 : 1;
  const v2 = showResult && value ? value.die2 : 1;

  return (
    <div className="flex flex-col items-center gap-3 p-4">
      {value && (
        <div className="flex gap-3">
          <Die value={v1} rolling={rolling} />
          <Die value={v2} rolling={rolling} />
        </div>
      )}
      {!value && (
        <div className="flex gap-3">
          <Die value={1} rolling={false} />
          <Die value={1} rolling={false} />
        </div>
      )}
      {isMyTurn ? (
        <button
          onClick={onRoll}
          disabled={disabled}
          className="btn-primary !py-3 !px-6"
        >
          {rolling ? 'Rolling…' : (value ? 'Re-roll (bonus)' : 'Roll Dice')}
        </button>
      ) : (
        <div className="text-sm text-slate-500 dark:text-slate-400 text-center">
          Waiting for <span className="font-semibold text-slate-700 dark:text-slate-200">{currentTurnName || '…'}</span>
          <span className="inline-block ml-1 animate-bounce-slow">⏳</span>
        </div>
      )}
    </div>
  );
}

export default memo(Dice);
