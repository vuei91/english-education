-- Migration: curriculum A1 seed — 8개 단원 · 8개 vocab pack · 24개 step · prerequisites
--
-- Scope (Tasks 12.1 ~ 13.4 / Req 4.1 ~ 4.8):
--   - A1 단원 8개의 `vocab_pack` + `vocab_pack_entry` 적재
--   - A1 단원 8개의 `curriculum_unit` 적재 (order_index 1~8)
--   - 각 단원에 `curriculum_step` 3개(phrase/conjugation/substitution)
--   - `curriculum_unit_prerequisite` 로 선행 관계 적재
--
-- 이 파일은 Sentence 를 적재하지 않는다 — Req 4.8 가드. 실제 문장 콘텐츠는
-- 후속 스펙의 `curriculum-content-pipeline` 에서 생성한다. (검증: 이 파일에
-- `INSERT INTO sentences` 문자열이 등장하지 않아야 한다.)
--
-- 적재 순서 (FK 의존):
--   1. vocab_pack
--   2. vocab_pack_entry
--   3. curriculum_unit        (vocab_pack.id 참조)
--   4. curriculum_step        (curriculum_unit.id 참조)
--   5. curriculum_unit_prerequisite (curriculum_unit.id × 2 참조)
--
-- 모든 INSERT 는 `ON CONFLICT DO NOTHING` 으로 idempotent 하다. 고정 UUID 를
-- 사용하므로 같은 마이그레이션을 여러 번 돌려도 중복이 생기지 않는다.
--
-- 단원 시퀀스: docs/curriculum.md §5-1 A1 목차
--   1. T1·S1 긍정 현재형  · drink + 음료              · prereq: —
--   2. (팩만 확장)          · eat + 음식                · prereq: 1
--   3. (팩만 확장)          · have + 소지품              · prereq: 1, 2
--   4. T2 3인칭 단수 -s     · drink/eat/have 재사용      · prereq: 1, 2, 3
--   5. S2 부정문            · 이전 팩 재활용             · prereq: 1, 2, 3, 4
--   6. S3 Yes/No 의문문     · 일상 행동 팩                · prereq: 1~5
--   7. S4 Wh- 의문문        · 장소·시간 팩                · prereq: 6
--   8. S5 명령문            · 길 안내·부탁 팩             · prereq: 1~7
--
-- 팩 구성은 `#vocab-pack-builder` 원칙을 따른다:
--   - 팩당 15~25 단어
--   - 단원 1 이후 20~30% review 재활용
--   - 콜로케이션·구동사는 `is_chunk=true`, `pos='chunk'` 로 통째 등록

-- ---------------------------------------------------------------------------
-- vocab_pack (Task 12.1 / Req 4.6)
-- ---------------------------------------------------------------------------

INSERT INTO vocab_pack (id, title_ko, size) VALUES
  ('a0000001-0001-0001-0001-000000000001', 'drink + 음료',             20),
  ('a0000001-0001-0001-0001-000000000002', 'eat + 음식',               20),
  ('a0000001-0001-0001-0001-000000000003', 'have + 소지품',             20),
  ('a0000001-0001-0001-0001-000000000004', '3인칭 · 일상 동사·장소',     18),
  ('a0000001-0001-0001-0001-000000000005', '부정문 · 선호·상태',         18),
  ('a0000001-0001-0001-0001-000000000006', '일상 행동 · Yes/No',         20),
  ('a0000001-0001-0001-0001-000000000007', '장소·시간 · Wh-',           20),
  ('a0000001-0001-0001-0001-000000000008', '길 안내·부탁 · 명령문',      21)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- vocab_pack_entry — Pack 1: drink + 음료 (20 new, 0 review)
-- ---------------------------------------------------------------------------

