-- Migration: content tables
-- Req coverage: 3.1, 4.1, 6.2, 8.x, 11.1, 11.4
--
-- Creates the curated content pool tables that the app reads from:
--   - sentences       : 1st-class entity, both Track A (short) and Track B (long)
--   - chunks          : meaning-unit chunks for long sentences
--   - sentence_summary: 4-slot structure summary for long sentences
--   - pattern_drills  : Track A substitution drills rooted in an origin sentence
--   - vocab_entries   : Vocab Helper data (etymology + mnemonic + IPA)
--
-- Design notes
-- ------------
-- * `sentences` keeps `source` + `license` as required metadata so downstream
--   UI can surface "CC BY-SA 3.0" badges when needed (Req 11.5).
-- * `status` gates production visibility. RLS (separate migration) enforces
--   that only status='production' rows are readable publicly.
-- * Chunks are keyed by sentence_id with an order_index so the client can
--   render them left-to-right without extra joins.
-- * Pattern drill variants are stored as jsonb to keep the drill shape
--   flexible while requirements stabilise.

create extension if not exists "uuid-ossp";

create type public.track_kind as enum ('A', 'B');
create type public.cefr_level as enum ('A1', 'A2', 'B1', 'B2', 'C1');
create type public.content_status as enum ('staging', 'production');

-- ---------------------------------------------------------------------------
-- sentences
-- ---------------------------------------------------------------------------
create table public.sentences (
  id            uuid primary key default uuid_generate_v4(),
  track         public.track_kind not null,
  text_en       text not null,
  text_ko       text,
  cefr_level    public.cefr_level not null,
  situation     text,
  source        text not null,
  license       text not null,
  word_count    integer generated always as (
    array_length(regexp_split_to_array(btrim(text_en), '\s+'), 1)
  ) stored,
  status        public.content_status not null default 'staging',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index sentences_track_level_status_idx
  on public.sentences (track, cefr_level, status);

create index sentences_situation_idx
  on public.sentences (situation)
  where situation is not null;

-- ---------------------------------------------------------------------------
-- chunks (Track B only, but schema doesn't enforce that)
-- ---------------------------------------------------------------------------
create table public.chunks (
  id            uuid primary key default uuid_generate_v4(),
  sentence_id   uuid not null references public.sentences (id) on delete cascade,
  order_index   integer not null,
  text          text not null,
  depth         integer not null default 0,
  role          text,
  unique (sentence_id, order_index)
);

create index chunks_sentence_idx on public.chunks (sentence_id);

-- ---------------------------------------------------------------------------
-- sentence_summary (4-slot Structure Summary)
-- ---------------------------------------------------------------------------
create table public.sentence_summary (
  sentence_id   uuid primary key references public.sentences (id) on delete cascade,
  who           text,
  what          text,
  where_at      text,  -- `where` is reserved in SQL, use where_at for clarity
  when_at       text
);

-- ---------------------------------------------------------------------------
-- pattern_drills
-- ---------------------------------------------------------------------------
create table public.pattern_drills (
  id                  uuid primary key default uuid_generate_v4(),
  origin_sentence_id  uuid not null references public.sentences (id) on delete cascade,
  variants            jsonb not null,
  created_at          timestamptz not null default now()
);

create index pattern_drills_origin_idx on public.pattern_drills (origin_sentence_id);

-- ---------------------------------------------------------------------------
-- vocab_entries
-- ---------------------------------------------------------------------------
-- Word is stored lowercased + trimmed and acts as the natural PK.
create table public.vocab_entries (
  word                 text primary key,
  pos                  text,
  meaning_ko           text,
  ipa                  text,
  etymology            jsonb,
  mnemonic             jsonb,
  example_sentence_ids uuid[] default '{}',
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sentences_touch_updated_at
  before update on public.sentences
  for each row execute function public.tg_touch_updated_at();

create trigger vocab_entries_touch_updated_at
  before update on public.vocab_entries
  for each row execute function public.tg_touch_updated_at();
