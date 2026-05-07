-- Migration: curriculum_day에 intro_phrases 컬럼 추가
--
-- 세션 시작 전 핵심 패턴을 먼저 들려주는 "인트로 구문" 데이터.
-- [{en: string, ko: string}] 형태의 jsonb 배열.

ALTER TABLE curriculum_day ADD COLUMN IF NOT EXISTS intro_phrases jsonb DEFAULT NULL;

COMMENT ON COLUMN curriculum_day.intro_phrases IS '세션 시작 전 핵심 패턴 인트로 구문. [{en, ko}] 형태.';

-- Day 1: 현재형 긍정 + 부정
UPDATE curriculum_day SET intro_phrases = '[
  {"en": "I like", "ko": "나는 좋아해"},
  {"en": "I eat", "ko": "나는 먹어"},
  {"en": "I drink", "ko": "나는 마셔"},
  {"en": "I have", "ko": "나는 가지고 있어"},
  {"en": "I don''t like", "ko": "나는 좋아하지 않아"},
  {"en": "I don''t eat", "ko": "나는 먹지 않아"},
  {"en": "I don''t drink", "ko": "나는 마시지 않아"},
  {"en": "I don''t have", "ko": "나는 가지고 있지 않아"}
]'::jsonb WHERE day_number = 1;

-- Day 2: 과거형 긍정 + 부정
UPDATE curriculum_day SET intro_phrases = '[
  {"en": "I went", "ko": "나는 갔어"},
  {"en": "I ate", "ko": "나는 먹었어"},
  {"en": "I saw", "ko": "나는 봤어"},
  {"en": "I had", "ko": "나는 가졌어"},
  {"en": "I didn''t go", "ko": "나는 가지 않았어"},
  {"en": "I didn''t eat", "ko": "나는 먹지 않았어"},
  {"en": "I didn''t see", "ko": "나는 보지 않았어"},
  {"en": "I didn''t have", "ko": "나는 가지지 않았어"}
]'::jsonb WHERE day_number = 2;

-- Day 3: 미래형 긍정 + 부정
UPDATE curriculum_day SET intro_phrases = '[
  {"en": "I will go", "ko": "나는 갈 거야"},
  {"en": "I will eat", "ko": "나는 먹을 거야"},
  {"en": "I will try", "ko": "나는 해볼 거야"},
  {"en": "I will help", "ko": "나는 도와줄 거야"},
  {"en": "I won''t go", "ko": "나는 가지 않을 거야"},
  {"en": "I won''t eat", "ko": "나는 먹지 않을 거야"},
  {"en": "I won''t try", "ko": "나는 해보지 않을 거야"},
  {"en": "I won''t help", "ko": "나는 도와주지 않을 거야"}
]'::jsonb WHERE day_number = 3;

-- Day 4: 명령문
UPDATE curriculum_day SET intro_phrases = '[
  {"en": "Open the door", "ko": "문 열어"},
  {"en": "Close the window", "ko": "창문 닫아"},
  {"en": "Come here", "ko": "이리 와"},
  {"en": "Sit down", "ko": "앉아"},
  {"en": "Don''t touch", "ko": "만지지 마"},
  {"en": "Don''t run", "ko": "뛰지 마"},
  {"en": "Don''t worry", "ko": "걱정하지 마"},
  {"en": "Don''t forget", "ko": "잊지 마"}
]'::jsonb WHERE day_number = 4;

-- Day 5: can + and 확장
UPDATE curriculum_day SET intro_phrases = '[
  {"en": "I can swim", "ko": "나는 수영할 수 있어"},
  {"en": "I can cook", "ko": "나는 요리할 수 있어"},
  {"en": "I can drive", "ko": "나는 운전할 수 있어"},
  {"en": "I can help", "ko": "나는 도와줄 수 있어"},
  {"en": "I can read and write", "ko": "나는 읽고 쓸 수 있어"},
  {"en": "I can sing and dance", "ko": "나는 노래하고 춤출 수 있어"},
  {"en": "I can''t swim", "ko": "나는 수영할 수 없어"},
  {"en": "I can''t drive", "ko": "나는 운전할 수 없어"}
]'::jsonb WHERE day_number = 5;
