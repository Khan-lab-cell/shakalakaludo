import clsx from 'clsx';

const COLOR_BG = {
  red: 'bg-ludo-red', blue: 'bg-ludo-blue', green: 'bg-ludo-green', yellow: 'bg-ludo-yellow',
};
const COLOR_RING = {
  red: 'ring-ludo-red', blue: 'ring-ludo-blue', green: 'ring-ludo-green', yellow: 'ring-ludo-yellow',
};

export default function PlayerPanel({ players, currentTurn, you, speakingIds = new Set(), turnRemainingMs, turnTimer }) {
  const all = ['red', 'blue', 'green', 'yellow'].map((color) => {
    return players.find((p) => p.color === color) || { color, name: '—', is_bot: false, kills: 0, turns_taken: 0, pieces_home: 0 };
  });

  const secs = turnRemainingMs != null ? Math.ceil(turnRemainingMs / 1000) : null;
  const pct = turnRemainingMs != null && turnTimer ? Math.max(0, Math.min(100, (turnRemainingMs / (turnTimer * 1000)) * 100)) : 0;
  const lowTime = secs !== null && secs <= 10;

  return (
    <div className="px-3 pt-2 pb-1">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
        {all.map((p) => {
          const isCurrent = p.color === currentTurn;
          const isYou = you && p.id === you.id;
          const speaking = speakingIds.has(p.id);
          return (
            <div
              key={p.color}
              className={clsx(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg flex-shrink-0 transition-all',
                isCurrent ? `bg-white dark:bg-slate-800 shadow ring-2 ${COLOR_RING[p.color]}` : 'bg-slate-100 dark:bg-slate-800/50',
              )}
            >
              <div className="relative">
                <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black', COLOR_BG[p.color])}>
                  {(p.name || '?').charAt(0).toUpperCase()}
                </div>
                {speaking && <span className="absolute inset-0 rounded-full animate-speak" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[80px]">
                  {p.name}{isYou && <span className="text-slate-400"> (you)</span>}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span title="Kills">⚔ {p.kills || 0}</span>
                  <span title="Pieces home">⌂ {p.pieces_home || 0}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Turn timer bar */}
      {turnRemainingMs != null && (
        <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={clsx('h-full transition-all duration-1000 ease-linear', lowTime ? 'bg-red-500' : 'bg-indigo-500')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
