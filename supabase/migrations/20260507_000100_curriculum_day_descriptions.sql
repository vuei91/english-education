-- Migration: 30일 커리큘럼 Day별 학습 설명(subtitle_ko) 추가
--
-- 기존 subtitle_ko 컬럼이 모두 NULL이었던 것을 채운다.
-- 각 Day에 "오늘 뭘 배우는지" 한 줄 설명을 넣어 사용자가 학습 목표를 파악할 수 있게 한다.

UPDATE curriculum_day SET subtitle_ko = 'I like / I don''t like — 현재형으로 좋고 싫음을 말하는 연습' WHERE day_number = 1;
UPDATE curriculum_day SET subtitle_ko = 'I went / I didn''t go — 과거에 한 일과 안 한 일을 표현하기' WHERE day_number = 2;
UPDATE curriculum_day SET subtitle_ko = 'I will / I won''t — 앞으로의 계획과 의지를 말하기' WHERE day_number = 3;
UPDATE curriculum_day SET subtitle_ko = 'Open the door / Don''t touch — 요청과 지시를 간결하게 전달하기' WHERE day_number = 4;
UPDATE curriculum_day SET subtitle_ko = 'I can swim and run — 능력 표현과 문장 연결하기' WHERE day_number = 5;
UPDATE curriculum_day SET subtitle_ko = 'I have / I had — 소유와 경험을 have로 표현하기' WHERE day_number = 6;
UPDATE curriculum_day SET subtitle_ko = 'If it rains / You should rest — 조건과 조언 말하기' WHERE day_number = 7;
UPDATE curriculum_day SET subtitle_ko = 'He/She/They + 요일 표현 — 주어 바꿔 말하기 연습' WHERE day_number = 8;
UPDATE curriculum_day SET subtitle_ko = 'I am happy / It is cold — be동사로 상태 설명하기' WHERE day_number = 9;
UPDATE curriculum_day SET subtitle_ko = 'Where is it? / Is she here? — be동사 위치와 질문 만들기' WHERE day_number = 10;
UPDATE curriculum_day SET subtitle_ko = 'I was tired / Were you there? — 과거 상태와 질문' WHERE day_number = 11;
UPDATE curriculum_day SET subtitle_ko = 'It will be fun / I enjoy swimming — 미래 be동사와 동명사' WHERE day_number = 12;
UPDATE curriculum_day SET subtitle_ko = 'to eat / quickly / is running — 목적·부사·진행형 조합' WHERE day_number = 13;
UPDATE curriculum_day SET subtitle_ko = 'take a look / Who said that? — take 활용과 의문사 주어' WHERE day_number = 14;
UPDATE curriculum_day SET subtitle_ko = 'a big red car / the other one — 명사를 꾸미고 대체하기' WHERE day_number = 15;
UPDATE curriculum_day SET subtitle_ko = 'was running / I think / will be able to — 진행·의견·변형 표현' WHERE day_number = 16;
UPDATE curriculum_day SET subtitle_ko = 'I gotta go / for you / I know that — 구어체와 연결 표현' WHERE day_number = 17;
UPDATE curriculum_day SET subtitle_ko = 'because / so / as soon as — 접속사로 문장 이어 붙이기' WHERE day_number = 18;
UPDATE curriculum_day SET subtitle_ko = 'what to do / I think that he — 의문사+to와 that절 확장' WHERE day_number = 19;
UPDATE curriculum_day SET subtitle_ko = 'the person who / It is important to — 관계사와 It is 패턴' WHERE day_number = 20;
UPDATE curriculum_day SET subtitle_ko = 'I have been / Have you ever? — 경험과 완료를 현재완료로' WHERE day_number = 21;
UPDATE curriculum_day SET subtitle_ko = 'I''ve been waiting / the book which — 현재완료 진행과 관계사' WHERE day_number = 22;
UPDATE curriculum_day SET subtitle_ko = 'It was made / is being built — 수동태로 관점 바꾸기' WHERE day_number = 23;
UPDATE curriculum_day SET subtitle_ko = 'the man (that) I met / I think (that) — 생략으로 자연스럽게' WHERE day_number = 24;
UPDATE curriculum_day SET subtitle_ko = 'help me do / keep going / make it work — 동사+동사 패턴' WHERE day_number = 25;
UPDATE curriculum_day SET subtitle_ko = 'It looks good / I had it fixed — 감각·사역동사 활용' WHERE day_number = 26;
UPDATE curriculum_day SET subtitle_ko = 'I''m afraid of / proud of / Is it okay? — 감정과 질문법' WHERE day_number = 27;
UPDATE curriculum_day SET subtitle_ko = 'Will you? / Do you want me to? — 미래 질문과 제안하기' WHERE day_number = 28;
UPDATE curriculum_day SET subtitle_ko = 'I used to / Do you mind? / It takes — 습관·양해·소요 표현' WHERE day_number = 29;
UPDATE curriculum_day SET subtitle_ko = 'I wish I had / I told you to / if so — 후회·전달·조건 마무리' WHERE day_number = 30;
