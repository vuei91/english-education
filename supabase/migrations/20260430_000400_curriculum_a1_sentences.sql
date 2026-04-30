-- Migration: curriculum A1 sentences — 8개 단원의 학습 문장 적재
--
-- Scope:
--   - Unit 1~8 의 Step 1 (Phrase), Step 2 (Conjugation), Step 3 (Substitution) 문장
--   - 모든 문장은 Track A, CEFR A1, status='production'
--   - curriculum_step_id 로 해당 단계에 연결
--   - Step 1 은 is_phrase=true (마침표 없는 구)
--
-- 생성 전략 (curriculum-content-pipeline steering 준수):
--   - Step 1: 인간 씨앗 — 팩의 핵심 구 3~5개
--   - Step 2: 템플릿 기반 — "{subject} {verb:conj} {object}." 주어 풀 적용
--   - Step 3: 슬롯 치환 — 팩의 나머지 어휘로 문형 변주
--
-- 한국어 번역: 의미 번역 (직역 금지)
-- 소스: 자체 제작 (CC0)
--
-- Step ID 참조:
--   Unit 1: phrase=c...1001, conjugation=c...1002, substitution=c...1003
--   Unit 2: phrase=c...2001, conjugation=c...2002, substitution=c...2003
--   ...
--   Unit 8: phrase=c...8001, conjugation=c...8002, substitution=c...8003

-- =========================================================================
-- Unit 1: T1·S1 현재형 1·2인칭 긍정 · drink + 음료
-- =========================================================================

-- Step 1: Phrase (is_phrase=true)
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'drink coffee',     '커피를 마시다',     'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001001', true),
  ('A', 'drink tea',        '차를 마시다',       'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001001', true),
  ('A', 'have coffee',      '커피를 마시다',     'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001001', true),
  ('A', 'drink water',      '물을 마시다',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001001', true),
  ('A', 'order coffee',     '커피를 주문하다',   'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001001', true);

-- Step 2: Conjugation (1·2인칭 only — T1)
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'I drink coffee.',          '나는 커피를 마셔요.',       'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001002', false),
  ('A', 'You drink coffee.',        '너는 커피를 마셔.',         'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001002', false),
  ('A', 'I drink tea.',             '나는 차를 마셔요.',         'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001002', false),
  ('A', 'You drink tea.',           '너는 차를 마셔.',           'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001002', false),
  ('A', 'I have coffee.',           '나는 커피를 마셔요.',       'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001002', false),
  ('A', 'You have coffee.',         '너는 커피를 마셔.',         'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001002', false),
  ('A', 'I drink water.',           '나는 물을 마셔요.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001002', false),
  ('A', 'You drink water.',         '너는 물을 마셔.',           'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001002', false),
  ('A', 'I order coffee.',          '나는 커피를 주문해요.',     'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001002', false),
  ('A', 'You order tea.',           '너는 차를 주문해.',         'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001002', false),
  ('A', 'We drink coffee.',         '우리는 커피를 마셔요.',     'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001002', false),
  ('A', 'They drink tea.',          '그들은 차를 마셔요.',       'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001002', false);

-- Step 3: Substitution (어휘 치환)
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'I drink juice.',           '나는 주스를 마셔요.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001003', false),
  ('A', 'You drink milk.',          '너는 우유를 마셔.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001003', false),
  ('A', 'I drink cold water.',      '나는 찬 물을 마셔요.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001003', false),
  ('A', 'You have hot tea.',        '너는 따뜻한 차를 마셔.',   'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001003', false),
  ('A', 'I drink sweet juice.',     '나는 달콤한 주스를 마셔요.', 'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001003', false),
  ('A', 'We drink soda.',           '우리는 탄산음료를 마셔요.', 'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001003', false),
  ('A', 'I have a cup of tea.',     '나는 차 한 잔을 마셔요.',   'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001003', false),
  ('A', 'You order juice.',         '너는 주스를 주문해.',       'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001003', false),
  ('A', 'I finish my coffee.',      '나는 커피를 다 마셔요.',   'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001003', false),
  ('A', 'You pour water.',          '너는 물을 따라.',           'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001003', false),
  ('A', 'I drink strong coffee.',   '나는 진한 커피를 마셔요.', 'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001003', false),
  ('A', 'We have cold milk.',       '우리는 차가운 우유를 마셔요.', 'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000001003', false);


