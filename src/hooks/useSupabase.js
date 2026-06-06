// Supabase data hooks: room + players + game state + chat.
// Each hook subscribes to realtime and returns live data.

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Fetch a single room by code. Subscribes to changes on that room.
export function useRoom(code) {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const { data, error: e } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .maybeSingle();
      if (cancelled) return;
      if (e) setError(e);
      else setRoom(data);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`room:${code}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${code.toUpperCase()}` },
        (payload) => {
          if (payload.eventType === 'DELETE') setRoom(null);
          else setRoom(payload.new);
        })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [code]);

  return { room, loading, error };
}

// All players in a room, with realtime updates.
export function usePlayers(roomId) {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    if (!roomId) { setPlayers([]); return; }
    let cancelled = false;

    const load = async () => {
      const { data, error: e } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('seat', { ascending: true });
      if (!cancelled) {
        if (e) console.error('players load', e);
        setPlayers(data || []);
      }
    };
    load();

    const channel = supabase
      .channel(`players:${roomId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        () => { load(); })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return [players, setPlayers];
}

// Single game_state row for the room.
export function useGameStateRow(roomId) {
  const [gs, setGs] = useState(null);

  useEffect(() => {
    if (!roomId) { setGs(null); return; }
    let cancelled = false;

    const load = async () => {
      const { data, error: e } = await supabase
        .from('game_state')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle();
      if (!cancelled) {
        if (e) console.error('game_state load', e);
        setGs(data || null);
      }
    };
    load();

    const channel = supabase
      .channel(`game_state:${roomId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_state', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') setGs(null);
          else setGs(payload.new);
        })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return [gs, setGs];
}

// Chat messages for a room, with realtime updates.
export function useChat(roomId) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!roomId) { setMessages([]); return; }
    let cancelled = false;

    const load = async () => {
      const { data, error: e } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('sent_at', { ascending: true })
        .limit(200);
      if (!cancelled) {
        if (e) console.error('chat load', e);
        setMessages(data || []);
      }
    };
    load();

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return [messages, setMessages];
}

// Heartbeat: keep `last_seen` fresh while this component is mounted.
export function useHeartbeat(playerId) {
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    if (!playerId) return;
    const beat = () => {
      if (!aliveRef.current) return;
      supabase.from('players')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', playerId)
        .then(() => {});
    };
    beat();
    const t = setInterval(beat, 5000);
    return () => { aliveRef.current = false; clearInterval(t); };
  }, [playerId]);
}

// Find the local player by id with a direct query + per-row realtime
// subscription. This is more reliable than scanning usePlayers() because
// it doesn't depend on the room-wide load returning the right list.
export function useFindMe(playerId) {
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!playerId) { setMe(null); setLoaded(false); return; }
    let cancelled = false;

    const load = async () => {
      const { data, error: e } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .maybeSingle();
      if (cancelled) return;
      if (e) console.error('useFindMe load', e);
      setMe(data || null);
      setLoaded(true);
    };
    load();

    const channel = supabase
      .channel(`me:${playerId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `id=eq.${playerId}` },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === 'DELETE') setMe(null);
          else setMe(payload.new);
        })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [playerId]);

  return { me, loaded };
}

// Set up a Supabase Realtime broadcast channel for a room.
export function useBroadcastChannel(channelName) {
  const channelRef = useRef(null);
  const [channel, setChannel] = useState(null);

  useEffect(() => {
    if (!channelName) return;
    const ch = supabase.channel(channelName, { config: { broadcast: { self: false } } });
    channelRef.current = ch;
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') setChannel(ch);
    });
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
      setChannel(null);
    };
  }, [channelName]);

  return channel;
}