INSERT INTO vocab_pack_entry (pack_id, word, is_chunk, pos, role, phrasal_of, collocates) VALUES
  ('a0000001-0001-0001-0001-000000000001', 'coffee',        false, 'noun',  'new', NULL, ARRAY['drink','have','hot']),
  ('a0000001-0001-0001-0001-000000000001', 'tea',           false, 'noun',  'new', NULL, ARRAY['drink','have','hot']),
  ('a0000001-0001-0001-0001-000000000001', 'water',         false, 'noun',  'new', NULL, ARRAY['drink','cold']),
  ('a0000001-0001-0001-0001-000000000001', 'juice',         false, 'noun',  'new', NULL, ARRAY['drink','cold','sweet']),
  ('a0000001-0001-0001-0001-000000000001', 'milk',          false, 'noun',  'new', NULL, ARRAY['drink','cold']),
  ('a0000001-0001-0001-0001-000000000001', 'soda',          false, 'noun',  'new', NULL, ARRAY['drink','cold']),
  ('a0000001-0001-0001-0001-000000000001', 'beer',          false, 'noun',  'new', NULL, ARRAY['drink','cold']),
  ('a0000001-0001-0001-0001-000000000001', 'wine',          false, 'noun',  'new', NULL, ARRAY['drink']),
  ('a0000001-0001-0001-0001-000000000001', 'drink',         false, 'verb',  'new', NULL, ARRAY['coffee','tea','water']),
  ('a0000001-0001-0001-0001-000000000001', 'have',          false, 'verb',  'new', NULL, ARRAY['coffee','tea']),
  ('a0000001-0001-0001-0001-000000000001', 'order',         false, 'verb',  'new', NULL, ARRAY['coffee','tea']),
  ('a0000001-0001-0001-0001-000000000001', 'pour',          false, 'verb',  'new', NULL, ARRAY['water','tea']),
  ('a0000001-0001-0001-0001-000000000001', 'finish',        false, 'verb',  'new', NULL, ARRAY['coffee','water']),
  ('a0000001-0001-0001-0001-000000000001', 'hot',           false, 'adj',   'new', NULL, ARRAY['coffee','tea']),
  ('a0000001-0001-0001-0001-000000000001', 'cold',          false, 'adj',   'new', NULL, ARRAY['water','milk']),
  ('a0000001-0001-0001-0001-000000000001', 'sweet',         false, 'adj',   'new', NULL, ARRAY['juice','tea']),
  ('a0000001-0001-0001-0001-000000000001', 'strong',        false, 'adj',   'new', NULL, ARRAY['coffee','tea']),
  ('a0000001-0001-0001-0001-000000000001', 'bitter',        false, 'adj',   'new', NULL, ARRAY['coffee','tea']),
  ('a0000001-0001-0001-0001-000000000001', 'have coffee',   true,  'chunk', 'new', 'have', ARRAY['coffee']),
  ('a0000001-0001-0001-0001-000000000001', 'cup of tea',    true,  'chunk', 'new', NULL, ARRAY['tea'])
ON CONFLICT (pack_id, word) DO NOTHING;

-- ---------------------------------------------------------------------------
-- vocab_pack_entry — Pack 2: eat + 음식 (15 new + 5 review = 25% ratio)
-- review 출처: Pack 1 (coffee, drink, hot, cold, finish)
-- ---------------------------------------------------------------------------

INSERT INTO vocab_pack_entry (pack_id, word, is_chunk, pos, role, phrasal_of, collocates) VALUES
  -- new
  ('a0000001-0001-0001-0001-000000000002', 'pizza',          false, 'noun',  'new',    NULL, ARRAY['eat','have','delicious']),
  ('a0000001-0001-0001-0001-000000000002', 'rice',           false, 'noun',  'new',    NULL, ARRAY['eat','have']),
  ('a0000001-0001-0001-0001-000000000002', 'bread',          false, 'noun',  'new',    NULL, ARRAY['eat','fresh']),
  ('a0000001-0001-0001-0001-000000000002', 'meat',           false, 'noun',  'new',    NULL, ARRAY['eat','cook']),
  ('a0000001-0001-0001-0001-000000000002', 'chicken',        false, 'noun',  'new',    NULL, ARRAY['eat','cook']),
  ('a0000001-0001-0001-0001-000000000002', 'egg',            false, 'noun',  'new',    NULL, ARRAY['eat','cook']),
  ('a0000001-0001-0001-0001-000000000002', 'salad',          false, 'noun',  'new',    NULL, ARRAY['eat','fresh']),
  ('a0000001-0001-0001-0001-000000000002', 'eat',            false, 'verb',  'new',    NULL, ARRAY['pizza','rice','bread']),
  ('a0000001-0001-0001-0001-000000000002', 'want',           false, 'verb',  'new',    NULL, ARRAY['pizza','coffee']),
  ('a0000001-0001-0001-0001-000000000002', 'cook',           false, 'verb',  'new',    NULL, ARRAY['rice','chicken']),
  ('a0000001-0001-0001-0001-000000000002', 'delicious',      false, 'adj',   'new',    NULL, ARRAY['pizza','rice']),
  ('a0000001-0001-0001-0001-000000000002', 'fresh',          false, 'adj',   'new',    NULL, ARRAY['bread','salad']),
  ('a0000001-0001-0001-0001-000000000002', 'spicy',          false, 'adj',   'new',    NULL, ARRAY['chicken','rice']),
  ('a0000001-0001-0001-0001-000000000002', 'have breakfast', true,  'chunk', 'new',    'have', ARRAY['bread','egg']),
  ('a0000001-0001-0001-0001-000000000002', 'have lunch',     true,  'chunk', 'new',    'have', ARRAY['pizza','rice']),
  -- review (from Pack 1)
  ('a0000001-0001-0001-0001-000000000002', 'coffee',         false, 'noun',  'review', NULL, ARRAY['drink']),
  ('a0000001-0001-0001-0001-000000000002', 'drink',          false, 'verb',  'review', NULL, ARRAY['water','juice']),
  ('a0000001-0001-0001-0001-000000000002', 'hot',            false, 'adj',   'review', NULL, ARRAY['pizza','coffee']),
  ('a0000001-0001-0001-0001-000000000002', 'cold',           false, 'adj',   'review', NULL, ARRAY['water','salad']),
  ('a0000001-0001-0001-0001-000000000002', 'finish',         false, 'verb',  'review', NULL, ARRAY['pizza','rice'])
