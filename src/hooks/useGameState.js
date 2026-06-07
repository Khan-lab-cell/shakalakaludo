// useGameState: the central game controller.
// - Reads room + players + game_state from Supabase
// - Provides actions: rollDice, selectMove, endTurn, startGame, kick, addBot, sendChat
// - Handles bot turns and turn-timer auto-skip
// - All writes go through updateGameState() which merges with the latest row.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useRoom, usePlayers, useGameStateRow, useChat, useHeartbeat } from './useSupabase.js';
import { SEAT_COLORS } from '../game/boardPaths.js';
import {
  createInitialBoard, rollDice as rollDiceLogic,
  applyMoves, isDoubleSix, hasWon, nextTurn,
} from '../game/gameLogic.js';
import { chooseOption } from '../game/botAI.js';

const TICK_MS = 1000;

export function useGameState({ code, playerId }) {
  const { room, loading: roomLoading } = useRoom(code);
  const [players] = usePlayers(room?.id);
  const [gs, setGs] = useGameStateRow(room?.id);
  const [chat] = useChat(room?.id);

  const [you, setYou] = useState(null);
  const [selectedPiece, setSelectedPiece] = useState(null); // { color, slot }
  const [pendingOption, setPendingOption] = useState(null); // 'A'|'B'|'C'|'D' or null
  const [toast, setToast] = useState(null);
  const [selectedOptionMoves, setSelectedOptionMoves] = useState(null); // chosen moves
  const [winner, setWinner] = useState(null);

  // Heartbeat for the local player
  useHeartbeat(you?.id);

  // Identify the local player row by stable player.id (uuid from the
  // players table). This is more reliable than session_token because the
  // token is rotated on every new room entry.
  useEffect(() => {
    if (!playerId || !players.length) {
      setYou(null);
      return;
    }
    const me = players.find((p) => p.id === playerId);
    setYou(me || null);
  }, [players, playerId]);

  // Local mirror of game state, seeded once from gs
  const localGsRef = useRef(gs);
  useEffect(() => { localGsRef.current = gs; }, [gs]);

  // Winner detection
  useEffect(() => {
    if (!gs?.board) return;
    for (const color of ['red', 'blue', 'green', 'yellow']) {
      if (hasWon(gs.board, color)) {
        setWinner(color);
        break;
      }
    }
  }, [gs?.board]);

  // ------- Helpers to write to Supabase -------
  const updateGameState = useCallback(async (patch) => {
    if (!gs?.id) return;
    const next = { ...gs, ...patch, last_updated: new Date().toISOString() };
    setGs(next);
    const { error } = await supabase
      .from('game_state')
      .update(patch)
      .eq('id', gs.id);
    if (error) console.error('updateGameState', error);
  }, [gs, setGs]);

  const updatePlayer = useCallback(async (playerId, patch) => {
    const { error } = await supabase
      .from('players')
      .update(patch)
      .eq('id', playerId);
    if (error) console.error('updatePlayer', error);
  }, []);

  const showToast = useCallback((text, ms = 2500) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), ms);
  }, []);

  // ------- Turn timer + auto-skip -------
  const settings = room?.settings || { turn_timer: 30 };
  const turnTimer = settings.turn_timer || 30;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const turnEndsAt = useMemo(() => {
    if (!gs?.turn_started) return null;
    const t = new Date(gs.turn_started).getTime() + turnTimer * 1000;
    return t;
  }, [gs?.turn_started, turnTimer]);

  const turnRemainingMs = turnEndsAt ? Math.max(0, turnEndsAt - now) : null;

  // Auto-skip: if the current player is a bot OR (the active player is a human and timer expired),
  // the controller itself advances the turn. We only auto-skip if the current player has not
  // already rolled and the phase is 'roll'. If they rolled, they still need to pick a move.
  useEffect(() => {
    if (!gs || !players.length || winner) return;
    if (gs.move_phase !== 'roll') return;
    if (turnRemainingMs === null) return;
    if (turnRemainingMs > 0) return;
    const currentPlayer = players.find((p) => p.color === gs.current_turn);
    if (!currentPlayer) return;
    // Only the active player (or a bot) can end their own turn. For simplicity we let the
    // CURRENT CLIENT (any client) auto-advance if the local view detects expiry and the
    // current player is THIS client. For bots we also let any client do it.
    const iAmActive = you && you.id === currentPlayer.id;
    if (currentPlayer.is_bot || iAmActive) {
      // Skip the turn: clear dice, advance to next.
      const skipNext = nextTurn(gs.current_turn);
      updateGameState({
        current_turn: skipNext,
        dice_result: null,
        move_phase: 'roll',
        turn_started: new Date().toISOString(),
        winner: null,
      });
      if (currentPlayer.is_bot) {
        // increment bot turns_taken
        updatePlayer(currentPlayer.id, { turns_taken: (currentPlayer.turns_taken || 0) + 1 });
      }
    }
  }, [turnRemainingMs, gs, players, you, winner, updateGameState, updatePlayer]);

  // ------- Bot turn loop -------
  useEffect(() => {
    if (!gs || !players.length || winner) return;
    if (room?.status !== 'playing') return;
    const currentPlayer = players.find((p) => p.color === gs.current_turn);
    if (!currentPlayer || !currentPlayer.is_bot) return;

    let cancelled = false;
    const runBot = async () => {
      // 1) Roll the dice
      await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
      if (cancelled || !localGsRef.current) return;
      const dice = rollDiceLogic();
      await updateGameState({
        dice_result: dice,
        move_phase: 'select',
      });
      // 2) Pick a move
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
      if (cancelled || !localGsRef.current) return;
      const state = localGsRef.current;
      const choice = chooseOption(state.board, currentPlayer.color, dice);
      if (choice.label === 'skip' || choice.moves.length === 0) {
        // Nothing to do, skip turn
        const skipNext = nextTurn(currentPlayer.color);
        await updateGameState({
          current_turn: skipNext,
          dice_result: null,
          move_phase: 'roll',
          turn_started: new Date().toISOString(),
        });
        await updatePlayer(currentPlayer.id, { turns_taken: (currentPlayer.turns_taken || 0) + 1 });
        return;
      }
      const { board: newBoard, captured } = applyMoves(state.board, currentPlayer.color, choice.moves);
      // Stat updates
      const newKills = (currentPlayer.kills || 0) + captured.length;
      const prevFinished = state.board[currentPlayer.color].filter((p) => p === 'finished').length;
      const nextFinished = newBoard[currentPlayer.color].filter((p) => p === 'finished').length;
      const newPiecesHome = (currentPlayer.pieces_home || 0) + (nextFinished - prevFinished);
      await updatePlayer(currentPlayer.id, { kills: newKills, pieces_home: newPiecesHome });

      const isDouble = isDoubleSix(dice);
      const next = isDouble ? currentPlayer.color : nextTurn(currentPlayer.color);
      const finalWinner = hasWon(newBoard, currentPlayer.color) ? currentPlayer.color : null;
      await updateGameState({
        board: newBoard,
        current_turn: next,
        dice_result: null,
        move_phase: 'roll',
        turn_started: new Date().toISOString(),
        winner: finalWinner,
      });
      if (finalWinner) {
        await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id);
      }
    };
    runBot();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs?.current_turn, gs?.move_phase, room?.status, winner, room?.id, players, you, updateGameState, updatePlayer]);

  // ------- Player actions -------
  const isMyTurn = you && gs && you.color === gs.current_turn && !you.is_bot;

  const rollDice = useCallback(async () => {
    if (!isMyTurn) return;
    if (gs.move_phase !== 'roll') return;
    const dice = rollDiceLogic();
    await updateGameState({ dice_result: dice, move_phase: 'select' });
  }, [isMyTurn, gs, updateGameState]);

  const selectMove = useCallback(async (moves) => {
    if (!isMyTurn) return;
    if (gs.move_phase !== 'select') return;
    if (!moves || !moves.length) return;
    const { board: newBoard, captured } = applyMoves(gs.board, you.color, moves);
    if (!newBoard || newBoard === gs.board) return;

    // Update player stats
    const newKills = (you.kills || 0) + captured.length;
    const prevFinished = gs.board[you.color].filter((p) => p === 'finished').length;
    const nextFinished = newBoard[you.color].filter((p) => p === 'finished').length;
    const newPiecesHome = (you.pieces_home || 0) + (nextFinished - prevFinished);
    await updatePlayer(you.id, { kills: newKills, pieces_home: newPiecesHome, turns_taken: (you.turns_taken || 0) + 1 });

    const isDouble = isDoubleSix(gs.dice_result);
    const next = isDouble ? you.color : nextTurn(you.color);
    const finalWinner = hasWon(newBoard, you.color) ? you.color : null;

    await updateGameState({
      board: newBoard,
      current_turn: next,
      dice_result: null,
      move_phase: 'roll',
      turn_started: new Date().toISOString(),
      winner: finalWinner,
    });
    setSelectedPiece(null);
    setPendingOption(null);
    setSelectedOptionMoves(null);
    if (finalWinner) {
      await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id);
    }
    if (captured.length) showToast(`Captured ${captured.length}!`, 1800);
  }, [isMyTurn, gs, you, updateGameState, updatePlayer, room, showToast]);

  // ------- Lobby actions -------
  const startGame = useCallback(async () => {
    if (!room || !you?.is_host) return;
    if (players.length < 2) return;
    const firstTurn = SEAT_COLORS[0];
    const { error: gsError } = await supabase
      .from('game_state')
      .upsert({
        room_id: room.id,
        board: createInitialBoard(),
        current_turn: firstTurn,
        dice_result: null,
        move_phase: 'roll',
        turn_started: new Date().toISOString(),
        winner: null,
      }, { onConflict: 'room_id' })
      .select()
      .single();
    if (gsError) console.error('startGame game_state', gsError);
    await supabase.from('rooms').update({ status: 'playing' }).eq('id', room.id);
  }, [room, you, players.length]);

  const kickPlayer = useCallback(async (playerId) => {
    if (!you?.is_host) return;
    await supabase.from('players').delete().eq('id', playerId);
  }, [you]);

  const addBot = useCallback(async (color) => {
    if (!room || !you?.is_host) return;
    const taken = new Set(players.map((p) => p.seat));
    let seat = 1;
    while (taken.has(seat)) seat += 1;
    if (seat > 4) return;
    const usedColor = color || SEAT_COLORS[seat - 1];
    await supabase.from('players').insert({
      room_id: room.id,
      name: `Bot ${seat}`,
      color: usedColor,
      seat,
      is_host: false,
      is_bot: true,
      session_token: `bot-${room.id}-${seat}`,
    });
  }, [room, you, players]);

  const sendChat = useCallback(async (text) => {
    const cleaned = (text || '').trim().slice(0, 500);
    if (!cleaned || !room || !you) return;
    await supabase.from('chat_messages').insert({
      room_id: room.id,
      player_id: you.id,
      player_name: you.name,
      color: you.color,
      message: cleaned,
    });
  }, [room, you]);

  const updateSettings = useCallback(async (patch) => {
    if (!room || !you?.is_host) return;
    const next = { ...(room.settings || {}), ...patch };
    await supabase.from('rooms').update({ settings: next }).eq('id', room.id);
  }, [room, you]);

  // Mark this player disconnected (called on unmount of game view).
  const leaveRoom = useCallback(async () => {
    if (you?.id) {
      try { await supabase.from('players').delete().eq('id', you.id); } catch (e) { console.error('leaveRoom', e); }
    }
  }, [you]);

  return {
    room,
    gs,
    players,
    chat,
    you,
    winner,
    toast,
    roomLoading,
    isMyTurn,
    turnTimer,
    turnRemainingMs,
    selectedPiece,
    setSelectedPiece,
    pendingOption,
    setPendingOption,
    selectedOptionMoves,
    setSelectedOptionMoves,
    actions: {
      rollDice,
      selectMove,
      startGame,
      kickPlayer,
      addBot,
      sendChat,
      updateSettings,
      leaveRoom,
    },
  };
}
