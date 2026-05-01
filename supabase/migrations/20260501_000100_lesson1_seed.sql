-- Migration: 왕초보 영어 1강 — "누가 + 어쩐다 + 뭐를" 기초 문형
--
-- 이시원의 왕초보 영어 1강 내용을 SentenceFlow 커리큘럼으로 변환.
-- 강의 핵심:
--   1. 주어+동사 먼저 뱉기 (I love, You like, She wants)
--   2. 목적격 대명사 교체 (Love me → Love him → Love her)
--   3. 부정문 don't / doesn't + 3인칭 -s 규칙
--
-- 커리큘럼 매핑:
--   Step 1 (phrase)       → 주어+동사 구 반복
--   Step 2 (conjugation)  → 인칭별 목적격 교체
--   Step 3 (substitution) → 긍정→부정 전환 + 3인칭 규칙
--
-- 모든 문장은 자체 제작 (CC0). 기존 교재 콘텐츠 직접 복제 아님.
-- 방법론만 차용: "누가+어쩐다" 순서로 영어를 말하는 훈련법.

-- =========================================================================
-- 1. vocab_pack (15 new words — CHECK 제약 15~25 충족)
-- =========================================================================

INSERT INTO vocab_pack (id, title_ko, size) VALUES
  ('a0000001-0001-0001-0001-000000000009', '누가+어쩐다+뭐를 · 기초 문형', 18)
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- 2. vocab_pack_entry — 기초 동사 + 인칭 대명사 + 일상 명사
-- =========================================================================

INSERT INTO vocab_pack_entry (pack_id, word, is_chunk, pos, role, phrasal_of, collocates) VALUES
  -- 핵심 동사 (new)
  ('a0000001-0001-0001-0001-000000000009', 'love',     false, 'verb', 'new', NULL, ARRAY['me','you','him','her']),
  ('a0000001-0001-0001-0001-000000000009', 'like',     false, 'verb', 'new', NULL, ARRAY['coffee','pizza','music']),
  ('a0000001-0001-0001-0001-000000000009', 'want',     false, 'verb', 'new', NULL, ARRAY['water','coffee','pizza']),
  ('a0000001-0001-0001-0001-000000000009', 'need',     false, 'verb', 'new', NULL, ARRAY['help','water','time']),
  ('a0000001-0001-0001-0001-000000000009', 'have',     false, 'verb', 'new', NULL, ARRAY['coffee','time','money']),
  ('a0000001-0001-0001-0001-000000000009', 'know',     false, 'verb', 'new', NULL, ARRAY['him','her','English']),
  -- 인칭 대명사 (new — schema에 pronoun 없으므로 noun)
  ('a0000001-0001-0001-0001-000000000009', 'I',        false, 'noun', 'new', NULL, ARRAY['love','like','want']),
  ('a0000001-0001-0001-0001-000000000009', 'you',      false, 'noun', 'new', NULL, ARRAY['love','like','want']),
  ('a0000001-0001-0001-0001-000000000009', 'he',       false, 'noun', 'new', NULL, ARRAY['loves','likes','wants']),
  ('a0000001-0001-0001-0001-000000000009', 'she',      false, 'noun', 'new', NULL, ARRAY['loves','likes','wants']),
  ('a0000001-0001-0001-0001-000000000009', 'we',       false, 'noun', 'new', NULL, ARRAY['love','like','want']),
  ('a0000001-0001-0001-0001-000000000009', 'they',     false, 'noun', 'new', NULL, ARRAY['love','like','want']),
  -- 목적격 대명사 (new)
  ('a0000001-0001-0001-0001-000000000009', 'me',       false, 'noun', 'new', NULL, ARRAY['love','help']),
  ('a0000001-0001-0001-0001-000000000009', 'him',      false, 'noun', 'new', NULL, ARRAY['love','know']),
  ('a0000001-0001-0001-0001-000000000009', 'her',      false, 'noun', 'new', NULL, ARRAY['love','know']),
  ('a0000001-0001-0001-0001-000000000009', 'us',       false, 'noun', 'new', NULL, ARRAY['love','help']),
  -- 일상 명사 (new)
  ('a0000001-0001-0001-0001-000000000009', 'coffee',   false, 'noun', 'new', NULL, ARRAY['like','want','drink']),
  ('a0000001-0001-0001-0001-000000000009', 'pizza',    false, 'noun', 'new', NULL, ARRAY['like','want','eat'])
ON CONFLICT (pack_id, word) DO NOTHING;

-- =========================================================================
-- 3. curriculum_unit — order_index 9 (기존 8개 뒤)
-- =========================================================================

INSERT INTO curriculum_unit
  (id, order_index, title_ko, cefr_level, opens_track, opens_point, vocab_pack_id, theme) VALUES
  ('b0000001-0001-0001-0001-000000000009', 9,
   '누가+어쩐다+뭐를 · 기초 문형',
   'A1', 'tense', 'T0',
   'a0000001-0001-0001-0001-000000000009', 'basic_sentence')
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- 4. curriculum_step — 3개 스텝
-- =========================================================================

INSERT INTO curriculum_step (id, unit_id, step_type, order_index) VALUES
  ('c0000001-0001-0001-0001-000000009001', 'b0000001-0001-0001-0001-000000000009', 'phrase',       1),
  ('c0000001-0001-0001-0001-000000009002', 'b0000001-0001-0001-0001-000000000009', 'conjugation',  2),
  ('c0000001-0001-0001-0001-000000009003', 'b0000001-0001-0001-0001-000000000009', 'substitution', 3)
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- 5. curriculum_unit_prerequisite — 선행 없음 (완전 초보 진입점)
-- =========================================================================
-- (없음 — 이 단원은 선행 조건 없이 바로 시작 가능)