ON CONFLICT (pack_id, word) DO NOTHING;

-- ---------------------------------------------------------------------------
-- vocab_pack_entry — Pack 3: have + 소지품 (15 new + 5 review = 25% ratio)
-- review 출처: Pack 1 (have), Pack 2 (want, rice, bread, delicious)
-- ---------------------------------------------------------------------------

INSERT INTO vocab_pack_entry (pack_id, word, is_chunk, pos, role, phrasal_of, collocates) VALUES
  -- new
  ('a0000001-0001-0001-0001-000000000003', 'phone',          false, 'noun',  'new',    NULL, ARRAY['have','use','new']),
  ('a0000001-0001-0001-0001-000000000003', 'bag',            false, 'noun',  'new',    NULL, ARRAY['have','carry','heavy']),
  ('a0000001-0001-0001-0001-000000000003', 'book',           false, 'noun',  'new',    NULL, ARRAY['have','read','new']),
  ('a0000001-0001-0001-0001-000000000003', 'pen',            false, 'noun',  'new',    NULL, ARRAY['have','use']),
  ('a0000001-0001-0001-0001-000000000003', 'key',            false, 'noun',  'new',    NULL, ARRAY['have','need']),
  ('a0000001-0001-0001-0001-000000000003', 'wallet',         false, 'noun',  'new',    NULL, ARRAY['have','carry']),
  ('a0000001-0001-0001-0001-000000000003', 'watch',          false, 'noun',  'new',    NULL, ARRAY['have','new']),
  ('a0000001-0001-0001-0001-000000000003', 'umbrella',       false, 'noun',  'new',    NULL, ARRAY['have','carry']),
  ('a0000001-0001-0001-0001-000000000003', 'carry',          false, 'verb',  'new',    NULL, ARRAY['bag','umbrella']),
  ('a0000001-0001-0001-0001-000000000003', 'need',           false, 'verb',  'new',    NULL, ARRAY['key','phone']),
  ('a0000001-0001-0001-0001-000000000003', 'use',            false, 'verb',  'new',    NULL, ARRAY['phone','pen']),
  ('a0000001-0001-0001-0001-000000000003', 'new',            false, 'adj',   'new',    NULL, ARRAY['phone','book']),
  ('a0000001-0001-0001-0001-000000000003', 'old',            false, 'adj',   'new',    NULL, ARRAY['book','watch']),
  ('a0000001-0001-0001-0001-000000000003', 'heavy',          false, 'adj',   'new',    NULL, ARRAY['bag','book']),
  ('a0000001-0001-0001-0001-000000000003', 'take a picture', true,  'chunk', 'new',    'take', ARRAY['phone']),
  -- review
  ('a0000001-0001-0001-0001-000000000003', 'have',           false, 'verb',  'review', NULL, ARRAY['phone','bag']),
  ('a0000001-0001-0001-0001-000000000003', 'want',           false, 'verb',  'review', NULL, ARRAY['phone','book']),
  ('a0000001-0001-0001-0001-000000000003', 'rice',           false, 'noun',  'review', NULL, ARRAY['eat']),
  ('a0000001-0001-0001-0001-000000000003', 'bread',          false, 'noun',  'review', NULL, ARRAY['eat']),
  ('a0000001-0001-0001-0001-000000000003', 'delicious',      false, 'adj',   'review', NULL, ARRAY['pizza'])
ON CONFLICT (pack_id, word) DO NOTHING;

-- ---------------------------------------------------------------------------
-- vocab_pack_entry — Pack 4: 3인칭 · 일상 동사·장소 (13 new + 5 review = 28% ratio)
-- review 출처: drink (P1), eat, pizza (P2), coffee (P2 review), have (P3 review)
-- ---------------------------------------------------------------------------

