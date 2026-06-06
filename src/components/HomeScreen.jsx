import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js';
import { generateRoomCode, isValidCode, normalizeCode } from '../utils/codes.js';
import { getName, setName, getSessionToken } from '../utils/session.js';
import { preloadSounds } from '../lib/sounds.js';

export default function HomeScreen() {
  const navigate = useNavigate();
  const [name, setNameState] = useState(getName() || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dark, setDark] = useState(localStorage.getItem('ludo:dark') === '1');

  useEffect(() => {
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('ludo:dark', dark ? '1' : '0');
  }, [dark]);

  const handleCreate = async () => {
    if (!isSupabaseConfigured()) { setError('Supabase env not configured. See .env.example.'); return; }
    const cleanName = setName(name);
    if (!cleanName) { setError('Please enter a name (max 16 characters).'); return; }
    setBusy(true); setError(null);
    preloadSounds();
    // Try a few codes in case of collision
    let createdRoom = null;
    for (let i = 0; i < 5; i++) {
      const candidate = generateRoomCode();
      const { data, error: e } = await supabase
        .from('rooms')
        .insert({ code: candidate, host_name: cleanName, status: 'waiting', settings: { turn_timer: 30, num_players: 4 } })
        .select()
        .single();
      if (!e && data) { createdRoom = data; break; }
      if (e && !String(e.message).includes('duplicate')) { setError(e.message); break; }
    }
    if (!createdRoom) { setBusy(false); setError(error || 'Could not create room.'); return; }
    navigate(`/lobby/${createdRoom.code}`, { state: { roomId: createdRoom.id } });
  };

  const handleJoin = async () => {
    if (!isSupabaseConfigured()) { setError('Supabase env not configured. See .env.example.'); return; }
    const cleanName = setName(name);
    if (!cleanName) { setError('Please enter a name (max 16 characters).'); return; }
    const cleanCode = normalizeCode(code);
    if (!isValidCode(cleanCode)) { setError('Room code must be 6 letters/numbers.'); return; }
    setBusy(true); setError(null);
    preloadSounds();
    const { data: room, error: e } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle();
    if (e) { setError(e.message); setBusy(false); return; }
    if (!room) { setError('No room with that code.'); setBusy(false); return; }
    navigate(`/lobby/${room.code}`, { state: { roomId: room.id } });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 bg-gradient-to-b from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-ludo-red via-ludo-yellow to-ludo-green shadow-lg" />
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Ludo Royal</h1>
          </div>
          <button
            onClick={() => setDark((d) => !d)}
            className="btn-secondary !py-2 !px-3 text-sm"
            aria-label="Toggle dark mode"
          >
            {dark ? '☀' : '🌙'}
          </button>
        </div>

        <div className="card p-6 animate-fade-in">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Play with friends</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">No accounts. Just pick a name and play.</p>

          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Your name</label>
          <input
            className="input mb-5"
            placeholder="e.g. Alex"
            maxLength={16}
            value={name}
            onChange={(e) => setNameState(e.target.value)}
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button onClick={handleCreate} disabled={busy} className="btn-primary">
              Create Room
            </button>
            <button onClick={handleJoin} disabled={busy} className="btn-secondary">
              Join Room
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Room code</label>
            <input
              className="input font-mono text-center tracking-[0.4em] uppercase"
              placeholder="ABC123"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
            />
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">v1 · Realtime multiplayer · Voice chat</p>
      </div>
    </div>
  );
}
