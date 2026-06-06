-- =====================================================================
-- Ludo Royal — Supabase schema
-- Run this in the Supabase SQL Editor (Database → SQL Editor → New query)
-- Then enable Realtime on all 4 tables: Database → Replication → enable.
-- =====================================================================

-- 1. rooms ---------------------------------------------------------------
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null check (char_length(code) = 6),
  host_name   text not null,
  status      text not null default 'waiting' check (status in ('waiting','playing','finished')),
  settings    jsonb not null default '{"turn_timer": 30, "num_players": 4}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists rooms_code_idx on public.rooms (code);

-- 2. players -------------------------------------------------------------
create table if not exists public.players (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms(id) on delete cascade,
  name            text not null,
  color           text not null check (color in ('red','blue','green','yellow')),
  seat            integer not null check (seat between 1 and 4),
  is_host         boolean not null default false,
  is_bot          boolean not null default false,
  session_token   text not null,
  kills           integer not null default 0,
  turns_taken     integer not null default 0,
  pieces_home     integer not null default 0,
  last_seen       timestamptz not null default now(),
  disconnected    boolean not null default false,
  joined_at       timestamptz not null default now()
);

create unique index if not exists players_room_seat_uq on public.players (room_id, seat);
create unique index if not exists players_session_token_idx on public.players (session_token);
create index if not exists players_room_id_idx on public.players (room_id);

-- 3. game_state ----------------------------------------------------------
create table if not exists public.game_state (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid unique not null references public.rooms(id) on delete cascade,
  board         jsonb not null,
  current_turn  text check (current_turn in ('red','blue','green','yellow')),
  dice_result   jsonb,
  move_phase    text not null default 'roll' check (move_phase in ('roll','select')),
  turn_started  timestamptz not null default now(),
  winner        text,
  last_updated  timestamptz not null default now()
);

create index if not exists game_state_room_id_idx on public.game_state (room_id);

-- 4. chat_messages -------------------------------------------------------
create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  player_id    uuid references public.players(id) on delete set null,
  player_name  text not null,
  color        text,
  message      text not null check (char_length(message) > 0 and char_length(message) <= 500),
  sent_at      timestamptz not null default now()
);

create index if not exists chat_room_sent_idx on public.chat_messages (room_id, sent_at desc);

-- =====================================================================
-- Row Level Security
-- The app has no auth, so we allow full anon access. Tighten in production.
-- =====================================================================
alter table public.rooms         enable row level security;
alter table public.players       enable row level security;
alter table public.game_state    enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "anon all rooms"         on public.rooms;
drop policy if exists "anon all players"       on public.players;
drop policy if exists "anon all game_state"    on public.game_state;
drop policy if exists "anon all chat_messages" on public.chat_messages;

create policy "anon all rooms"         on public.rooms         for all to anon using (true) with check (true);
create policy "anon all players"       on public.players       for all to anon using (true) with check (true);
create policy "anon all game_state"    on public.game_state    for all to anon using (true) with check (true);
create policy "anon all chat_messages" on public.chat_messages for all to anon using (true) with check (true);

-- =====================================================================
-- Realtime: enable publication on the 4 tables
-- (Equivalent to toggling them on in Database → Replication)
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.game_state;
alter publication supabase_realtime add table public.chat_messages;

-- =====================================================================
-- Helper trigger: keep game_state.last_updated fresh on every UPDATE
-- =====================================================================
create or replace function public.touch_last_updated()
returns trigger language plpgsql as $$
begin
  new.last_updated := now();
  return new;
end $$;

drop trigger if exists trg_touch_game_state on public.game_state;
create trigger trg_touch_game_state
  before update on public.game_state
  for each row execute function public.touch_last_updated();

drop trigger if exists trg_touch_players on public.players;
create trigger trg_touch_players
  before update on public.players
  for each row execute function public.touch_last_updated();