-- =========================================================================
-- Unit 2: eat + 음식 (팩 확장, 문법 동일)
-- =========================================================================

-- Step 1: Phrase
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'eat pizza',        '피자를 먹다',       'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002001', true),
  ('A', 'eat rice',         '밥을 먹다',         'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002001', true),
  ('A', 'have breakfast',   '아침을 먹다',       'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002001', true),
  ('A', 'cook chicken',     '치킨을 요리하다',   'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002001', true),
  ('A', 'have lunch',       '점심을 먹다',       'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002001', true);

-- Step 2: Conjugation
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'I eat pizza.',             '나는 피자를 먹어요.',       'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002002', false),
  ('A', 'You eat pizza.',           '너는 피자를 먹어.',         'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002002', false),
  ('A', 'I eat rice.',              '나는 밥을 먹어요.',         'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002002', false),
  ('A', 'You eat rice.',            '너는 밥을 먹어.',           'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002002', false),
  ('A', 'I have breakfast.',        '나는 아침을 먹어요.',       'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002002', false),
  ('A', 'You have breakfast.',      '너는 아침을 먹어.',         'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002002', false),
  ('A', 'I cook chicken.',          '나는 치킨을 요리해요.',     'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002002', false),
  ('A', 'You cook chicken.',        '너는 치킨을 요리해.',       'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002002', false),
  ('A', 'We eat pizza.',            '우리는 피자를 먹어요.',     'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002002', false),
  ('A', 'They eat rice.',           '그들은 밥을 먹어요.',       'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002002', false),
  ('A', 'I have lunch.',            '나는 점심을 먹어요.',       'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002002', false),
  ('A', 'You have lunch.',          '너는 점심을 먹어.',         'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002002', false);

-- Step 3: Substitution
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'I eat bread.',             '나는 빵을 먹어요.',         'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002003', false),
  ('A', 'You eat salad.',           '너는 샐러드를 먹어.',       'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002003', false),
  ('A', 'I eat fresh bread.',       '나는 신선한 빵을 먹어요.', 'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002003', false),
  ('A', 'You want pizza.',          '너는 피자를 원해.',         'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002003', false),
  ('A', 'I want hot pizza.',        '나는 뜨거운 피자를 원해요.', 'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002003', false),
  ('A', 'We eat delicious chicken.','우리는 맛있는 치킨을 먹어요.', 'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002003', false),
  ('A', 'I cook meat.',             '나는 고기를 요리해요.',     'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002003', false),
  ('A', 'You eat spicy chicken.',   '너는 매운 치킨을 먹어.',   'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002003', false),
  ('A', 'I cook egg.',              '나는 달걀을 요리해요.',     'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002003', false),
  ('A', 'We finish pizza.',         '우리는 피자를 다 먹어요.', 'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002003', false),
  ('A', 'I drink coffee.',          '나는 커피를 마셔요.',       'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002003', false),
  ('A', 'You eat fresh salad.',     '너는 신선한 샐러드를 먹어.', 'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000002003', false);

-- =========================================================================
-- Unit 3: have + 소지품 (팩 확장, 문법 동일)
-- =========================================================================

