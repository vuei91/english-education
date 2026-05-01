-- Migration: 왕초보 영어 1강 문장 — "누가 + 어쩐다 + 뭐를"
--
-- Step 1 (phrase)       : 주어+동사 구 반복 — "I love", "You like" 등
-- Step 2 (conjugation)  : 목적격 대명사 교체 — "Love me" → "Love him" → "Love her"
-- Step 3 (substitution) : 긍정→부정 전환 + 3인칭 -s — "I like" → "I don't like" / "He likes" → "He doesn't like"
--
-- 모든 문장은 자체 제작 (CC0). 한국어 번역은 의미 번역.
-- 한→영 발화 연습(ko-to-en 모드)을 위해 text_ko 는 모든 문장에 필수 제공.
--
-- Step ID 참조:
--   phrase       = c0000001-0001-0001-0001-000000009001
--   conjugation  = c0000001-0001-0001-0001-000000009002
--   substitution = c0000001-0001-0001-0001-000000009003

-- =========================================================================
-- Step 1: Phrase — 주어+동사 구 (is_phrase=true)
-- 강의 핵심: "누가 + 어쩐다"를 먼저 뱉는 훈련
-- =========================================================================

INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'I love',       '나는 사랑해',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009001', true),
  ('A', 'You like',     '너는 좋아해',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009001', true),
  ('A', 'She wants',    '그녀는 원해',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009001', true),
  ('A', 'He needs',     '그는 필요해',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009001', true),
  ('A', 'We have',      '우리는 가지고 있어', 'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009001', true),
  ('A', 'They know',    '그들은 알아',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009001', true);

-- =========================================================================
-- Step 2: Conjugation — 인칭별 목적격 대명사 교체
-- 강의 핵심: "Love me", "Love you", "Love him" 등 동사 뒤 목적격 붙이기
-- =========================================================================

INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  -- love + 목적격 풀
  ('A', 'I love you.',      '나는 너를 사랑해.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009002', false),
  ('A', 'I love him.',      '나는 그를 사랑해.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009002', false),
  ('A', 'I love her.',      '나는 그녀를 사랑해.',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009002', false),
  ('A', 'She loves me.',    '그녀는 나를 사랑해.',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009002', false),
  ('A', 'She loves him.',   '그녀는 그를 사랑해.',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009002', false),
  ('A', 'He loves us.',     '그는 우리를 사랑해.',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009002', false),
  -- like + 목적격/명사 풀
  ('A', 'I like you.',      '나는 너를 좋아해.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009002', false),
  ('A', 'You like me.',     '너는 나를 좋아해.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009002', false),
  ('A', 'I like coffee.',   '나는 커피를 좋아해.',   'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009002', false),
  ('A', 'He likes pizza.',  '그는 피자를 좋아해.',   'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009002', false),
  -- want / need + 목적격/명사 풀
  ('A', 'I want coffee.',   '나는 커피를 원해.',     'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009002', false),
  ('A', 'She wants pizza.', '그녀는 피자를 원해.',   'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009002', false);

-- =========================================================================
-- Step 3: Substitution — 긍정→부정 전환 + 3인칭 -s 규칙
-- 강의 핵심: don't / doesn't 사용법 + He/She 동사 -s 규칙
-- =========================================================================

INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  -- 긍정 → 부정 (1·2인칭: don't)
  ('A', 'I like coffee.',               '나는 커피를 좋아해.',         'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009003', false),
  ('A', 'I don''t like coffee.',         '나는 커피를 안 좋아해.',     'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009003', false),
  ('A', 'You want pizza.',              '너는 피자를 원해.',           'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009003', false),
  ('A', 'You don''t want pizza.',        '너는 피자를 안 원해.',       'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009003', false),
  ('A', 'I need help.',                 '나는 도움이 필요해.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009003', false),
  ('A', 'I don''t need help.',           '나는 도움이 필요 없어.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009003', false),
  -- 긍정 → 부정 (3인칭: doesn't + 동사 원형 복원)
  ('A', 'He likes coffee.',             '그는 커피를 좋아해.',         'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009003', false),
  ('A', 'He doesn''t like coffee.',      '그는 커피를 안 좋아해.',     'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009003', false),
  ('A', 'She wants water.',             '그녀는 물을 원해.',           'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009003', false),
  ('A', 'She doesn''t want water.',      '그녀는 물을 안 원해.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009003', false),
  -- 혼합 연습 (긍정/부정 섞어서)
  ('A', 'We love him.',                 '우리는 그를 사랑해.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009003', false),
  ('A', 'They don''t know her.',         '그들은 그녀를 몰라.',        'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000009003', false);
