import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';

const COLOR_BG = {
  red: 'bg-ludo-red', blue: 'bg-ludo-blue', green: 'bg-ludo-green', yellow: 'bg-ludo-yellow',
};
const COLOR_TEXT = {
  red: 'text-ludo-red', blue: 'text-ludo-blue', green: 'text-ludo-green', yellow: 'text-ludo-yellow',
};

export default function WinScreen({ winner, players, onClose }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!winner) return;
    const colors = winner === 'red' ? ['#ef4444','#fff','#fbbf24'] :
                   winner === 'blue' ? ['#3b82f6','#fff','#fbbf24'] :
                   winner === 'green' ? ['#22c55e','#fff','#fbbf24'] :
                   ['#eab308','#fff','#ef4444'];
    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [winner]);

  if (!winner) return null;

  const winnerPlayer = players.find((p) => p.color === winner);
  const sorted = [...players].sort((a, b) => (b.pieces_home || 0) - (a.pieces_home || 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="card max-w-md w-full p-6 text-center">
        <div className={`mx-auto w-20 h-20 rounded-full ${COLOR_BG[winner]} flex items-center justify-center text-white text-3xl font-black shadow-xl mb-4`}>
          ★
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-1">
          <span className={COLOR_TEXT[winner]}>{winnerPlayer?.name || winner.toUpperCase()}</span> wins!
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">All four pieces home. 👑</p>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-5">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Player</th>
                <th className="px-2 py-2">⚔</th>
                <th className="px-2 py-2">⌂</th>
                <th className="px-2 py-2">Turns</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 text-left">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${COLOR_BG[p.color]}`} />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{p.kills || 0}</td>
                  <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{p.pieces_home || 0}</td>
                  <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{p.turns_taken || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2">
          <button onClick={() => navigate('/')} className="btn-secondary flex-1">Home</button>
          <button onClick={onClose} className="btn-primary flex-1">Stay</button>
        </div>
      </div>
    </div>
  );
}
