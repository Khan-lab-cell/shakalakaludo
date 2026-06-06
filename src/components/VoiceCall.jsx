// VoiceCall: simple-peer mesh between all human players in a room.
// Signaling rides on a Supabase Realtime broadcast channel.
// Voice activity is detected with Web Audio AnalyserNode and exposed
// via onSpeaking(playerId, isSpeaking) so the PlayerPanel can show
// a pulsing ring around the active speaker.

import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import { supabase } from '../lib/supabaseClient.js';

export default function VoiceCall({ roomId, you, players, onSpeakingChange }) {
  const [muted, setMuted] = useState(false);
  const [permission, setPermission] = useState('unknown'); // 'unknown' | 'granted' | 'denied' | 'prompt'
  const [error, setError] = useState(null);

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // playerId -> SimplePeer instance
  const audioCtxRef = useRef(null);
  const channelRef = useRef(null);
  const onSpeakingChangeRef = useRef(onSpeakingChange);
  onSpeakingChangeRef.current = onSpeakingChange;
  const speakingStateRef = useRef(new Map()); // playerId -> boolean

  // Request microphone
  useEffect(() => {
    let cancelled = false;
    const request = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setPermission('denied');
          setError('Microphone API not available.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setPermission('granted');
      } catch (e) {
        if (cancelled) return;
        setPermission('denied');
        setError(e?.message || 'Microphone permission denied.');
      }
    };
    request();
    return () => {
      cancelled = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, []);

  // Build a peer connection
  const buildPeer = useCallback((otherPlayer, initiator) => {
    if (!localStreamRef.current || !you) return null;
    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream: localStreamRef.current,
    });
    peer.on('signal', (data) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'signal',
        payload: { from: you.id, to: otherPlayer.id, data },
      });
    });
    peer.on('stream', (remoteStream) => {
      // Attach to an <audio> element
      let audio = document.getElementById(`audio-${otherPlayer.id}`);
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = `audio-${otherPlayer.id}`;
        audio.autoplay = true;
        audio.playsInline = true;
        document.body.appendChild(audio);
      }
      audio.srcObject = remoteStream;
      // VAD
      try {
        const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
        if (!audioCtxRef.current) audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(remoteStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        let last = 0;
        const tick = () => {
          if (!peersRef.current.has(otherPlayer.id)) return;
          analyser.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          const avg = sum / buf.length;
          const isSpeaking = avg > 18;
          if (isSpeaking !== speakingStateRef.current.get(otherPlayer.id)) {
            speakingStateRef.current.set(otherPlayer.id, isSpeaking);
            onSpeakingChangeRef.current?.(otherPlayer.id, isSpeaking);
          }
          last = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        console.warn('VAD setup failed', e);
      }
    });
    peer.on('close', () => destroyPeer(otherPlayer.id));
    peer.on('error', (e) => {
      console.warn('peer error', otherPlayer?.id, e?.message);
      destroyPeer(otherPlayer.id);
    });
    peersRef.current.set(otherPlayer.id, peer);
    return peer;
  }, [you]);

  const destroyPeer = useCallback((otherId) => {
    const p = peersRef.current.get(otherId);
    if (p) {
      try { p.destroy(); } catch (e) {}
      peersRef.current.delete(otherId);
    }
    const audio = document.getElementById(`audio-${otherId}`);
    if (audio) {
      try { audio.srcObject = null; audio.remove(); } catch (e) {}
    }
    if (speakingStateRef.current.get(otherId)) {
      speakingStateRef.current.set(otherId, false);
      onSpeakingChangeRef.current?.(otherId, false);
    }
  }, []);

  // Wire up signaling channel
  useEffect(() => {
    if (!roomId || !you) return;
    const channel = supabase.channel(`voice:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;
    channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      if (!payload || payload.to !== you.id) return;
      let peer = peersRef.current.get(payload.from);
      if (!peer) {
        const other = players.find((p) => p.id === payload.from);
        if (!other) return;
        peer = buildPeer(other, false);
      }
      if (peer) {
        try { peer.signal(payload.data); } catch (e) { console.warn('signal fail', e); }
      }
    });
    channel.on('broadcast', { event: 'hello' }, ({ payload }) => {
      if (!payload || payload.from === you.id) return;
      // The peer with the smaller id initiates to break ties.
      if (you.id < payload.from) {
        const other = players.find((p) => p.id === payload.from);
        if (other && !peersRef.current.has(other.id)) buildPeer(other, true);
      }
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event: 'hello', payload: { from: you.id } });
      }
    });

    return () => {
      try { channel.send({ type: 'broadcast', event: 'bye', payload: { from: you.id } }); } catch (e) {}
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, you?.id]);

  // When the players list changes (e.g. someone joins), greet them.
  useEffect(() => {
    if (!channelRef.current || !you) return;
    channelRef.current.send({ type: 'broadcast', event: 'hello', payload: { from: you.id } });
  }, [players.length, you?.id]);

  // Toggle mute
  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Array.from(peersRef.current.keys()).forEach(destroyPeer);
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch (e) {}
        audioCtxRef.current = null;
      }
    };
  }, [destroyPeer]);

  return (
    <>
      <button
        onClick={toggleMute}
        className={`fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white text-xl transition-all active:scale-95 ${
          muted || permission === 'denied' ? 'bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
        title={permission === 'denied' ? 'Mic blocked' : muted ? 'Unmute' : 'Mute'}
        aria-label="Toggle microphone"
      >
        {permission === 'denied' ? '🚫' : muted ? '🔇' : '🎙️'}
      </button>
      {permission === 'denied' && error && (
        <div className="fixed bottom-20 right-4 z-40 bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-xs px-3 py-2 rounded-lg max-w-xs shadow">
          Voice chat unavailable: {error}
        </div>
      )}
    </>
  );
}