INSERT INTO vocab_pack_entry (pack_id, word, is_chunk, pos, role, phrasal_of, collocates) VALUES
  -- new (pronouns for 3rd person singular — stored as 'noun' since schema lacks pronoun)
  ('a0000001-0001-0001-0001-000000000004', 'he',             false, 'noun',  'new',    NULL, ARRAY['goes','comes']),
  ('a0000001-0001-0001-0001-000000000004', 'she',            false, 'noun',  'new',    NULL, ARRAY['goes','comes']),
  ('a0000001-0001-0001-0001-000000000004', 'it',             false, 'noun',  'new',    NULL, ARRAY['works']),
  ('a0000001-0001-0001-0001-000000000004', 'go',             false, 'verb',  'new',    NULL, ARRAY['home','school','park']),
  ('a0000001-0001-0001-0001-000000000004', 'come',           false, 'verb',  'new',    NULL, ARRAY['home','here']),
  ('a0000001-0001-0001-0001-000000000004', 'play',           false, 'verb',  'new',    NULL, ARRAY['park','game']),
  ('a0000001-0001-0001-0001-000000000004', 'work',           false, 'verb',  'new',    NULL, ARRAY['home','office']),
  ('a0000001-0001-0001-0001-000000000004', 'home',           false, 'noun',  'new',    NULL, ARRAY['go','come']),
  ('a0000001-0001-0001-0001-000000000004', 'school',         false, 'noun',  'new',    NULL, ARRAY['go','study']),
  ('a0000001-0001-0001-0001-000000000004', 'park',           false, 'noun',  'new',    NULL, ARRAY['go','play']),
  ('a0000001-0001-0001-0001-000000000004', 'movie',          false, 'noun',  'new',    NULL, ARRAY['watch','see']),
  ('a0000001-0001-0001-0001-000000000004', 'goes to school', true,  'chunk', 'new',    'go', ARRAY['he','she']),
  ('a0000001-0001-0001-0001-000000000004', 'comes home',     true,  'chunk', 'new',    'come', ARRAY['he','she']),
  -- review
  ('a0000001-0001-0001-0001-000000000004', 'drink',          false, 'verb',  'review', NULL, ARRAY['coffee']),
  ('a0000001-0001-0001-0001-000000000004', 'eat',            false, 'verb',  'review', NULL, ARRAY['pizza']),
  ('a0000001-0001-0001-0001-000000000004', 'have',           false, 'verb',  'review', NULL, ARRAY['phone']),
  ('a0000001-0001-0001-0001-000000000004', 'coffee',         false, 'noun',  'review', NULL, ARRAY['drink']),
  ('a0000001-0001-0001-0001-000000000004', 'pizza',          false, 'noun',  'review', NULL, ARRAY['eat'])
ON CONFLICT (pack_id, word) DO NOTHING;

-- ---------------------------------------------------------------------------
-- vocab_pack_entry — Pack 5: 부정문 · 선호·상태 (13 new + 5 review = 28% ratio)
-- review 출처: go, work (P4), eat, drink (P4 review), meat (P2)
-- ---------------------------------------------------------------------------

INSERT INTO vocab_pack_entry (pack_id, word, is_chunk, pos, role, phrasal_of, collocates) VALUES
  -- new
  ('a0000001-0001-0001-0001-000000000005', 'like',           false, 'verb',  'new',    NULL, ARRAY['coffee','pizza','park']),
  ('a0000001-0001-0001-0001-000000000005', 'know',           false, 'verb',  'new',    NULL, ARRAY['answer','story']),
  ('a0000001-0001-0001-0001-000000000005', 'understand',     false, 'verb',  'new',    NULL, ARRAY['English','Korean']),
  ('a0000001-0001-0001-0001-000000000005', 'Korean',         false, 'noun',  'new',    NULL, ARRAY['speak','understand']),
  ('a0000001-0001-0001-0001-000000000005', 'English',        false, 'noun',  'new',    NULL, ARRAY['speak','understand']),
  ('a0000001-0001-0001-0001-000000000005', 'job',            false, 'noun',  'new',    NULL, ARRAY['have','like']),
  ('a0000001-0001-0001-0001-000000000005', 'problem',        false, 'noun',  'new',    NULL, ARRAY['have','know']),
  ('a0000001-0001-0001-0001-000000000005', 'busy',           false, 'adj',   'new',    NULL, ARRAY['today','now']),
  ('a0000001-0001-0001-0001-000000000005', 'tired',          false, 'adj',   'new',    NULL, ARRAY['today']),
  ('a0000001-0001-0001-0001-000000000005', 'free',           false, 'adj',   'new',    NULL, ARRAY['today','now']),
  ('a0000001-0001-0001-0001-000000000005', 'difficult',      false, 'adj',   'new',    NULL, ARRAY['English','problem']),
  ('a0000001-0001-0001-0001-000000000005', 'get up',         true,  'chunk', 'new',    'get', ARRAY['early','late']),
  ('a0000001-0001-0001-0001-000000000005', 'go to bed',      true,  'chunk', 'new',    'go', ARRAY['late','early']),
  -- review
  ('a0000001-0001-0001-0001-000000000005', 'go',             false, 'verb',  'review', NULL, ARRAY['school']),
  ('a0000001-0001-0001-0001-000000000005', 'work',           false, 'verb',  'review', NULL, ARRAY['home']),
  ('a0000001-0001-0001-0001-000000000005', 'eat',            false, 'verb',  'review', NULL, ARRAY['pizza']),
  ('a0000001-0001-0001-0001-000000000005', 'drink',          false, 'verb',  'review', NULL, ARRAY['coffee']),
  ('a0000001-0001-0001-0001-000000000005', 'meat',           false, 'noun',  'review', NULL, ARRAY['eat'])
ON CONFLICT (pack_id, word) DO NOTHING;

-- ---------------------------------------------------------------------------
-- vocab_pack_entry — Pack 6: 일상 행동 · Yes/No (15 new + 5 review = 25% ratio)
-- review 출처: get up (P5), work, play (P4), he, she (P4)
-- ---------------------------------------------------------------------------

