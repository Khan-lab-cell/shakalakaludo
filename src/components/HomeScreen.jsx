import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js';
import { generateRoomCode, isValidCode, normalizeCode } from '../utils/codes.js';
import { getName, setName, rotateSessionToken, setPlayerId } from '../utils/session.js';
import { preloadSounds } from '../lib/sounds.js';
import { SEAT_COLORS } from '../game/boardPaths.js';

export default function HomeScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('create'); // 'create' | 'join'
  const [name, setNameState] = useState(getName() || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [dark, setDark] = useState(localStorage.getItem('ludo:dark') === '1');

  useEffect(() => {
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('ludo:dark', dark ? '1' : '0');
  }, [dark]);

  const findFirstOpenSeat = (taken) => {
    for (let s = 1; s <= 4; s++) if (!taken.has(s)) return s;
    return null;
  };

  const handleCreate = async () => {
    setError(null);
    if (!isSupabaseConfigured()) { setError('Supabase env not configured. See .env.example.'); return; }
    const cleanName = setName(name);
    if (!cleanName) { setError('Please enter a name (max 16 characters).'); return; }
    setBusy(true);
    setStatus('Creating room…');
    preloadSounds();

    // Always use a fresh session token so re-creating a room in the same
    // tab never collides with the previous players row.
    const freshToken = rotateSessionToken();

    // 1) Create the room, retrying on code collisions
    let room = null;
    for (let i = 0; i < 8; i++) {
      setStatus(`Creating room… (try ${i + 1})`);
      const candidate = generateRoomCode();
      const { data, error: e } = await supabase
        .from('rooms')
        .insert({
          code: candidate,
          host_name: cleanName,
          status: 'waiting',
          settings: { turn_timer: 30, num_players: 4 },
        })
        .select()
        .single();
      if (!e && data) { room = data; break; }
      if (e && !String(e.message).toLowerCase().includes('duplicate')) {
        setError(`Could not create room: ${e.message}`);
        setBusy(false);
        setStatus(null);
        return;
      }
    }
    if (!room) {
      setError('Could not create room (code collisions). Please try again.');
      setBusy(false);
      setStatus(null);
      return;
    }

    // 2) Insert the host's player row with a fresh token
    setStatus('Adding you to the room…');
    const { data: me, error: pe } = await supabase
      .from('players')
      .insert({
        room_id: room.id,
        name: cleanName,
        color: SEAT_COLORS[0],
        seat: 1,
        is_host: true,
        is_bot: false,
        session_token: freshToken,
      })
      .select()
      .single();
    if (pe) {
      setError(`Room created, but adding you failed: ${pe.message}`);
      setBusy(false);
      setStatus(null);
      return;
    }
    setPlayerId(me.id);
    setBusy(false);
    setStatus(null);
    navigate(`/lobby/${room.code}`, { state: { roomId: room.id, playerId: me.id } });
  };

  const handleJoin = async () => {
    setError(null);
    if (!isSupabaseConfigured()) { setError('Supabase env not configured. See .env.example.'); return; }
    const cleanName = setName(name);
    if (!cleanName) { setError('Please enter a name (max 16 characters).'); return; }
    const cleanCode = normalizeCode(code);
    if (!isValidCode(cleanCode)) { setError('Room code must be 6 letters or numbers.'); return; }
    setBusy(true);
    setStatus('Looking up room…');
    preloadSounds();

    // 1) Find the room
    const { data: room, error: re } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle();
    if (re) { setError(re.message); setBusy(false); setStatus(null); return; }
    if (!room) { setError('No room with that code.'); setBusy(false); setStatus(null); return; }
    if (room.status === 'finished') { setError('That game has already ended.'); setBusy(false); setStatus(null); return; }

    // 2) Load existing players so we can pick an open seat
    setStatus('Joining room…');
    const { data: existing, error: le } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id);
    if (le) { setError(le.message); setBusy(false); setStatus(null); return; }

    const takenSeats = new Set((existing || []).map((p) => p.seat));
    const seat = findFirstOpenSeat(takenSeats);
    if (seat == null) { setError('Room is full.'); setBusy(false); setStatus(null); return; }

    // 3) Always use a fresh token
    const freshToken = rotateSessionToken();

    const { data: me, error: pe } = await supabase
      .from('players')
      .insert({
        room_id: room.id,
        name: cleanName,
        color: SEAT_COLORS[seat - 1],
        seat,
        is_host: false,
        is_bot: false,
        session_token: freshToken,
      })
      .select()
      .single();
    if (pe) {
      setError(`Could not join: ${pe.message}`);
      setBusy(false);
      setStatus(null);
      return;
    }
    setPlayerId(me.id);
    setBusy(false);
    setStatus(null);
    navigate(`/lobby/${room.code}`, { state: { roomId: room.id, playerId: me.id } });
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
            disabled={busy}
          />

          <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-lg">
            <button
              onClick={() => { setTab('create'); setError(null); }}
              disabled={busy}
              className={`py-2 rounded-md text-sm font-bold transition ${tab === 'create' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Create Room
            </button>
            <button
              onClick={() => { setTab('join'); setError(null); }}
              disabled={busy}
              className={`py-2 rounded-md text-sm font-bold transition ${tab === 'join' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Join Room
            </button>
          </div>

          {tab === 'create' ? (
            <div className="mb-2 text-sm text-slate-600 dark:text-slate-300">
              <p>You'll get a <span className="font-mono font-bold">6-character code</span> to share with friends.</p>
            </div>
          ) : (
            <div className="mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Room code from your friend</label>
              <input
                className="input font-mono text-center tracking-[0.4em] uppercase"
                placeholder="ABC123"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(normalizeCode(e.target.value))}
                disabled={busy}
              />
            </div>
          )}

          {status && (
            <div className="mt-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              {status}
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={tab === 'create' ? handleCreate : handleJoin}
            disabled={busy}
            className="btn-primary w-full mt-5"
          >
            {busy ? (tab === 'create' ? 'Creating…' : 'Joining…') : (tab === 'create' ? 'Create Room' : 'Join Room')}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">v1 · Realtime multiplayer · Voice chat</p>
      </div>
    </div>
  );
}
