import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useRoom, usePlayers, useHeartbeat, useFindMe } from '../hooks/useSupabase.js';
import { getPlayerId, clearPlayer, setPlayerId } from '../utils/session.js';
import { SEAT_COLORS } from '../game/boardPaths.js';
import { DISCONNECT_THRESHOLD_MS, TURN_TIMER_OPTIONS } from '../constants.js';

const COLOR_CLASS = {
  red: 'bg-ludo-red',
  blue: 'bg-ludo-blue',
  green: 'bg-ludo-green',
  yellow: 'bg-ludo-yellow',
};
const COLOR_BORDER = {
  red: 'border-ludo-red',
  blue: 'border-ludo-blue',
  green: 'border-ludo-green',
  yellow: 'border-ludo-yellow',
};

export default function Lobby() {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const playerId = location.state?.playerId || getPlayerId();

  const { room, loading: roomLoading } = useRoom(code);
  const [players] = usePlayers(room?.id);
  const { me: meDirect, loaded: meLoaded } = useFindMe(playerId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [you, setYou] = useState(null);
  const [rejoinBusy, setRejoinBusy] = useState(false);

  // Keep our own last_seen fresh so we don't show as "Disconnected" to
  // ourselves while sitting in the lobby.
  useHeartbeat(playerId);

  // Merge the two sources of truth: prefer the direct query (most reliable),
  // fall back to scanning the room-wide players list.
  useEffect(() => {
    if (meDirect) { setYou(meDirect); return; }
    if (!playerId) return;
    const me = players.find((p) => p.id === playerId);
    if (me) setYou(me);
  }, [meDirect, players, playerId]);

  const isStale = (p) => {
    if (!p) return false;
    if (p.is_bot) return false;
    if (p.disconnected) return true;
    if (!p.last_seen) return false;
    return (Date.now() - new Date(p.last_seen).getTime()) > DISCONNECT_THRESHOLD_MS;
  };

  // Auto-navigate to game when host starts it.
  useEffect(() => {
    if (room?.status === 'playing') {
      navigate(`/game/${room.code}`, { state: { roomId: room.id, playerId } });
    }
  }, [room?.status, room?.code, room?.id, playerId, navigate]);

  const goHome = async () => {
    if (you?.id) {
      try { await supabase.from('players').delete().eq('id', you.id); } catch (e) { console.error('goHome delete player', e); }
    }
    clearPlayer();
    navigate('/');
  };

  const handleRejoin = async () => {
    if (!room) return;
    setRejoinBusy(true);
    setError(null);
    const takenSeats = new Set(players.map((p) => p.seat));
    let seat = 1;
    while (takenSeats.has(seat)) seat += 1;
    if (seat > 4) { setError('Room is full.'); setRejoinBusy(false); return; }
    const name = you?.name || 'Player';
    const { data: row, error: e } = await supabase
      .from('players')
      .insert({
        room_id: room.id,
        name,
        color: SEAT_COLORS[seat - 1],
        seat,
        is_host: false,
        is_bot: false,
        session_token: `rejoin-${playerId}-${Date.now()}`,
      })
      .select()
      .single();
    if (e) { setError(e.message); setRejoinBusy(false); return; }
    setPlayerId(row.id);
    navigate(`/lobby/${room.code}`, { state: { roomId: room.id, playerId: row.id } });
    setRejoinBusy(false);
  };

  const handleStart = async () => {
    if (!room || !you?.is_host) return;
    if (players.length < 2) { setError('Need at least 2 players.'); return; }
    setBusy(true);
    setError(null);

    const { error: gsError } = await supabase
      .from('game_state')
      .upsert(
        {
          room_id: room.id,
          board: {
            red: ['home','home','home','home'],
            blue: ['home','home','home','home'],
            green: ['home','home','home','home'],
            yellow: ['home','home','home','home'],
          },
          current_turn: SEAT_COLORS[0],
          dice_result: null,
          move_phase: 'roll',
          turn_started: new Date().toISOString(),
          winner: null,
        },
        { onConflict: 'room_id' }
      );
    if (gsError) { setError(gsError.message); setBusy(false); return; }

    const { error: re } = await supabase
      .from('rooms')
      .update({ status: 'playing' })
      .eq('id', room.id);
    if (re) { setError(re.message); setBusy(false); return; }

    navigate(`/game/${room.code}`, { state: { roomId: room.id, playerId } });
  };

  const handleAddBot = async () => {
    if (!room || !you?.is_host) return;
    if (players.length >= 4) return;
    setBusy(true);
    const taken = new Set(players.map((p) => p.seat));
    let seat = 1;
    while (taken.has(seat)) seat += 1;
    if (seat > 4) { setBusy(false); return; }
    const usedColor = SEAT_COLORS[seat - 1];
    const { error } = await supabase.from('players').insert({
      room_id: room.id,
      name: `Bot ${seat}`,
      color: usedColor,
      seat,
      is_host: false,
      is_bot: true,
      session_token: `bot-${room.id}-${seat}-${Date.now()}`,
    });
    if (error) console.error('handleAddBot', error);
    setBusy(false);
  };

  const handleKick = async (playerIdToKick) => {
    if (!you?.is_host) return;
    const { error } = await supabase.from('players').delete().eq('id', playerIdToKick);
    if (error) console.error('handleKick', error);
  };

  const updateSetting = async (patch) => {
    if (!room || !you?.is_host) return;
    const next = { ...(room.settings || {}), ...patch };
    const { error } = await supabase.from('rooms').update({ settings: next }).eq('id', room.id);
    if (error) console.error('updateSetting', error);
  };

  if (roomLoading || (playerId && !meLoaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">Loading lobby…</div>
    );
  }
  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-5">
        <p className="text-slate-700 dark:text-slate-200 mb-4">Room not found.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Back to home</button>
      </div>
    );
  }

  // No playerId at all — user landed here without going through HomeScreen
  if (!playerId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-5">
        <p className="text-slate-700 dark:text-slate-200 mb-2 font-semibold">No player session found.</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Go back to home and create or join a room.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Back to home</button>
      </div>
    );
  }

  // playerId is set, but the row doesn't exist in the DB.
  // Offer a Rejoin button so the user can self-heal.
  if (!you) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-5">
        <p className="text-slate-700 dark:text-slate-200 mb-2 font-semibold">You are not in this room.</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          The host may have removed you, or the previous game ended.
        </p>
        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleRejoin}
            disabled={rejoinBusy || players.length >= 4}
            className="btn-primary"
          >
            {rejoinBusy ? 'Rejoining…' : 'Rejoin room'}
          </button>
          <button onClick={goHome} className="btn-secondary">Back to home</button>
        </div>
      </div>
    );
  }

  const slots = [1, 2, 3, 4].map((seat) => {
    const p = players.find((x) => x.seat === seat);
    return { seat, color: SEAT_COLORS[seat - 1], player: p };
  });

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={goHome} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">← Leave</button>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-500">Code</span>
          <button
            onClick={() => navigator.clipboard?.writeText(room.code)}
            className="font-mono text-lg font-bold tracking-widest text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg"
            title="Tap to copy"
          >
            {room.code}
          </button>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Lobby</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {you.is_host
            ? `Share the code with friends. When everyone is in, hit Start Game.`
            : `Waiting for the host (${players.find((p) => p.is_host)?.name || '—'}) to start the game…`}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {slots.map(({ seat, color, player }) => (
            <div
              key={seat}
              className={`relative rounded-xl border-2 ${player ? COLOR_BORDER[color] : 'border-dashed border-slate-300 dark:border-slate-700'} bg-white dark:bg-slate-800/40 p-3 min-h-[88px]`}
            >
              <div className="flex items-start justify-between">
                <div className={`w-8 h-8 rounded-full ${COLOR_CLASS[color]} shadow-md`} />
                {player?.is_host && <span className="text-[10px] uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">Host</span>}
                {player?.is_bot && <span className="text-[10px] uppercase tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-full font-bold">Bot</span>}
              </div>
              {player ? (
                <>
                  <div className="mt-2 font-semibold text-slate-900 dark:text-white text-sm truncate">
                    {player.name}{player.id === you.id && <span className="text-xs text-slate-400 ml-1">(you)</span>}
                  </div>
                  <div className="text-xs text-slate-500">{color}</div>
                  {isStale(player) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-900/70 rounded-xl">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Disconnected</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-2 text-sm text-slate-400">Empty · {color}</div>
              )}
              {you?.is_host && player && player.id !== you.id && isStale(player) && (
                <button onClick={() => handleKick(player.id)} className="absolute bottom-2 right-2 text-[10px] bg-red-600 text-white px-2 py-1 rounded-md font-bold">Kick</button>
              )}
            </div>
          ))}
        </div>

        {error && <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>}
      </div>

      {you?.is_host && (
        <div className="card p-5 mb-4 space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white">Settings</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-300 w-32">Turn timer</span>
            <div className="flex gap-2">
              {TURN_TIMER_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => updateSetting({ turn_timer: s })}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 ${(room.settings?.turn_timer || 30) === s ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-slate-600 dark:text-slate-300 w-32">Add bot</span>
            <button
              onClick={handleAddBot}
              disabled={busy || players.length >= 4}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 disabled:opacity-50"
            >
              + Add bot
            </button>
            <span className="text-xs text-slate-500">Fills the next empty seat.</span>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-gradient-to-t from-slate-50 via-slate-50 dark:from-slate-950 dark:via-slate-950">
        {you?.is_host ? (
          <button
            onClick={handleStart}
            disabled={busy || players.length < 2}
            className="btn-primary w-full"
          >
            {busy
              ? 'Starting…'
              : players.length < 2
                ? 'Need at least 2 players'
                : `Start Game (${players.length} players)`}
          </button>
        ) : (
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            Waiting for host to start… <span className="inline-block animate-bounce-slow">⏳</span>
          </div>
        )}
      </div>
    </div>
  );
}
