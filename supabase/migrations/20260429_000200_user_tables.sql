-- Migration: user-owned tables
-- Req coverage: 12.1, 13.x, 15.x, 17.x
--
-- Creates the per-user records that get synced from the device.
--   - user_sentence_progress: completion + two-grade feedback per sentence
--   - user_word_tap         : append-only log of Vocab Helper taps
--   - user_daily_progress   : one row per day (local date) with goal-met flag
--   - user_streak           : current / best streak + last goal-met date
--   - user_rewards_log      : rewarded-ad grants (for per-day caps)
--
-- Every table carries `updated_at` so the sync service can pick a winner
-- during conflict resolution ("latest updated_at wins", design D7).
-- RLS and policies live in a separate migration.

-- ---------------------------------------------------------------------------
-- user_sentence_progress
-- ---------------------------------------------------------------------------
create type public.sentence_feedback as enum ('known', 'hard');

create table public.user_sentence_progress (
  user_id       uuid not null references auth.users (id) on delete cascade,
  sentence_id   uuid not null references public.sentences (id) on delete cascade,
  completed_at  timestamptz not null default now(),
  feedback      public.sentence_feedback,
  updated_at    timestamptz not null default now(),
  primary key (user_id, sentence_id)
);

create index user_sentence_progress_user_idx
  on public.user_sentence_progress (user_id);

-- ---------------------------------------------------------------------------
-- user_word_tap (append-only log → powers Word Unresolved Score)
-- ---------------------------------------------------------------------------
create table public.user_word_tap (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  word                text not null,
  tapped_at           timestamptz not null default now(),
  source_sentence_id  uuid references public.sentences (id) on delete set null
);

create index user_word_tap_user_idx on public.user_word_tap (user_id);
create index user_word_tap_user_tapped_idx
  on public.user_word_tap (user_id, tapped_at desc);

-- ---------------------------------------------------------------------------
-- user_daily_progress
-- ---------------------------------------------------------------------------
create table public.user_daily_progress (
  user_id               uuid not null references auth.users (id) on delete cascade,
  "date"                date not null,  -- LOCAL date per user's timezone
  sentences_completed   integer not null default 0,
  goal_met              boolean not null default false,
  updated_at            timestamptz not null default now(),
  primary key (user_id, "date")
);

-- ---------------------------------------------------------------------------
-- user_streak
-- ---------------------------------------------------------------------------
create table public.user_streak (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  current_streak       integer not null default 0,
  best_streak          integer not null default 0,
  last_goal_met_date   date,
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- user_rewards_log
-- ---------------------------------------------------------------------------
create type public.reward_type as enum ('heart', 'unlock', 'drill-retry');

create table public.user_rewards_log (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  reward_type  public.reward_type not null,
  granted_at   timestamptz not null default now()
);

create index user_rewards_log_user_day_idx
  on public.user_rewards_log (user_id, granted_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse the function created in the previous migration)
-- ---------------------------------------------------------------------------
create trigger user_sentence_progress_touch_updated_at
  before update on public.user_sentence_progress
  for each row execute function public.tg_touch_updated_at();

create trigger user_daily_progress_touch_updated_at
  before update on public.user_daily_progress
  for each row execute function public.tg_touch_updated_at();

create trigger user_streak_touch_updated_at
  before update on public.user_streak
  for each row execute function public.tg_touch_updated_at();
