import { memo, useState } from 'react';
import clsx from 'clsx';

const COLOR_HEX = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
};

function PieceBase({ color, slot, count, selected, onClick, ownerName, faded }) {
  const [showName, setShowName] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setShowName(true)}
      onMouseLeave={() => setShowName(false)}
      onFocus={() => setShowName(true)}
      onBlur={() => setShowName(false)}
      title={ownerName}
      className={clsx(
        'relative w-[78%] h-[78%] rounded-full border-2 border-white shadow-md flex items-center justify-center text-[10px] font-black text-white/90 transition-transform',
        'active:scale-95',
        selected && 'ring-4 ring-yellow-300 scale-110 z-10',
        faded && 'opacity-40',
      )}
      style={{ backgroundColor: COLOR_HEX[color] }}
    >
      <span className="absolute inset-1 rounded-full border border-white/30" />
      <span className="relative">{slot + 1}</span>
      {count > 1 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center border border-white">
          {count}
        </span>
      )}
      {showName && ownerName && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded-md whitespace-nowrap pointer-events-none z-20">
          {ownerName}
        </span>
      )}
    </button>
  );
}

export const Piece = memo(PieceBase);