-- Step 1: Phrase
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'have a phone',     '전화기를 가지다',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003001', true),
  ('A', 'carry a bag',      '가방을 들다',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003001', true),
  ('A', 'need a key',       '열쇠가 필요하다',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003001', true),
  ('A', 'use a pen',        '펜을 사용하다',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003001', true),
  ('A', 'take a picture',   '사진을 찍다',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003001', true);

-- Step 2: Conjugation
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'I have a phone.',          '나는 전화기가 있어요.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003002', false),
  ('A', 'You have a phone.',        '너는 전화기가 있어.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003002', false),
  ('A', 'I carry a bag.',           '나는 가방을 들어요.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003002', false),
  ('A', 'You carry a bag.',         '너는 가방을 들어.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003002', false),
  ('A', 'I need a key.',            '나는 열쇠가 필요해요.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003002', false),
  ('A', 'You need a key.',          '너는 열쇠가 필요해.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003002', false),
  ('A', 'I use a pen.',             '나는 펜을 사용해요.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003002', false),
  ('A', 'You use a pen.',           '너는 펜을 사용해.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003002', false),
  ('A', 'We have a bag.',           '우리는 가방이 있어요.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003002', false),
  ('A', 'They need a key.',         '그들은 열쇠가 필요해요.',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003002', false);

-- Step 3: Substitution
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'I have a book.',           '나는 책이 있어요.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003003', false),
  ('A', 'You have a wallet.',       '너는 지갑이 있어.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003003', false),
  ('A', 'I have a new phone.',      '나는 새 전화기가 있어요.', 'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003003', false),
  ('A', 'You carry a heavy bag.',   '너는 무거운 가방을 들어.', 'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003003', false),
  ('A', 'I need an umbrella.',      '나는 우산이 필요해요.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003003', false),
  ('A', 'You have an old watch.',   '너는 오래된 시계가 있어.', 'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003003', false),
  ('A', 'I use a new pen.',         '나는 새 펜을 사용해요.',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003003', false),
  ('A', 'We have a book.',          '우리는 책이 있어요.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003003', false),
  ('A', 'I want a new bag.',        '나는 새 가방을 원해요.',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003003', false),
  ('A', 'You want bread.',          '너는 빵을 원해.',           'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000003003', false);

-- =========================================================================
-- Unit 4: T2 · 3인칭 단수 -s (drink/eat/have 재사용)
-- =========================================================================

-- Step 1: Phrase (3인칭 구)
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'drinks coffee',    '커피를 마시다 (3인칭)', 'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004001', true),
  ('A', 'eats pizza',       '피자를 먹다 (3인칭)',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004001', true),
  ('A', 'goes to school',   '학교에 가다 (3인칭)',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004001', true),
  ('A', 'comes home',       '집에 오다 (3인칭)',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004001', true);

-- Step 2: Conjugation (3인칭 단수 he/she/it + 대비용 I/you)
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'He drinks coffee.',        '그는 커피를 마셔요.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004002', false),
  ('A', 'She drinks coffee.',       '그녀는 커피를 마셔요.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004002', false),
  ('A', 'He eats pizza.',           '그는 피자를 먹어요.',       'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004002', false),
  ('A', 'She eats pizza.',          '그녀는 피자를 먹어요.',     'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004002', false),
  ('A', 'He goes to school.',       '그는 학교에 가요.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004002', false),
  ('A', 'She goes to school.',      '그녀는 학교에 가요.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004002', false),
  ('A', 'He comes home.',           '그는 집에 와요.',           'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004002', false),
  ('A', 'She comes home.',          '그녀는 집에 와요.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004002', false),
  ('A', 'It works.',                '그건 작동해요.',             'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004002', false),
  ('A', 'I drink coffee.',          '나는 커피를 마셔요.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004002', false),
  ('A', 'He has a phone.',          '그는 전화기가 있어요.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004002', false),
  ('A', 'She has a bag.',           '그녀는 가방이 있어요.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004002', false);

-- Step 3: Substitution
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'He drinks tea.',           '그는 차를 마셔요.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004003', false),
  ('A', 'She eats rice.',           '그녀는 밥을 먹어요.',       'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004003', false),
  ('A', 'He plays at the park.',    '그는 공원에서 놀아요.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004003', false),
  ('A', 'She works at home.',       '그녀는 집에서 일해요.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004003', false),
  ('A', 'He goes to the park.',     '그는 공원에 가요.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004003', false),
  ('A', 'She drinks cold water.',   '그녀는 찬 물을 마셔요.',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004003', false),
  ('A', 'He eats delicious pizza.', '그는 맛있는 피자를 먹어요.', 'A1', 'food', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004003', false),
  ('A', 'She has a new book.',      '그녀는 새 책이 있어요.',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004003', false),
  ('A', 'He watches a movie.',      '그는 영화를 봐요.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004003', false),
  ('A', 'She comes home.',          '그녀는 집에 와요.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000004003', false);

-- =========================================================================
-- Unit 5: S2 · 부정문 don't / doesn't
-- =========================================================================

-- Step 1: Phrase (부정 구)
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'don''t like',      '좋아하지 않다',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005001', true),
  ('A', 'don''t know',      '모르다',             'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005001', true),
  ('A', 'don''t understand', '이해하지 못하다',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005001', true),
  ('A', 'doesn''t work',    '작동하지 않다',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005001', true);

-- Step 2: Conjugation
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'I don''t like meat.',           '나는 고기를 안 좋아해요.',     'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005002', false),
  ('A', 'You don''t like meat.',         '너는 고기를 안 좋아해.',       'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005002', false),
  ('A', 'He doesn''t like meat.',        '그는 고기를 안 좋아해요.',     'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005002', false),
  ('A', 'She doesn''t like meat.',       '그녀는 고기를 안 좋아해요.',   'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005002', false),
  ('A', 'I don''t know.',                '나는 몰라요.',                 'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005002', false),
  ('A', 'I don''t understand English.',  '나는 영어를 이해 못 해요.',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005002', false),
  ('A', 'He doesn''t understand Korean.','그는 한국어를 이해 못 해요.', 'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005002', false),
  ('A', 'I don''t drink coffee.',        '나는 커피를 안 마셔요.',       'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005002', false),
  ('A', 'She doesn''t drink coffee.',    '그녀는 커피를 안 마셔요.',     'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005002', false),
  ('A', 'We don''t eat meat.',           '우리는 고기를 안 먹어요.',     'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005002', false),
  ('A', 'They don''t work.',             '그들은 일하지 않아요.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005002', false),
  ('A', 'It doesn''t work.',             '그건 작동하지 않아요.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005002', false);

-- Step 3: Substitution
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'I don''t go to school.',        '나는 학교에 안 가요.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005003', false),
  ('A', 'She doesn''t eat pizza.',       '그녀는 피자를 안 먹어요.',     'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005003', false),
  ('A', 'I don''t have a problem.',      '나는 문제가 없어요.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005003', false),
  ('A', 'He doesn''t have a job.',       '그는 직업이 없어요.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005003', false),
  ('A', 'I don''t get up early.',        '나는 일찍 안 일어나요.',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005003', false),
  ('A', 'She doesn''t go to bed late.',  '그녀는 늦게 안 자요.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005003', false),
  ('A', 'We don''t drink beer.',         '우리는 맥주를 안 마셔요.',   'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005003', false),
  ('A', 'I am not busy.',               '나는 바쁘지 않아요.',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005003', false),
  ('A', 'I am not tired.',              '나는 피곤하지 않아요.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005003', false),
  ('A', 'English is not difficult.',     '영어는 어렵지 않아요.',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000005003', false);

-- =========================================================================
-- Unit 6: S3 · Yes/No 의문문
-- =========================================================================

-- Step 1: Phrase (의문 구)
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'do you sleep',     '너는 자니',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006001', true),
  ('A', 'do you read',      '너는 읽니',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006001', true),
  ('A', 'does he run',      '그는 달리니',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006001', true),
  ('A', 'does she work',    '그녀는 일하니',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006001', true);

-- Step 2: Conjugation
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'Do you sleep early?',          '너는 일찍 자?',             'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006002', false),
  ('A', 'Do you read books?',           '너는 책을 읽어?',           'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006002', false),
  ('A', 'Does he run?',                 '그는 달려?',                 'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006002', false),
  ('A', 'Does she work?',               '그녀는 일해?',               'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006002', false),
  ('A', 'Do you get up early?',         '너는 일찍 일어나?',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006002', false),
  ('A', 'Do they play?',                '그들은 놀아?',               'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006002', false),
  ('A', 'Does he sleep late?',          '그는 늦게 자?',             'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006002', false),
  ('A', 'Does she read?',               '그녀는 읽어?',               'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006002', false),
  ('A', 'Do you drink coffee?',         '너는 커피를 마셔?',         'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006002', false),
  ('A', 'Does he eat pizza?',           '그는 피자를 먹어?',         'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006002', false),
  ('A', 'Do we have time?',             '우리 시간 있어?',           'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006002', false),
  ('A', 'Do you like coffee?',          '너는 커피를 좋아해?',       'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006002', false);

-- Step 3: Substitution
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'Do you swim?',                 '너는 수영해?',               'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006003', false),
  ('A', 'Does she write letters?',      '그녀는 편지를 써?',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006003', false),
  ('A', 'Do you open the window?',      '너는 창문을 열어?',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006003', false),
  ('A', 'Does he close the door?',      '그는 문을 닫아?',           'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006003', false),
  ('A', 'Do you read the newspaper?',   '너는 신문을 읽어?',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006003', false),
  ('A', 'Does she wake up early?',      '그녀는 일찍 일어나?',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006003', false),
  ('A', 'Do they run at the park?',     '그들은 공원에서 달려?',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006003', false),
  ('A', 'Do you sleep well?',           '너는 잘 자?',               'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006003', false),
  ('A', 'Does he play at the park?',    '그는 공원에서 놀아?',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006003', false),
  ('A', 'Do you like quiet places?',    '너는 조용한 곳을 좋아해?', 'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000006003', false);

-- =========================================================================
-- Unit 7: S4 · Wh- 의문문 (what / where / when)
-- =========================================================================

-- Step 1: Phrase (Wh- 구)
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'what do you',      '너는 무엇을',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007001', true),
  ('A', 'where do you',     '너는 어디에서',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007001', true),
  ('A', 'when do you',      '너는 언제',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007001', true),
  ('A', 'what does he',     '그는 무엇을',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007001', true);

-- Step 2: Conjugation
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'What do you drink?',           '너는 뭘 마셔?',             'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007002', false),
  ('A', 'What do you eat?',             '너는 뭘 먹어?',             'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007002', false),
  ('A', 'Where do you go?',             '너는 어디에 가?',           'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007002', false),
  ('A', 'Where do you work?',           '너는 어디에서 일해?',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007002', false),
  ('A', 'When do you sleep?',           '너는 언제 자?',             'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007002', false),
  ('A', 'When do you eat?',             '너는 언제 먹어?',           'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007002', false),
  ('A', 'What does he drink?',          '그는 뭘 마셔?',             'A1', 'cafe',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007002', false),
  ('A', 'Where does she go?',           '그녀는 어디에 가?',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007002', false),
  ('A', 'What do we eat?',              '우리는 뭘 먹어?',           'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007002', false),
  ('A', 'When does he come home?',      '그는 언제 집에 와?',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007002', false),
  ('A', 'What do you have?',            '너는 뭘 가지고 있어?',     'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007002', false),
  ('A', 'Where does he work?',          '그는 어디에서 일해?',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007002', false);

-- Step 3: Substitution
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'What do you do in the morning?',    '너는 아침에 뭘 해?',           'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007003', false),
  ('A', 'Where do you go in the afternoon?', '너는 오후에 어디에 가?',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007003', false),
  ('A', 'When do you go to the hospital?',   '너는 언제 병원에 가?',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007003', false),
  ('A', 'What does she eat for lunch?',      '그녀는 점심에 뭘 먹어?',       'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007003', false),
  ('A', 'Where do you eat?',                 '너는 어디에서 먹어?',           'A1', 'food',  'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007003', false),
  ('A', 'When does he go to the library?',   '그는 언제 도서관에 가?',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007003', false),
  ('A', 'What do you read?',                 '너는 뭘 읽어?',               'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007003', false),
  ('A', 'Where does she go at night?',       '그녀는 밤에 어디에 가?',       'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007003', false),
  ('A', 'When do you go to the market?',     '너는 언제 시장에 가?',         'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007003', false),
  ('A', 'What do they do today?',            '그들은 오늘 뭘 해?',           'A1', 'daily', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000007003', false);

-- =========================================================================
-- Unit 8: S5 · 명령문 (길 안내·부탁)
-- =========================================================================

-- Step 1: Phrase (명령 구)
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'turn left',        '왼쪽으로 돌다',     'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008001', true),
  ('A', 'go straight',      '직진하다',           'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008001', true),
  ('A', 'stop here',        '여기서 멈추다',     'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008001', true),
  ('A', 'help me',           '나를 도와주다',     'A1', 'daily',      'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008001', true),
  ('A', 'listen carefully', '주의 깊게 듣다',   'A1', 'daily',      'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008001', true);

-- Step 2: Conjugation (명령문은 주어 생략 — 변형은 please/don't 추가)
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'Turn left.',                   '왼쪽으로 도세요.',           'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008002', false),
  ('A', 'Turn right.',                  '오른쪽으로 도세요.',         'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008002', false),
  ('A', 'Go straight.',                 '직진하세요.',                 'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008002', false),
  ('A', 'Stop here.',                   '여기서 멈추세요.',           'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008002', false),
  ('A', 'Please help me.',              '저 좀 도와주세요.',           'A1', 'daily',      'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008002', false),
  ('A', 'Please listen carefully.',     '주의 깊게 들어 주세요.',     'A1', 'daily',      'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008002', false),
  ('A', 'Don''t stop.',                 '멈추지 마세요.',             'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008002', false),
  ('A', 'Don''t turn left.',            '왼쪽으로 돌지 마세요.',     'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008002', false),
  ('A', 'Please call a taxi.',          '택시를 불러 주세요.',       'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008002', false),
  ('A', 'Walk slowly.',                 '천천히 걸으세요.',           'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008002', false),
  ('A', 'Be careful.',                  '조심하세요.',                 'A1', 'daily',      'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008002', false),
  ('A', 'Come home.',                   '집에 오세요.',               'A1', 'daily',      'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008002', false);

-- Step 3: Substitution
INSERT INTO public.sentences (track, text_en, text_ko, cefr_level, situation, source, license, status, curriculum_step_id, is_phrase) VALUES
  ('A', 'Turn left at the corner.',          '모퉁이에서 왼쪽으로 도세요.',     'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008003', false),
  ('A', 'Go straight for two minutes.',      '2분 동안 직진하세요.',             'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008003', false),
  ('A', 'Take a taxi to the station.',       '역까지 택시를 타세요.',           'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008003', false),
  ('A', 'Walk to the school.',               '학교까지 걸어가세요.',             'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008003', false),
  ('A', 'Please open the door.',             '문을 열어 주세요.',               'A1', 'daily',      'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008003', false),
  ('A', 'Please close the window.',          '창문을 닫아 주세요.',             'A1', 'daily',      'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008003', false),
  ('A', 'Don''t walk on the street.',        '길에서 걷지 마세요.',             'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008003', false),
  ('A', 'Go to the airport.',                '공항에 가세요.',                   'A1', 'directions', 'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008003', false),
  ('A', 'Please be ready in the morning.',   '아침에 준비해 주세요.',           'A1', 'daily',      'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008003', false),
  ('A', 'Come home early.',                  '일찍 집에 오세요.',               'A1', 'daily',      'SentenceFlow', 'CC0-1.0', 'production', 'c0000001-0001-0001-0001-000000008003', false);
