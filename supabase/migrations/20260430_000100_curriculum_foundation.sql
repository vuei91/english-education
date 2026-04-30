-- Migration: curriculum foundation — 5개 신규 테이블 생성
--
-- Scope (Task 1.1):
--   - vocab_pack, vocab_pack_entry, curriculum_unit, curriculum_step,
--     curriculum_unit_prerequisite 테이블과 CHECK 제약을
--     .kiro/specs/curriculum-foundation/design.md §Data Model 그대로 적재.
--
-- 본 마이그레이션에서 다루지 않는 것:
--   - RLS 정책                      → Task 1.2
--   - sentences 테이블 확장          → Task 1.3
--   - pick_next_sentence RPC 재생성  → Task 2.x
--   - A1 단원 시드 데이터            → Task 12, 13
--
-- FK 의존 순서: vocab_pack → vocab_pack_entry → curriculum_unit
--               → curriculum_step / curriculum_unit_prerequisite

-- gen_random_uuid() 를 위한 pgcrypto 확인 (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- vocab_pack — 단원에 딸린 15~25개 어휘·덩어리 묶음
-- Req 1.7
-- ---------------------------------------------------------------------------
CREATE TABLE vocab_pack (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ko        text NOT NULL,
  size            integer NOT NULL CHECK (size BETWEEN 15 AND 25),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- vocab_pack_entry — 팩 안의 한 항목 (단어 또는 덩어리)
-- Req 1.8, 1.9, 1.10, 1.11
-- ---------------------------------------------------------------------------
CREATE TABLE vocab_pack_entry (
  pack_id         uuid NOT NULL REFERENCES vocab_pack(id) ON DELETE CASCADE,
  word            text NOT NULL,
  is_chunk        boolean NOT NULL DEFAULT false,
  pos             text NOT NULL
                  CHECK (pos IN ('noun','verb','adj','chunk')),
  role            text NOT NULL
                  CHECK (role IN ('new','review')),
  phrasal_of      text,
  collocates      text[],
  PRIMARY KEY (pack_id, word),
  CHECK ((is_chunk = true) = (pos = 'chunk'))
);

-- ---------------------------------------------------------------------------
-- curriculum_unit — 커리큘럼의 원자 단위
-- Req 1.1, 1.2, 1.3
-- ---------------------------------------------------------------------------
CREATE TABLE curriculum_unit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index     integer NOT NULL UNIQUE,
  title_ko        text NOT NULL,
  cefr_level      text NOT NULL
                  CHECK (cefr_level IN ('A1','A2','B1','B2')),
  opens_track     text
                  CHECK (opens_track IN ('tense','sentence_type','verbal','conjunction')),
  opens_point     text,
  vocab_pack_id   uuid NOT NULL REFERENCES vocab_pack(id) ON DELETE RESTRICT,
  theme           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK ((opens_track IS NULL) = (opens_point IS NULL))
);

-- ---------------------------------------------------------------------------
-- curriculum_step — 단원 내 학습 단계 (phrase/conjugation/substitution)
-- Req 1.4, 1.5
-- ---------------------------------------------------------------------------
CREATE TABLE curriculum_step (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid NOT NULL REFERENCES curriculum_unit(id) ON DELETE CASCADE,
  step_type       text NOT NULL
                  CHECK (step_type IN ('phrase','conjugation','substitution')),
  order_index     integer NOT NULL
                  CHECK (order_index IN (1,2,3)),
  UNIQUE (unit_id, step_type),
  UNIQUE (unit_id, order_index)
);

-- ---------------------------------------------------------------------------
-- curriculum_unit_prerequisite — 단원 간 선행 관계 (다대다)
-- Req 1.6
-- ---------------------------------------------------------------------------
CREATE TABLE curriculum_unit_prerequisite (
  unit_id         uuid NOT NULL REFERENCES curriculum_unit(id) ON DELETE CASCADE,
  prerequisite_id uuid NOT NULL REFERENCES curriculum_unit(id) ON DELETE CASCADE,
  PRIMARY KEY (unit_id, prerequisite_id),
  CHECK (unit_id <> prerequisite_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security (Task 1.2 / Req 1.12)
--
-- 커리큘럼 콘텐츠는 공개 메타 성격이므로 `authenticated` 역할의 `SELECT` 만
-- 허용한다. `anon` 은 로그인 전 상태 — 커리큘럼 조회는 로그인 이후 기능이므로
-- 부여하지 않는다. (기존 sentences/chunks 등 콘텐츠 테이블과 달리 익명 브라우징
-- 대상이 아니다.)
--
-- 쓰기(INSERT/UPDATE/DELETE) 정책은 의도적으로 생성하지 않는다. RLS 가 켜진
-- 테이블에서 대응 정책이 없는 작업은 기본 거부되므로, 쓰기는 Service Role
-- (마이그레이션 / 관리자 도구) 만 수행 가능하다.
-- ---------------------------------------------------------------------------

ALTER TABLE vocab_pack ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_pack_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_unit ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_unit_prerequisite ENABLE ROW LEVEL SECURITY;

CREATE POLICY vocab_pack_select
  ON vocab_pack FOR SELECT TO authenticated USING (true);

CREATE POLICY vocab_pack_entry_select
  ON vocab_pack_entry FOR SELECT TO authenticated USING (true);

CREATE POLICY curriculum_unit_select
  ON curriculum_unit FOR SELECT TO authenticated USING (true);

CREATE POLICY curriculum_step_select
  ON curriculum_step FOR SELECT TO authenticated USING (true);

CREATE POLICY curriculum_unit_prerequisite_select
  ON curriculum_unit_prerequisite FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- sentences 확장 (Task 1.3 / Req 2.1, 2.2, 2.3, 2.4, 2.5)
--
-- 기존 `public.sentences` (20260429_000100_content_tables.sql 에서 생성) 에
-- 커리큘럼 연결 컬럼 두 개를 추가한다.
--
--   - curriculum_step_id : 해당 Sentence 가 소속된 Curriculum_Step. NULL 허용
--                          (기존 문장은 커리큘럼과 무관하게 존재할 수 있다).
--                          ON DELETE SET NULL — 단계 삭제가 문장 물리 삭제로
--                          전파되지 않도록 (Req 2.5).
--   - is_phrase          : Step_Phrase 여부. true 면 마침표 없는 구 허용
--                          (Req 2.3). 기본값 false 로 기존 행은 그대로 문장
--                          형태로 취급 (Req 2.4).
--
-- Req 2.4 "기존 행은 디폴트로 채움" 은 다음으로 자동 충족된다:
--   - is_phrase          : NOT NULL DEFAULT false → 기존 행 자동 false
--   - curriculum_step_id : nullable, 기본값 없음  → 기존 행 자동 NULL
-- 별도 UPDATE 문이 필요 없다.
--
-- 부분 인덱스는 curriculum_step_id 가 NULL 이 아닌 행만 색인한다.
-- 기존 문장 대다수는 NULL 이므로 전체 인덱스는 낭비 — 커리큘럼 step 기준
-- 필터 (pick_next_sentence Task 2.x) 의 성능을 위해 부분 인덱스로 충분하다.
-- ---------------------------------------------------------------------------

ALTER TABLE public.sentences
  ADD COLUMN curriculum_step_id uuid
    REFERENCES public.curriculum_step(id) ON DELETE SET NULL,
  ADD COLUMN is_phrase boolean NOT NULL DEFAULT false;

CREATE INDEX idx_sentences_curriculum_step
  ON public.sentences (curriculum_step_id)
  WHERE curriculum_step_id IS NOT NULL;