INSERT INTO vocab_pack_entry (pack_id, word, is_chunk, pos, role, phrasal_of, collocates) VALUES
  -- new
  ('a0000001-0001-0001-0001-000000000006', 'sleep',          false, 'verb',  'new',    NULL, ARRAY['early','late']),
  ('a0000001-0001-0001-0001-000000000006', 'wake',           false, 'verb',  'new',    NULL, ARRAY['early']),
  ('a0000001-0001-0001-0001-000000000006', 'run',            false, 'verb',  'new',    NULL, ARRAY['park','street']),
  ('a0000001-0001-0001-0001-000000000006', 'swim',           false, 'verb',  'new',    NULL, ARRAY['pool','sea']),
  ('a0000001-0001-0001-0001-000000000006', 'read',           false, 'verb',  'new',    NULL, ARRAY['book','newspaper']),
  ('a0000001-0001-0001-0001-000000000006', 'write',          false, 'verb',  'new',    NULL, ARRAY['letter','name']),
  ('a0000001-0001-0001-0001-000000000006', 'open',           false, 'verb',  'new',    NULL, ARRAY['door','window']),
  ('a0000001-0001-0001-0001-000000000006', 'close',          false, 'verb',  'new',    NULL, ARRAY['door','window']),
  ('a0000001-0001-0001-0001-000000000006', 'door',           false, 'noun',  'new',    NULL, ARRAY['open','close']),
  ('a0000001-0001-0001-0001-000000000006', 'window',         false, 'noun',  'new',    NULL, ARRAY['open','close']),
  ('a0000001-0001-0001-0001-000000000006', 'letter',         false, 'noun',  'new',    NULL, ARRAY['write','read']),
  ('a0000001-0001-0001-0001-000000000006', 'newspaper',      false, 'noun',  'new',    NULL, ARRAY['read']),
  ('a0000001-0001-0001-0001-000000000006', 'early',          false, 'adj',   'new',    NULL, ARRAY['wake','sleep']),
  ('a0000001-0001-0001-0001-000000000006', 'late',           false, 'adj',   'new',    NULL, ARRAY['sleep','go to bed']),
  ('a0000001-0001-0001-0001-000000000006', 'quiet',          false, 'adj',   'new',    NULL, ARRAY['room','street']),
  -- review
  ('a0000001-0001-0001-0001-000000000006', 'get up',         true,  'chunk', 'review', 'get', ARRAY['early','late']),
  ('a0000001-0001-0001-0001-000000000006', 'work',           false, 'verb',  'review', NULL, ARRAY['home']),
  ('a0000001-0001-0001-0001-000000000006', 'play',           false, 'verb',  'review', NULL, ARRAY['park']),
  ('a0000001-0001-0001-0001-000000000006', 'he',             false, 'noun',  'review', NULL, ARRAY['runs','reads']),
  ('a0000001-0001-0001-0001-000000000006', 'she',            false, 'noun',  'review', NULL, ARRAY['runs','reads'])
ON CONFLICT (pack_id, word) DO NOTHING;

-- ---------------------------------------------------------------------------
-- vocab_pack_entry — Pack 7: 장소·시간 · Wh- (15 new + 5 review = 25% ratio)
-- review 출처: go, come (P4), home, school, park (P4)
-- ---------------------------------------------------------------------------

INSERT INTO vocab_pack_entry (pack_id, word, is_chunk, pos, role, phrasal_of, collocates) VALUES
  -- new — 장소
  ('a0000001-0001-0001-0001-000000000007', 'station',        false, 'noun',  'new',    NULL, ARRAY['go','train']),
  ('a0000001-0001-0001-0001-000000000007', 'airport',        false, 'noun',  'new',    NULL, ARRAY['go','plane']),
  ('a0000001-0001-0001-0001-000000000007', 'hospital',       false, 'noun',  'new',    NULL, ARRAY['go','doctor']),
  ('a0000001-0001-0001-0001-000000000007', 'restaurant',     false, 'noun',  'new',    NULL, ARRAY['go','eat']),
  ('a0000001-0001-0001-0001-000000000007', 'market',         false, 'noun',  'new',    NULL, ARRAY['go','buy']),
  ('a0000001-0001-0001-0001-000000000007', 'office',         false, 'noun',  'new',    NULL, ARRAY['go','work']),
  ('a0000001-0001-0001-0001-000000000007', 'library',        false, 'noun',  'new',    NULL, ARRAY['go','read']),
  -- new — 시간
  ('a0000001-0001-0001-0001-000000000007', 'morning',        false, 'noun',  'new',    NULL, ARRAY['wake','eat']),
  ('a0000001-0001-0001-0001-000000000007', 'afternoon',      false, 'noun',  'new',    NULL, ARRAY['work','play']),
  ('a0000001-0001-0001-0001-000000000007', 'evening',        false, 'noun',  'new',    NULL, ARRAY['eat','rest']),
  ('a0000001-0001-0001-0001-000000000007', 'night',          false, 'noun',  'new',    NULL, ARRAY['sleep']),
  ('a0000001-0001-0001-0001-000000000007', 'today',          false, 'noun',  'new',    NULL, ARRAY['busy','free']),
  ('a0000001-0001-0001-0001-000000000007', 'tomorrow',       false, 'noun',  'new',    NULL, ARRAY['go','work']),
  ('a0000001-0001-0001-0001-000000000007', 'yesterday',      false, 'noun',  'new',    NULL, ARRAY['go','eat']),
  ('a0000001-0001-0001-0001-000000000007', 'now',            false, 'noun',  'new',    NULL, ARRAY['busy','free']),
  -- review
  ('a0000001-0001-0001-0001-000000000007', 'go',             false, 'verb',  'review', NULL, ARRAY['station','airport']),
  ('a0000001-0001-0001-0001-000000000007', 'come',           false, 'verb',  'review', NULL, ARRAY['home']),
  ('a0000001-0001-0001-0001-000000000007', 'home',           false, 'noun',  'review', NULL, ARRAY['go','come']),
  ('a0000001-0001-0001-0001-000000000007', 'school',         false, 'noun',  'review', NULL, ARRAY['go']),
  ('a0000001-0001-0001-0001-000000000007', 'park',           false, 'noun',  'review', NULL, ARRAY['go','play'])
