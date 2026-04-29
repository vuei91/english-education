-- Migration: Row Level Security policies
-- Req coverage: 11.4, 17.7
--
-- Baseline rules:
--   * Content tables  : public SELECT only when status='production'.
--                       Writes reserved for the service role (pipeline).
--   * User tables     : owners only. `user_id = auth.uid()` for every
--                       operation. No one else can read your progress.
--
-- Supabase design note: the `anon` role is what unauthenticated clients
-- come in as, and `authenticated` is the post-login role. We grant SELECT
-- on content to both since users can browse production content before
-- creating an account (anonymous mode, Req 16.2).

-- ---------------------------------------------------------------------------
-- Content tables — read-only for the public, filtered by status
-- ---------------------------------------------------------------------------
alter table public.sentences enable row level security;
alter table public.chunks enable row level security;
alter table public.sentence_summary enable row level security;
alter table public.pattern_drills enable row level security;
alter table public.vocab_entries enable row level security;

-- sentences: visible only when production-ready
create policy "sentences are public when production"
  on public.sentences
  for select
  using (status = 'production');

-- chunks: follow parent sentence visibility
create policy "chunks follow sentence visibility"
  on public.chunks
  for select
  using (
    exists (
      select 1 from public.sentences s
      where s.id = chunks.sentence_id and s.status = 'production'
    )
  );

-- sentence_summary: follow parent sentence visibility
create policy "summary follows sentence visibility"
  on public.sentence_summary
  for select
  using (
    exists (
      select 1 from public.sentences s
      where s.id = sentence_summary.sentence_id and s.status = 'production'
    )
  );

-- pattern_drills: follow origin sentence visibility
create policy "drills follow sentence visibility"
  on public.pattern_drills
  for select
  using (
    exists (
      select 1 from public.sentences s
      where s.id = pattern_drills.origin_sentence_id and s.status = 'production'
    )
  );

-- vocab_entries: freely readable. Pipeline curates, no status gating needed.
create policy "vocab entries are public read"
  on public.vocab_entries
  for select
  using (true);

-- ---------------------------------------------------------------------------
-- User tables — owners only
-- ---------------------------------------------------------------------------
alter table public.user_sentence_progress enable row level security;
alter table public.user_word_tap enable row level security;
alter table public.user_daily_progress enable row level security;
alter table public.user_streak enable row level security;
alter table public.user_rewards_log enable row level security;

create policy "own sentence progress"
  on public.user_sentence_progress
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own word taps"
  on public.user_word_tap
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own daily progress"
  on public.user_daily_progress
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own streak"
  on public.user_streak
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own rewards log"
  on public.user_rewards_log
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
