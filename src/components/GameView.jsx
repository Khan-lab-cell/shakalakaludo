import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState.js';
import { getName, getSessionToken } from '../utils/session.js';
import { playSound } from '../lib/sounds.js';
import Board from './Board.jsx';
import Dice from './Dice.jsx';
import MoveSelector from './MoveSelector.jsx';
import PlayerPanel from './PlayerPanel.jsx';
import ChatBox from './ChatBox.jsx';
import VoiceCall from './VoiceCall.jsx';
import WinScreen from './WinScreen.jsx';
import {
  getValidOptions, isDoubleSix, HOME_PATH, FINAL_HOME, START, HOME_ENTRY, PATH,
} from '../game/gameLogic.js';

function GameView() {
  const { code } = useParams();
  const navigate = useNavigate();
  const player = useMemo(() => ({ name: getName(), sessionToken: getSessionToken() }), []);
  const { room, gs, players, chat, you, winner, toast, isMyTurn, turnRemainingMs, turnTimer, actions } = useGameState({ code, player });

  const [pendingOption, setPendingOption] = useState(null);
  const [pickedSlots, setPickedSlots] = useState([null, null]);
  const [speakingIds, setSpeakingIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('play');
  const [rolling, setRolling] = useState(false);
  const [validDestinations, setValidDestinations] = useState([]);
  const [lastDice, setLastDice] = useState(null);
  const [lastBoard, setLastBoard] = useState(null);

  // Dice sound when a new dice result appears
  useEffect(() => {
    if (!gs?.dice_result) return;
    if (lastDice && lastDice.die1 === gs.dice_result.die1 && lastDice.die2 === gs.dice_result.die2) return;
    setLastDice(gs.dice_result);
    playSound('dice');
    setRolling(false);
  }, [gs?.dice_result, lastDice]);

  // Sound on captures and home entries
  useEffect(() => {
    if (!gs?.board) return;
    if (lastBoard) {
      for (const c of ['red', 'blue', 'green', 'yellow']) {
        const prev = (lastBoard[c] || []).filter((p) => p === 'finished').length;
        const now = (gs.board[c] || []).filter((p) => p === 'finished').length;
        if (now > prev) playSound('home');
      }
      for (const c of ['red', 'blue', 'green', 'yellow']) {
        const prevHome = (lastBoard[c] || []).filter((p) => p === 'home').length;
        const nowHome = (gs.board[c] || []).filter((p) => p === 'home').length;
        if (nowHome > prevHome) playSound('kill');
      }
    }
    setLastBoard(gs.board);
  }, [gs?.board, lastBoard]);

  useEffect(() => { if (winner) playSound('win'); }, [winner]);

  // Compute valid destinations for selected piece
  useEffect(() => {
    if (!gs?.board || !gs.dice_result || !you) { setValidDestinations([]); return; }
    if (!isMyTurn) { setValidDestinations([]); return; }
    if (!pendingOption) { setValidDestinations([]); return; }
    if (pickedSlots[0] == null) { setValidDestinations([]); return; }
    const piece = gs.board[you.color]?.[pickedSlots[0]];
    if (!piece || piece === 'home' || piece === 'finished') { setValidDestinations([]); return; }
    let step = null;
    if (pendingOption === 'A') step = gs.dice_result.die1 + gs.dice_result.die2;
    if (pendingOption === 'C') step = gs.dice_result.die1;
    if (pendingOption === 'D') step = gs.dice_result.die2;
    if (step == null) { setValidDestinations([]); return; }
    if (piece.type === 'main') {
      const entry = HOME_ENTRY[you.color];
      const target = piece.index + step;
      if (target < entry) setValidDestinations([PATH[target]]);
      else if (target === entry) setValidDestinations([HOME_PATH[you.color][0]]);
    } else if (piece.type === 'homePath') {
      const target = piece.index + step;
      if (target < HOME_PATH[you.color].length) setValidDestinations([HOME_PATH[you.color][target]]);
      else if (target === HOME_PATH[you.color].length) setValidDestinations([FINAL_HOME[you.color]]);
    }
  }, [pendingOption, pickedSlots, gs, isMyTurn, you]);

  const handleSpeakingChange = useCallback((playerId, isSpeaking) => {
    setSpeakingIds((prev) => {
      const next = new Set(prev);
      if (isSpeaking) next.add(playerId);
      else next.delete(playerId);
      return next;
    });
  }, []);

  const onRoll = async () => {
    setRolling(true);
    setTimeout(async () => { await actions.rollDice(); setRolling(false); }, 700);
  };

  const onConfirmMove = (moves) => {
    playSound('move');
    actions.selectMove(moves);
    setPendingOption(null);
    setPickedSlots([null, null]);
  };

  const onPieceClick = (color, slot) => {
    if (!isMyTurn || !pendingOption || color !== you?.color) return;
    if (pendingOption === 'B') {
      const next = [...pickedSlots];
      if (next[0] == null) next[0] = slot;
      else if (next[1] == null && slot !== next[0]) next[1] = slot;
      else next[0] = slot;
      setPickedSlots(next);
    } else {
      setPickedSlots([slot, null]);
    }
  };

  useEffect(() => {
    if (room === null) navigate('/');
  }, [room, navigate]);

  if (!room || !gs) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">Loading game…</div>
    );
  }

  const currentTurnPlayer = players.find((p) => p.color === gs.current_turn);
  const isDouble = isDoubleSix(gs.dice_result);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-3 py-2">
          <button onClick={() => navigate('/')} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">← Home</button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Code</span>
            <button
              onClick={() => navigator.clipboard?.writeText(room.code)}
              className="font-mono text-sm font-bold tracking-widest text-slate-700 dark:text-slate-200"
            >
              {room.code}
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Turn: <span className={`font-semibold ${
              gs.current_turn === 'red' ? 'text-ludo-red' :
              gs.current_turn === 'blue' ? 'text-ludo-blue' :
              gs.current_turn === 'green' ? 'text-ludo-green' :
              'text-ludo-yellow'
            }`}>{currentTurnPlayer?.name || gs.current_turn}</span>
          </div>
        </div>
        <PlayerPanel
          players={players}
          currentTurn={gs.current_turn}
          you={you}
          speakingIds={speakingIds}
          turnRemainingMs={turnRemainingMs}
          turnTimer={turnTimer}
        />
        {isDouble && (
          <div className="text-center py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-bold animate-slide-up">
            🎲 Bonus Turn!
          </div>
        )}
      </div>

      <div className="flex-1 px-2 py-2 flex items-center justify-center">
        <Board
          board={gs.board}
          players={players}
          you={you}
          selectedPiece={pickedSlots[0] != null ? { color: you?.color, slot: pickedSlots[0] } : null}
          onPieceClick={onPieceClick}
          validDestinations={validDestinations}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('play')}
            className={`flex-1 py-2 text-sm font-semibold ${activeTab === 'play' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
          >
            Play
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 text-sm font-semibold ${activeTab === 'chat' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
          >
            Chat {chat.length > 0 && <span className="ml-1 text-xs text-slate-400">({chat.length})</span>}
          </button>
        </div>

        <div className="max-h-[40vh] overflow-y-auto">
          {activeTab === 'play' && (
            <>
              <Dice
                value={gs.dice_result}
                rolling={rolling}
                isMyTurn={isMyTurn}
                onRoll={onRoll}
                disabled={!isMyTurn || gs.move_phase !== 'roll' || rolling}
                currentTurnName={currentTurnPlayer?.name}
              />
              {gs.dice_result && gs.move_phase === 'select' && (
                <MoveSelector
                  board={gs.board}
                  color={you?.color}
                  dice={gs.dice_result}
                  pendingOption={pendingOption}
                  setPendingOption={setPendingOption}
                  pickedSlots={pickedSlots}
                  setPickedSlots={setPickedSlots}
                  onConfirm={onConfirmMove}
                />
              )}
            </>
          )}
          {activeTab === 'chat' && (
            <div className="h-[40vh]">
              <ChatBox messages={chat} onSend={actions.sendChat} you={you} />
            </div>
          )}
        </div>
      </div>

      {you && !you.is_bot && room?.id && (
        <VoiceCall
          roomId={room.id}
          you={you}
          players={players.filter((p) => !p.is_bot)}
          onSpeakingChange={handleSpeakingChange}
        />
      )}

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {winner && <WinScreen winner={winner} players={players} onClose={() => {}} />}
    </div>
  );
}

export default GameView;