ON CONFLICT (pack_id, word) DO NOTHING;

-- ---------------------------------------------------------------------------
-- vocab_pack_entry — Pack 8: 길 안내·부탁 · 명령문 (16 new + 5 review = 24% ratio)
-- review 출처: go, come (P4), home, school (P4), morning (P7)
-- ---------------------------------------------------------------------------

INSERT INTO vocab_pack_entry (pack_id, word, is_chunk, pos, role, phrasal_of, collocates) VALUES
  -- new
  ('a0000001-0001-0001-0001-000000000008', 'turn',           false, 'verb',  'new',    NULL, ARRAY['left','right']),
  ('a0000001-0001-0001-0001-000000000008', 'stop',           false, 'verb',  'new',    NULL, ARRAY['here','now']),
  ('a0000001-0001-0001-0001-000000000008', 'help',           false, 'verb',  'new',    NULL, ARRAY['please']),
  ('a0000001-0001-0001-0001-000000000008', 'call',           false, 'verb',  'new',    NULL, ARRAY['taxi','me']),
  ('a0000001-0001-0001-0001-000000000008', 'listen',         false, 'verb',  'new',    NULL, ARRAY['carefully']),
  ('a0000001-0001-0001-0001-000000000008', 'walk',           false, 'verb',  'new',    NULL, ARRAY['slow','street']),
  ('a0000001-0001-0001-0001-000000000008', 'left',           false, 'noun',  'new',    NULL, ARRAY['turn']),
  ('a0000001-0001-0001-0001-000000000008', 'right',          false, 'noun',  'new',    NULL, ARRAY['turn']),
  ('a0000001-0001-0001-0001-000000000008', 'street',         false, 'noun',  'new',    NULL, ARRAY['walk','cross']),
  ('a0000001-0001-0001-0001-000000000008', 'corner',         false, 'noun',  'new',    NULL, ARRAY['turn']),
  ('a0000001-0001-0001-0001-000000000008', 'minute',         false, 'noun',  'new',    NULL, ARRAY['wait']),
  ('a0000001-0001-0001-0001-000000000008', 'careful',        false, 'adj',   'new',    NULL, ARRAY['walk','listen']),
  ('a0000001-0001-0001-0001-000000000008', 'slow',           false, 'adj',   'new',    NULL, ARRAY['walk','careful']),
  ('a0000001-0001-0001-0001-000000000008', 'ready',          false, 'adj',   'new',    NULL, ARRAY['go']),
  ('a0000001-0001-0001-0001-000000000008', 'take a taxi',    true,  'chunk', 'new',    'take', ARRAY['call']),
  ('a0000001-0001-0001-0001-000000000008', 'go straight',    true,  'chunk', 'new',    'go', ARRAY['turn']),
  -- review
  ('a0000001-0001-0001-0001-000000000008', 'go',             false, 'verb',  'review', NULL, ARRAY['straight','left']),
  ('a0000001-0001-0001-0001-000000000008', 'come',           false, 'verb',  'review', NULL, ARRAY['home','here']),
  ('a0000001-0001-0001-0001-000000000008', 'home',           false, 'noun',  'review', NULL, ARRAY['go']),
  ('a0000001-0001-0001-0001-000000000008', 'school',         false, 'noun',  'review', NULL, ARRAY['go']),
  ('a0000001-0001-0001-0001-000000000008', 'morning',        false, 'noun',  'review', NULL, ARRAY['good'])
ON CONFLICT (pack_id, word) DO NOTHING;

