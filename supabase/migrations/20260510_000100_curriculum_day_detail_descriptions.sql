-- Migration: curriculum_day에 description_ko 컬럼 추가
--
-- 각 Day의 학습 내용을 2~3문장으로 상세 설명한다.
-- 세션 시작 전 사용자에게 "오늘 뭘 배우는지" 맥락을 제공한다.

ALTER TABLE curriculum_day ADD COLUMN IF NOT EXISTS description_ko text DEFAULT NULL;

COMMENT ON COLUMN curriculum_day.description_ko IS '각 Day의 학습 내용 상세 설명 (2~3문장). 세션 시작 전 표시.';

-- Day 1: 현재형 긍정 + 부정 (I like / I don't like)
UPDATE curriculum_day SET description_ko = '현재형 긍정문(I like)과 부정문(I don''t like)을 배웁니다. 좋아하는 것과 싫어하는 것을 표현하는 가장 기본적인 패턴으로, drink/eat/have 동사와 함께 일상 문장을 만들어봅니다.' WHERE day_number = 1;

-- Day 2: 과거형 긍정 + 부정 (I went / I didn't go)
UPDATE curriculum_day SET description_ko = '과거형 긍정문(I went)과 부정문(I didn''t go)을 연습합니다. 어제 한 일과 하지 않은 일을 말하는 패턴을 익히며, 불규칙 동사(went, ate, saw, had)의 과거형에 익숙해집니다.' WHERE day_number = 2;

-- Day 3: 미래형 긍정 + 부정 (I will / I won't)
UPDATE curriculum_day SET description_ko = 'will을 사용해 앞으로의 계획과 의지를 표현합니다. 긍정(I will go)과 부정(I won''t go)을 반복 연습하며, 미래에 대해 간결하게 말하는 자신감을 기릅니다.' WHERE day_number = 3;

-- Day 4: 명령문 (Open the door / Don't touch)
UPDATE curriculum_day SET description_ko = '명령문으로 요청과 지시를 간결하게 전달하는 법을 배웁니다. 긍정 명령(Open the door, Come here)과 부정 명령(Don''t touch, Don''t run)을 상황별로 연습합니다.' WHERE day_number = 4;

-- Day 5: can + and 확장 (I can swim and run)
UPDATE curriculum_day SET description_ko = 'can으로 능력을 표현하고, and로 두 가지 동작을 연결합니다. "I can swim and run"처럼 할 수 있는 것들을 나열하는 패턴과, can''t로 못하는 것을 말하는 연습을 합니다.' WHERE day_number = 5;

-- Day 6: have 활용 (I have / I had)
UPDATE curriculum_day SET description_ko = 'have의 다양한 쓰임을 익힙니다. 소유(I have a phone), 경험(I had fun), 식사(have breakfast) 등 have가 들어간 핵심 표현을 현재형과 과거형으로 반복 연습합니다.' WHERE day_number = 6;

-- Day 7: 조건문 + 조언 (If it rains / You should rest)
UPDATE curriculum_day SET description_ko = 'if로 조건을 말하고, should로 조언하는 패턴을 배웁니다. "If it rains, I will stay home"처럼 상황을 가정하고, "You should rest"처럼 상대에게 부드럽게 권유하는 표현을 익힙니다.' WHERE day_number = 7;

-- Day 8: 주어 바꿔 말하기 (He/She/They + 요일)
UPDATE curriculum_day SET description_ko = '주어를 I에서 He, She, They로 바꿔 같은 문장을 변형합니다. 3인칭 주어에 따른 동사 변화(-s 붙이기)를 자연스럽게 체득하고, 요일 표현도 함께 연습합니다.' WHERE day_number = 8;

-- Day 9: be동사 현재 상태 (I am happy / It is cold)
UPDATE curriculum_day SET description_ko = 'be동사(am, is, are)로 현재 상태를 설명합니다. "I am happy", "It is cold"처럼 감정, 날씨, 상황을 간단히 표현하는 가장 기본적인 be동사 패턴을 반복합니다.' WHERE day_number = 9;

-- Day 10: be동사 위치 + 질문 (Where is it? / Is she here?)
UPDATE curriculum_day SET description_ko = 'be동사로 위치를 말하고 질문을 만듭니다. "Where is it?", "Is she here?"처럼 be동사를 문장 앞으로 보내 의문문을 만드는 어순 변환을 집중 연습합니다.' WHERE day_number = 10;

-- Day 11: be동사 과거 (I was tired / Were you there?)
UPDATE curriculum_day SET description_ko = 'be동사의 과거형(was, were)으로 지난 상태를 표현합니다. "I was tired", "Were you there?"처럼 과거의 감정, 위치, 상황을 말하고 질문하는 패턴을 익힙니다.' WHERE day_number = 11;

-- Day 12: 미래 be동사 + 동명사 (It will be fun / I enjoy swimming)
UPDATE curriculum_day SET description_ko = '"It will be fun"으로 미래 상태를 예측하고, "I enjoy swimming"처럼 동명사(-ing)를 목적어로 쓰는 패턴을 배웁니다. be동사 미래형과 동명사 활용을 동시에 연습합니다.' WHERE day_number = 12;

-- Day 13: to부정사 + 부사 + 진행형 조합
UPDATE curriculum_day SET description_ko = 'to부정사(to eat), 부사(quickly), 진행형(is running)을 조합해 문장을 풍성하게 만듭니다. 목적을 말하는 to, 동작을 꾸미는 부사, 지금 하고 있는 일을 표현하는 진행형을 한꺼번에 연습합니다.' WHERE day_number = 13;

-- Day 14: take 활용 + 의문사 주어 (take a look / Who said that?)
UPDATE curriculum_day SET description_ko = '"take a look", "take a break"처럼 take가 들어간 핵심 표현을 익히고, "Who said that?"처럼 의문사가 주어 자리에 오는 질문 패턴을 연습합니다.' WHERE day_number = 14;

-- Day 15: 명사 꾸미기 + 대체 (a big red car / the other one)
UPDATE curriculum_day SET description_ko = '형용사를 여러 개 붙여 명사를 구체적으로 묘사하고(a big red car), "the other one"처럼 대명사로 앞서 말한 것을 대체하는 표현을 배웁니다. 묘사력과 간결함을 동시에 키웁니다.' WHERE day_number = 15;


-- Day 16: 과거진행 + 의견 + 변형 표현 (was running / I think / will be able to)
UPDATE curriculum_day SET description_ko = '과거진행형(was running)으로 그때 하고 있던 일을 말하고, "I think"로 의견을 붙이며, "will be able to"로 can의 미래형을 표현합니다. 시제와 표현의 폭을 한 단계 넓힙니다.' WHERE day_number = 16;

-- Day 17: 구어체 + 연결 표현 (I gotta go / for you / I know that)
UPDATE curriculum_day SET description_ko = '"I gotta go", "wanna"처럼 원어민이 일상에서 줄여 쓰는 구어체를 익히고, "for you", "I know that"처럼 문장을 자연스럽게 이어주는 연결 표현을 연습합니다.' WHERE day_number = 17;

-- Day 18: 접속사 (because / so / as soon as)
UPDATE curriculum_day SET description_ko = 'because(이유), so(결과), as soon as(즉시)로 두 문장을 하나로 연결합니다. 짧은 문장 두 개를 접속사로 붙여 의미를 풍부하게 만드는 연습을 집중적으로 합니다.' WHERE day_number = 18;

-- Day 19: 의문사+to + that절 확장 (what to do / I think that he)
UPDATE curriculum_day SET description_ko = '"what to do", "where to go"처럼 의문사+to 패턴으로 고민을 표현하고, "I think that he is kind"처럼 that절로 생각과 판단을 길게 말하는 연습을 합니다.' WHERE day_number = 19;

-- Day 20: 관계사 + It is 패턴 (the person who / It is important to)
UPDATE curriculum_day SET description_ko = '"the person who helped me"처럼 관계대명사 who로 사람을 설명하고, "It is important to study"처럼 It is + 형용사 + to 패턴으로 의견을 격식 있게 표현합니다.' WHERE day_number = 20;

-- Day 21: 현재완료 경험 (I have been / Have you ever?)
UPDATE curriculum_day SET description_ko = '현재완료(have + 과거분사)로 경험과 완료를 표현합니다. "I have been to Japan", "Have you ever tried?"처럼 과거의 경험이 현재와 연결되는 느낌을 체득합니다.' WHERE day_number = 21;

-- Day 22: 현재완료 진행 + 관계사 (I've been waiting / the book which)
UPDATE curriculum_day SET description_ko = '"I''ve been waiting for an hour"처럼 과거부터 지금까지 계속되는 동작을 표현하고, "the book which I bought"처럼 which로 사물을 설명하는 관계사절을 연습합니다.' WHERE day_number = 22;

-- Day 23: 수동태 (It was made / is being built)
UPDATE curriculum_day SET description_ko = '"It was made in Korea", "is being built"처럼 수동태로 관점을 바꿔 말합니다. 누가 했는지보다 무엇이 되었는지에 초점을 맞추는 표현법을 과거·현재·진행형으로 연습합니다.' WHERE day_number = 23;

-- Day 24: 생략으로 자연스럽게 (the man (that) I met / I think (that))
UPDATE curriculum_day SET description_ko = '"the man I met"처럼 that을 생략해 더 자연스러운 문장을 만듭니다. 관계사절과 that절에서 생략 가능한 부분을 파악하고, 원어민처럼 간결하게 말하는 감각을 기릅니다.' WHERE day_number = 24;

-- Day 25: 동사+동사 패턴 (help me do / keep going / make it work)
UPDATE curriculum_day SET description_ko = '"help me do", "keep going", "make it work"처럼 동사 뒤에 또 다른 동사가 오는 패턴을 집중 연습합니다. help/keep/make/let 등 핵심 동사의 뒤에 오는 형태(원형/ing)를 구분합니다.' WHERE day_number = 25;

-- Day 26: 감각·사역동사 (It looks good / I had it fixed)
UPDATE curriculum_day SET description_ko = '"It looks good", "It sounds great"처럼 감각동사로 인상을 표현하고, "I had it fixed"처럼 사역동사로 누군가에게 시킨 일을 말합니다. 일상에서 자주 쓰이는 고급 패턴입니다.' WHERE day_number = 26;

-- Day 27: 감정 + 질문법 (I'm afraid of / proud of / Is it okay?)
UPDATE curriculum_day SET description_ko = '"I''m afraid of", "I''m proud of"처럼 전치사와 함께 감정을 표현하고, "Is it okay if I...?"처럼 정중하게 허락을 구하는 질문 패턴을 연습합니다.' WHERE day_number = 27;

-- Day 28: 미래 질문 + 제안 (Will you? / Do you want me to?)
UPDATE curriculum_day SET description_ko = '"Will you come?", "Do you want me to help?"처럼 미래에 대해 묻고 제안하는 표현을 배웁니다. 상대의 의향을 확인하고 도움을 제안하는 실용적인 대화 패턴입니다.' WHERE day_number = 28;

-- Day 29: 습관·양해·소요 (I used to / Do you mind? / It takes)
UPDATE curriculum_day SET description_ko = '"I used to play"로 과거 습관을 말하고, "Do you mind if I...?"로 양해를 구하며, "It takes 30 minutes"로 소요 시간을 표현합니다. 세 가지 실용 패턴을 한 번에 익힙니다.' WHERE day_number = 29;

-- Day 30: 후회·전달·조건 마무리 (I wish I had / I told you to / if so)
UPDATE curriculum_day SET description_ko = '"I wish I had studied"로 과거에 대한 후회를 표현하고, "I told you to be careful"로 전달을 말하며, "if so"로 조건을 간결하게 정리합니다. 60일 과정의 마무리 종합 연습입니다.' WHERE day_number = 30;
