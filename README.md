# Ludo Royal

A mobile-first, no-account, realtime multiplayer Ludo web app.

- **Frontend:** React 19 + Vite + Tailwind CSS
- **Backend:** Supabase (Postgres + Realtime broadcast)
- **Voice:** WebRTC mesh via `simple-peer`, signaled through a Supabase Realtime broadcast channel
- **No accounts.** Players pick a name and a 6-character room code.

## Features

- Classic 15×15 Ludo board with 4 colored home bases, 52-cell main path, 5-cell home columns, and a final-home center
- Two-dice system with four move options (A=sum, B=split, C=die1, D=die2)
- Special rules: double-6 bonus turn, 6 brings a piece out, no-6-all-home auto-skip, safe squares, exact-count home entry
- Realtime multiplayer for up to 4 players (humans + bots)
- CPU bots with capture-priority logic (host can add them from the lobby)
- Voice chat between all human players, with a pulsing ring around whoever is currently speaking
- Text chat (persisted to Supabase)
- Turn timer (30s or 60s, host-configurable) with red countdown bar
- In-game kill / pieces-home / turns-taken stats
- Win screen with confetti
- Dark mode toggle (persisted to localStorage)
- Sound effects via Howler (drop your own `.mp3` files into `public/sounds/`)
- Mobile portrait-first layout with touch-friendly controls and a safe-area-aware bottom panel
- Rejoin on accidental tab close (session token stored in `sessionStorage`)

---

## Local setup

```bash
git clone <your-repo> ludo-royal
cd ludo-royal
npm install
cp .env.example .env
# fill in the two Supabase keys (see below)
npm run dev
```

Open `http://localhost:5173` in your browser. To test multiplayer, open the same URL in a second browser (or a phone on the same network — use your LAN IP, e.g. `http://192.168.1.10:5173`).

> **HTTPS note:** microphone access requires a secure origin. On localhost it works over HTTP. To test voice from a phone, use `ngrok http 5173` (free) or deploy to Vercel (instructions below).

---

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In your project's dashboard, go to **SQL Editor → New query**.
3. Paste the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) and click **Run**. This creates the 4 tables, RLS policies, realtime publication, and triggers.
4. Go to **Database → Replication** and confirm that `rooms`, `players`, `game_state`, and `chat_messages` are all toggled **on**. (The script does this automatically, but it's worth double-checking — it's the most common reason realtime doesn't work.)
5. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.
6. Put them in your `.env`:
   ```
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

> The schema allows anonymous read/write on all tables (since there is no auth model). For a real production app, tighten the RLS policies.

---

## Environment variables

| Variable                  | Where to find it                                 |
| ------------------------- | ------------------------------------------------ |
| `VITE_SUPABASE_URL`       | Supabase dashboard → Project Settings → API      |
| `VITE_SUPABASE_ANON_KEY`  | Supabase dashboard → Project Settings → API      |

Both must be present at **build time** for Vite to inline them into the bundle.

---

## Deploy to Vercel

1. Push the repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Vercel auto-detects Vite. Framework preset: **Vite**. Build command: `vite build`. Output: `dist`.
4. In **Project Settings → Environment Variables**, add the two `VITE_SUPABASE_*` variables.
5. Click **Deploy**. Your app will be live at `https://<project-name>.vercel.app` within a minute.

> Voice chat and microphone access require HTTPS, which Vercel provides by default.

---

## Sound effects

The game references the following files. Drop them into `public/sounds/`:

- `dice.mp3` — dice roll
- `move.mp3` — piece slides
- `kill.mp3` — capture
- `home.mp3` — piece reaches final home
- `win.mp3` — victory fanfare

If a file is missing, the app logs a one-line info message and plays silence. Everything else keeps working — the game is fully playable without sound.

You can find free-to-use Ludo SFX on freesound.org, mixkit.co, or pixabay.com/sound-effects. Keep them under 100 KB each for fast load.

---

## File structure

```
ludo-royal/
├── .env.example
├── README.md
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── public/
│   └── sounds/             ← drop your mp3s here
├── supabase/
│   └── schema.sql          ← run this once in the Supabase SQL editor
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── components/
    │   ├── HomeScreen.jsx
    │   ├── Lobby.jsx
    │   ├── GameView.jsx        ← wires everything during gameplay
    │   ├── Board.jsx
    │   ├── Piece.jsx
    │   ├── Dice.jsx
    │   ├── MoveSelector.jsx
    │   ├── PlayerPanel.jsx
    │   ├── ChatBox.jsx
    │   ├── VoiceCall.jsx
    │   └── WinScreen.jsx
    ├── game/
    │   ├── boardPaths.js       ← 15×15 coordinates, path indices, safe squares
    │   ├── gameLogic.js        ← dice, moves, captures, win check
    │   └── botAI.js            ← CPU bot decision tree
    ├── hooks/
    │   ├── useSupabase.js      ← room / players / game_state / chat + heartbeat
    │   └── useGameState.js     ← central game controller
    ├── lib/
    │   ├── supabaseClient.js
    │   └── sounds.js
    └── utils/
        ├── codes.js            ← 6-char room code generation & validation
        └── session.js          ← sessionStorage name + token
```

---

## How it works (for the curious)

- The board is one 15×15 CSS grid. Cells are styled based on whether they're a home base, main-path, home-column, or final-home cell. Pieces are absolutely positioned over the grid using `top`/`left` percentages, so changing a piece's coordinate triggers a smooth CSS `transition`.
- Game state is just a JSON blob in the `game_state` table. Every player subscribes to changes on that row. The current turn is whoever's `color` matches `current_turn` — the active player's UI shows the dice and Move Selector; everyone else sees a "Waiting for…" animation.
- For each dice roll, the active player computes the four valid options client-side. Any combination where no valid piece exists is greyed out.
- The two-dice split (Option B) automatically includes "bring one piece out using a 6, move another by the other die" when a 6 is rolled, on top of the standard two-on-board split.
- Bots are stored in the `players` table with `is_bot = true` and their own `session_token`. A `useEffect` in `useGameState` watches for the current turn being a bot and runs a delayed roll + move sequence.
- WebRTC signaling rides on a Supabase Realtime broadcast channel (`voice:<roomId>`). The peer with the smaller `id` initiates the connection to break ties. Each remote stream is piped through an `AnalyserNode` for voice-activity detection; the active speaker gets a pulsing ring.
- The turn timer is derived from `turn_started + settings.turn_timer`. If the timer expires, the controller auto-advances the turn (only the active player or a bot performs the skip, to avoid races).

---

## Troubleshooting

**Blank board / no realtime updates** — Make sure Database → Replication is enabled for all 4 tables in your Supabase dashboard.

**Microphone not working** — Voice requires HTTPS in production. Vercel provides this for free. On localhost, the browser allows HTTP.

**"Room not found"** — Codes are case-insensitive but the room might have been closed if the host left. Re-create the room.

**"No moves available"** — You rolled without a 6 and all your pieces are still at home. The turn auto-skips. (This is the standard Ludo rule.)

**Bots don't move** — The bot loop only runs when `current_turn` matches a bot's `color`. If a bot is stuck, check the browser console for errors.

**Sound not playing** — Browsers block autoplay until the user interacts. The app preloads Howler after you click Create/Join. If a `.mp3` is missing, you'll see a one-line `[sounds] xxx.mp3 not found` log in the console.

---

## License

MIT — do whatever you like.