-- ---------------------------------------------------------------------------
-- curriculum_unit (Task 13.1 / Req 4.1, 4.3~4.5)
--
-- order_index 1~8. opens 는 §5-1 기준:
--   - 1: T1 (단순현재 1·2인칭)              opens_track='tense', opens_point='T1'
--   - 2: 팩만 확장                          opens_track=NULL
--   - 3: 팩만 확장                          opens_track=NULL
--   - 4: T2 (3인칭 단수 -s)                 opens_track='tense', opens_point='T2'
--   - 5: S2 (부정문)                        opens_track='sentence_type', opens_point='S2'
--   - 6: S3 (Yes/No 의문문)                  opens_track='sentence_type', opens_point='S3'
--   - 7: S4 (Wh- 의문문)                    opens_track='sentence_type', opens_point='S4'
--   - 8: S5 (명령문)                        opens_track='sentence_type', opens_point='S5'
-- ---------------------------------------------------------------------------

INSERT INTO curriculum_unit
  (id, order_index, title_ko, cefr_level, opens_track, opens_point, vocab_pack_id, theme) VALUES
  ('b0000001-0001-0001-0001-000000000001', 1, '단순현재 1·2인칭 · drink + 음료',   'A1', 'tense',         'T1',   'a0000001-0001-0001-0001-000000000001', 'drink'),
  ('b0000001-0001-0001-0001-000000000002', 2, 'eat + 음식 (팩 확장)',              'A1', NULL,            NULL,   'a0000001-0001-0001-0001-000000000002', 'food'),
  ('b0000001-0001-0001-0001-000000000003', 3, 'have + 소지품 (팩 확장)',           'A1', NULL,            NULL,   'a0000001-0001-0001-0001-000000000003', 'belongings'),
  ('b0000001-0001-0001-0001-000000000004', 4, '3인칭 단수 -s',                     'A1', 'tense',         'T2',   'a0000001-0001-0001-0001-000000000004', 'daily'),
  ('b0000001-0001-0001-0001-000000000005', 5, '부정문 don''t / doesn''t',          'A1', 'sentence_type', 'S2',   'a0000001-0001-0001-0001-000000000005', 'preferences'),
  ('b0000001-0001-0001-0001-000000000006', 6, 'Yes/No 의문문',                     'A1', 'sentence_type', 'S3',   'a0000001-0001-0001-0001-000000000006', 'daily_actions'),
  ('b0000001-0001-0001-0001-000000000007', 7, 'Wh- 의문문 (what / where / when)',  'A1', 'sentence_type', 'S4',   'a0000001-0001-0001-0001-000000000007', 'place_time'),
  ('b0000001-0001-0001-0001-000000000008', 8, '명령문 (길 안내·부탁)',              'A1', 'sentence_type', 'S5',   'a0000001-0001-0001-0001-000000000008', 'directions')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- curriculum_step (Task 13.2 / Req 4.2)
--
-- 각 단원마다 phrase(1) / conjugation(2) / substitution(3) 세 step.
-- step UUID 는 unit UUID 의 마지막 그룹 뒤 두 자리로 식별 — `-p1/-c2/-s3` 의미.
-- ---------------------------------------------------------------------------

INSERT INTO curriculum_step (id, unit_id, step_type, order_index) VALUES
  -- Unit 1
  ('c0000001-0001-0001-0001-000000001001', 'b0000001-0001-0001-0001-000000000001', 'phrase',       1),
  ('c0000001-0001-0001-0001-000000001002', 'b0000001-0001-0001-0001-000000000001', 'conjugation',  2),
  ('c0000001-0001-0001-0001-000000001003', 'b0000001-0001-0001-0001-000000000001', 'substitution', 3),
  -- Unit 2
  ('c0000001-0001-0001-0001-000000002001', 'b0000001-0001-0001-0001-000000000002', 'phrase',       1),
  ('c0000001-0001-0001-0001-000000002002', 'b0000001-0001-0001-0001-000000000002', 'conjugation',  2),
  ('c0000001-0001-0001-0001-000000002003', 'b0000001-0001-0001-0001-000000000002', 'substitution', 3),
  -- Unit 3
  ('c0000001-0001-0001-0001-000000003001', 'b0000001-0001-0001-0001-000000000003', 'phrase',       1),
  ('c0000001-0001-0001-0001-000000003002', 'b0000001-0001-0001-0001-000000000003', 'conjugation',  2),
  ('c0000001-0001-0001-0001-000000003003', 'b0000001-0001-0001-0001-000000000003', 'substitution', 3),
  -- Unit 4
  ('c0000001-0001-0001-0001-000000004001', 'b0000001-0001-0001-0001-000000000004', 'phrase',       1),
  ('c0000001-0001-0001-0001-000000004002', 'b0000001-0001-0001-0001-000000000004', 'conjugation',  2),
  ('c0000001-0001-0001-0001-000000004003', 'b0000001-0001-0001-0001-000000000004', 'substitution', 3),
  -- Unit 5
  ('c0000001-0001-0001-0001-000000005001', 'b0000001-0001-0001-0001-000000000005', 'phrase',       1),
  ('c0000001-0001-0001-0001-000000005002', 'b0000001-0001-0001-0001-000000000005', 'conjugation',  2),
  ('c0000001-0001-0001-0001-000000005003', 'b0000001-0001-0001-0001-000000000005', 'substitution', 3),
  -- Unit 6
  ('c0000001-0001-0001-0001-000000006001', 'b0000001-0001-0001-0001-000000000006', 'phrase',       1),
  ('c0000001-0001-0001-0001-000000006002', 'b0000001-0001-0001-0001-000000000006', 'conjugation',  2),
  ('c0000001-0001-0001-0001-000000006003', 'b0000001-0001-0001-0001-000000000006', 'substitution', 3),
  -- Unit 7
  ('c0000001-0001-0001-0001-000000007001', 'b0000001-0001-0001-0001-000000000007', 'phrase',       1),
  ('c0000001-0001-0001-0001-000000007002', 'b0000001-0001-0001-0001-000000000007', 'conjugation',  2),
  ('c0000001-0001-0001-0001-000000007003', 'b0000001-0001-0001-0001-000000000007', 'substitution', 3),
  -- Unit 8
  ('c0000001-0001-0001-0001-000000008001', 'b0000001-0001-0001-0001-000000000008', 'phrase',       1),
  ('c0000001-0001-0001-0001-000000008002', 'b0000001-0001-0001-0001-000000000008', 'conjugation',  2),
  ('c0000001-0001-0001-0001-000000008003', 'b0000001-0001-0001-0001-000000000008', 'substitution', 3)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- curriculum_unit_prerequisite (Task 13.3 / Req 4.3, 4.4, 4.5)
--
-- 1:        빈 배열 (선행 없음)
-- 2:        1
-- 3:        1, 2
-- 4:        1, 2, 3
-- 5:        1, 2, 3, 4
-- 6:        1, 2, 3, 4, 5
-- 7:        6    (§5-1 테이블의 "선행" 열이 6만 명시. Wh- 는 Yes/No 에만 의존)
-- 8:        1, 2, 3, 4, 5, 6, 7
-- ---------------------------------------------------------------------------

INSERT INTO curriculum_unit_prerequisite (unit_id, prerequisite_id) VALUES
  -- Unit 2
  ('b0000001-0001-0001-0001-000000000002', 'b0000001-0001-0001-0001-000000000001'),
  -- Unit 3
  ('b0000001-0001-0001-0001-000000000003', 'b0000001-0001-0001-0001-000000000001'),
  ('b0000001-0001-0001-0001-000000000003', 'b0000001-0001-0001-0001-000000000002'),
  -- Unit 4
  ('b0000001-0001-0001-0001-000000000004', 'b0000001-0001-0001-0001-000000000001'),
  ('b0000001-0001-0001-0001-000000000004', 'b0000001-0001-0001-0001-000000000002'),
  ('b0000001-0001-0001-0001-000000000004', 'b0000001-0001-0001-0001-000000000003'),
  -- Unit 5
  ('b0000001-0001-0001-0001-000000000005', 'b0000001-0001-0001-0001-000000000001'),
  ('b0000001-0001-0001-0001-000000000005', 'b0000001-0001-0001-0001-000000000002'),
  ('b0000001-0001-0001-0001-000000000005', 'b0000001-0001-0001-0001-000000000003'),
  ('b0000001-0001-0001-0001-000000000005', 'b0000001-0001-0001-0001-000000000004'),
  -- Unit 6
  ('b0000001-0001-0001-0001-000000000006', 'b0000001-0001-0001-0001-000000000001'),
  ('b0000001-0001-0001-0001-000000000006', 'b0000001-0001-0001-0001-000000000002'),
  ('b0000001-0001-0001-0001-000000000006', 'b0000001-0001-0001-0001-000000000003'),
  ('b0000001-0001-0001-0001-000000000006', 'b0000001-0001-0001-0001-000000000004'),
  ('b0000001-0001-0001-0001-000000000006', 'b0000001-0001-0001-0001-000000000005'),
  -- Unit 7 (Wh- 는 Yes/No 이후에만 의존)
  ('b0000001-0001-0001-0001-000000000007', 'b0000001-0001-0001-0001-000000000006'),
  -- Unit 8
  ('b0000001-0001-0001-0001-000000000008', 'b0000001-0001-0001-0001-000000000001'),
  ('b0000001-0001-0001-0001-000000000008', 'b0000001-0001-0001-0001-000000000002'),
  ('b0000001-0001-0001-0001-000000000008', 'b0000001-0001-0001-0001-000000000003'),
  ('b0000001-0001-0001-0001-000000000008', 'b0000001-0001-0001-0001-000000000004'),
  ('b0000001-0001-0001-0001-000000000008', 'b0000001-0001-0001-0001-000000000005'),
  ('b0000001-0001-0001-0001-000000000008', 'b0000001-0001-0001-0001-000000000006'),
  ('b0000001-0001-0001-0001-000000000008', 'b0000001-0001-0001-0001-000000000007')
ON CONFLICT (unit_id, prerequisite_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Req 4.8 guard: 이 파일이 Sentence 를 INSERT 하지 않음.
-- 명시적 검증은 후속 테스트·CI 에서. 여기 파일 내부에 아래 문자열이 등장
-- 하면 안 된다 (Task 13.4).
--
--   (no INSERT INTO public.sentences ...)
-- ---------------------------------------------------------------------------
