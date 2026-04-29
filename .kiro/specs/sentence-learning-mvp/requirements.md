# Requirements Document — 문장·독해 학습 MVP

## Introduction

본 스펙은 SentenceFlow 앱의 **문장·독해 학습 MVP P0 기능 전체**를 대상으로 한다.
사용자는 짧은 문장(트랙 A)과 긴 문장(트랙 B)을 학습하며, 막히는 단어는 Vocab Helper 바텀 시트로 즉시 해결한다. 앱은 원어민 발음을 제공하지만 사용자의 발화·발음은 평가하지 않는다. 학습 진도는 기기 로컬에 기록된 후 Supabase로 동기화되며, AdMob 배너·Rewarded 광고로 운영비를 확보한다.

후속 스펙으로 분리되는 항목: 주관식 독해 퀴즈(AI 채점), AI 회화 파트너, 빈칸 채우기·듣고 받아쓰기, 외부 매체 헤드라인+링크, 영어 교육 제휴(CPA).

## Glossary

- **App**: 모바일 학습 앱 전체 (React Native)
- **Sentence**: 학습 대상 문장 엔터티. 영어 원문·한국어 번역·CEFR_Level·상황 태그·라이선스 메타데이터를 보유
- **Track_A**: 짧은 문장(회화형) 학습 트랙. 일상 회화 위주
- **Track_B**: 긴 문장(독해형) 학습 트랙. 20~40단어 실문장
- **Track_A_Player**: 트랙 A 한 문장을 제시 → 듣기 → 이해 확인까지 책임지는 화면 컴포넌트
- **Track_B_Player**: 트랙 B 한 문장을 청킹·섀도잉·구조 요약까지 진행하는 화면 컴포넌트
- **Audio_Service**: 원어민 발음 재생을 담당하는 서비스. 사전 생성 오디오 캐시 우선, 기기 TTS 폴백
- **Speed_Control**: 0.5x / 0.75x / 1x / 1.25x 재생 속도 조절 컨트롤
- **Pattern_Drill**: 트랙 A의 같은 문장 구조를 유지한 채 단어를 교체해 반복 노출하는 학습 유닛
- **Chunk**: 긴 문장을 의미 단위로 분할한 조각. depth(종속절 깊이)와 role(문법 역할)을 가짐
- **Chunking_View**: 청킹된 문장을 색·들여쓰기로 시각화하는 컴포넌트
- **Shadowing_Player**: 오디오 지연 재생·구간 반복·속도 조절을 통한 섀도잉 학습 컴포넌트
- **Structure_Summary**: "누가 / 무엇을 / 어디에 / 언제" 4요소로 긴 문장을 요약 표시하는 뷰
- **Vocab_Helper**: 문장 내 단어 탭 시 바텀 시트로 열리는 단어 해결 모듈
- **Etymology_View**: voca 방식(어원 분해) 탭
- **Mnemonic_View**: 경선식 방식(한국어 발음 연상) 탭
- **Word_Unresolved_Score**: 사용자가 문장 학습 중 단어를 탭한 빈도·주기로 계산되는 "미해결도" 점수. 다음 노출 문장 우선순위에 사용
- **Content_Pool**: 사전 큐레이션된 문장 콘텐츠 저장소. Tatoeba·VOA·Simple Wiki 등 라이선스 태그 포함
- **CEFR_Level**: A1/A2/B1/B2/C1/C2 어휘·문법 레벨 태그
- **Progress_Tracker**: 일일 목표, 누적 학습 수, 스트릭을 관리하는 컴포넌트
- **Streak**: 연속 학습 일수
- **Daily_Goal**: 사용자별 일일 학습 문장 수 목표 (기본 10문장)
- **Ad_Service**: AdMob SDK 래퍼. 배너·Rewarded 광고 관리
- **Reward_Grant**: Rewarded Ad 시청 완료 시 사용자에게 지급되는 보상(하트 회복·재도전·다음 레슨 미리 열기)
- **Heart**: 오답·실수 시 차감되는 라이프. 0이 되면 일부 세션 제한
- **Auth_Service**: Supabase Auth 기반 이메일·Apple·Google 로그인 서비스
- **Sync_Service**: 로컬 SQLite와 Supabase 간 학습 이벤트 동기화 서비스
- **Local_Store**: 기기 내 SQLite 기반 학습 데이터 저장소
- **Edge_Function**: Supabase Edge Function. 외부 AI/제휴 호출 프록시 역할(본 스펙에서는 TTS 오디오 URL 서명 등)

## Requirements

### Requirement 1: 트랙 A — 짧은 문장 학습 플로우

**User Story:** 학습자로서 짧은 회화 문장을 듣고 이해하여, 필요하면 따라 말하며 문장을 익히고자 한다.

#### Acceptance Criteria

1. WHEN 사용자가 트랙 A 세션을 시작하면, THE Track_A_Player SHALL Content_Pool에서 사용자 CEFR_Level과 Word_Unresolved_Score 우선순위에 따라 다음 Sentence를 제시한다.
2. WHEN Sentence가 제시되면, THE Track_A_Player SHALL 영어 원문을 먼저 표시하고 한국어 번역은 토글 버튼으로만 공개한다.
3. WHEN Sentence가 화면에 나타나면, THE Track_A_Player SHALL Audio_Service에 원어민 발음 자동 재생을 1회 요청한다.
4. THE Track_A_Player SHALL 재생 버튼을 화면에 항상 노출하여 사용자가 원할 때마다 재생을 반복할 수 있게 한다.
5. THE Track_A_Player SHALL 사용자가 따라 말하기를 했는지 여부를 **감지·평가·기록하지 않는다**.
6. WHEN 사용자가 "다음" 버튼을 누르면, THE Track_A_Player SHALL 현재 문장 학습을 완료 처리하고 다음 Sentence로 진행한다.
7. THE Track_A_Player SHALL 현재 문장에 대해 "알았어요 / 어려워요" 두 등급의 피드백만 수집하며, 이 정보는 다음 문장 선정 우선순위 조정에만 사용한다.
8. IF 사용자가 Sentence 내 단어를 탭하면, THEN THE Track_A_Player SHALL Vocab_Helper를 바텀 시트로 연다.

### Requirement 2: 트랙 A — 패턴 드릴 (Substitution Drill)

**User Story:** 학습자로서 같은 문장 구조를 반복 노출받아 머릿속에 영어 문형 감각을 심고자 한다.

#### Acceptance Criteria

1. WHEN 사용자가 트랙 A의 Pattern_Drill 세션을 시작하면, THE Track_A_Player SHALL 원문 1개와 변형 5~8개로 구성된 드릴 세트를 로드한다.
2. THE Pattern_Drill SHALL 4단계 레벨 — Level 1(원문 반복), Level 2(같은 자리 단어 교체), Level 3(다른 자리 교체: 동사·주어·시제), Level 4(슬롯 채우기) — 순서로 진행된다.
3. WHEN Level 2 또는 Level 3 변형 문장이 제시되면, THE Audio_Service SHALL 해당 변형 문장의 원어민 오디오를 재생한다.
4. WHEN Level 4 슬롯 채우기 단계에서 사용자가 단어를 선택하면, THE Pattern_Drill SHALL 완성된 문장의 문법 성립 여부를 로컬 룰 기반으로 검증한다.
5. IF Level 4 완성 문장이 문법적으로 성립하지 않으면, THEN THE Pattern_Drill SHALL 사용자에게 재선택을 안내하되 오답 페널티는 부과하지 않는다.
6. THE Pattern_Drill SHALL 발음 정확도나 사용자 발화 여부를 판정하지 않는다.
7. WHEN 같은 패턴 드릴을 Drill_Completion_Threshold(기본 3회) 이상 완료하면, THE Progress_Tracker SHALL "패턴 마스터" 배지를 지급한다.

### Requirement 3: 트랙 B — 긴 문장 학습 플로우

**User Story:** 시험·실무를 준비하는 학습자로서 긴 영어 문장을 의미 단위로 쪼개 이해하고자 한다.

#### Acceptance Criteria

1. WHEN 사용자가 트랙 B 세션을 시작하면, THE Track_B_Player SHALL Content_Pool에서 사용자 CEFR_Level에 맞는 긴 Sentence를 하나 제시한다.
2. WHEN Sentence가 제시되면, THE Track_B_Player SHALL 4단계 — 청킹 → 청크별 듣기 → 섀도잉 → 구조 요약 — 를 순서대로 진행한다.
3. THE Track_B_Player SHALL 각 단계마다 "건너뛰기" 버튼을 제공하여 사용자가 일부 단계를 생략할 수 있게 한다.
4. WHEN 사용자가 Sentence 내 단어를 탭하면, THE Track_B_Player SHALL Vocab_Helper를 바텀 시트로 열고 원 문장 위치를 유지한다.
5. WHEN 사용자가 Sentence 학습을 완료 처리하면, THE Progress_Tracker SHALL 해당 Sentence를 "학습 완료"로 기록한다.

### Requirement 4: 트랙 B — 청킹 시각화

**User Story:** 학습자로서 긴 문장의 구조가 한눈에 보여야 의미 단위로 이해할 수 있다.

#### Acceptance Criteria

1. WHEN Track_B_Player가 청킹 단계에 진입하면, THE Chunking_View SHALL Content_Pool에 사전 저장된 Chunk 배열을 로드한다.
2. THE Chunking_View SHALL 각 Chunk를 depth에 비례한 들여쓰기와 role별 색상으로 시각화한다.
3. WHEN 사용자가 특정 Chunk를 탭하면, THE Audio_Service SHALL 해당 Chunk만 재생한다.
4. IF Content_Pool에 해당 Sentence의 Chunk 배열이 없으면, THEN THE Chunking_View SHALL 단일 Chunk(전체 문장)로 폴백 표시한다.
5. THE Chunking_View SHALL Chunk 단위로 단어 탭을 지원하여 Vocab_Helper 호출이 가능하게 한다.

### Requirement 5: 트랙 B — 섀도잉 플레이어

**User Story:** 학습자로서 원어민 속도에 맞춰 따라 말하는 연습 기회를 스스로 선택하여 활용하고자 한다.

#### Acceptance Criteria

1. WHEN Track_B_Player가 섀도잉 단계에 진입하면, THE Shadowing_Player SHALL 전체 문장 오디오를 1회 자동 재생한다.
2. THE Shadowing_Player SHALL Speed_Control을 통해 0.5x / 0.75x / 1x / 1.25x 재생 속도 선택을 제공한다.
3. WHEN 사용자가 "구간 반복" 버튼을 누르면, THE Shadowing_Player SHALL 현재 Chunk를 연속 2회 재생한다.
4. WHEN 사용자가 "청크 단위 일시정지" 옵션을 활성화하면, THE Shadowing_Player SHALL 각 Chunk 종료 후 자동으로 1.5초 일시정지한다.
5. THE Shadowing_Player SHALL 사용자의 따라 말하기를 녹음·인식·평가하지 않는다.

### Requirement 6: 트랙 B — 구조 요약

**User Story:** 학습자로서 긴 문장을 읽은 뒤 핵심을 한 번에 정리하고자 한다.

#### Acceptance Criteria

1. WHEN Track_B_Player가 구조 요약 단계에 진입하면, THE Structure_Summary SHALL "누가 / 무엇을 / 어디에 / 언제" 4요소 슬롯을 표시한다.
2. THE Structure_Summary SHALL Content_Pool에 사전 저장된 요약 메타데이터를 로드하여 각 슬롯에 채운다.
3. WHERE 특정 슬롯의 요약 값이 존재하지 않으면, THE Structure_Summary SHALL 해당 슬롯을 "—"로 표시한다.
4. THE Structure_Summary SHALL 사용자 입력을 요구하지 않는다. (주관식 독해 퀴즈는 후속 스펙)

### Requirement 7: Audio Service — 원어민 발음 재생

**User Story:** 학습자로서 어떤 문장이든 원어민 음성을 즉시 들을 수 있어야 한다.

#### Acceptance Criteria

1. WHEN Audio_Service에 재생 요청이 들어오면, THE Audio_Service SHALL 해당 Sentence 또는 Chunk의 로컬 캐시된 오디오를 우선 재생한다.
2. IF 로컬 캐시가 없으면, THEN THE Audio_Service SHALL Supabase Storage의 사전 생성 오디오 URL을 요청하고 재생 후 로컬에 캐시한다.
3. IF 네트워크가 없고 로컬 캐시도 없으면, THEN THE Audio_Service SHALL 기기 내장 TTS로 폴백 재생한다.
4. THE Audio_Service SHALL 재생 속도 배율(0.5x / 0.75x / 1x / 1.25x)을 Speed_Control 입력에 따라 적용한다.
5. THE Audio_Service SHALL 사용자 마이크에 접근하지 않는다.
6. WHEN 사용자가 현재 재생을 중단하면, THE Audio_Service SHALL 즉시 재생을 종료한다.

### Requirement 8: Vocab Helper — 호출과 표시

**User Story:** 학습자로서 문장 속 모르는 단어를 탭했을 때 흐름을 끊지 않고 단어를 해결하고자 한다.

#### Acceptance Criteria

1. WHEN 사용자가 Track_A_Player 또는 Track_B_Player에서 단어를 탭하면, THE Vocab_Helper SHALL 하단에서 올라오는 바텀 시트로 열린다.
2. THE Vocab_Helper SHALL 단어, 품사, 한국어 뜻, IPA 발음 기호, 🔊 발음 재생 버튼을 기본 노출한다.
3. THE Vocab_Helper SHALL Etymology_View, Mnemonic_View, 예문 뷰의 3개 탭을 제공한다.
4. WHERE 사용자가 선호 탭을 설정했다면, THE Vocab_Helper SHALL 해당 탭을 기본 활성화한다.
5. IF Etymology_View 데이터가 존재하지 않으면, THEN THE Vocab_Helper SHALL 해당 탭을 숨긴다.
6. IF Mnemonic_View 데이터가 존재하지 않으면, THEN THE Vocab_Helper SHALL 해당 탭을 숨긴다.
7. WHEN 사용자가 바텀 시트를 닫으면, THE Vocab_Helper SHALL 원 문장 학습 지점으로 즉시 복귀한다.
8. THE Vocab_Helper SHALL 별도 화면 또는 탭으로 승격되지 않으며 바텀 시트 모달 형태로만 존재한다.

### Requirement 9: Vocab Helper — Etymology (voca) 콘텐츠

**User Story:** 학습자로서 어원 분해를 통해 단어를 논리적으로 이해하고자 한다.

#### Acceptance Criteria

1. THE Etymology_View SHALL 단어의 접두사/어근/접미사 분해와 각 요소의 의미를 표시한다.
2. THE Etymology_View SHALL 같은 어근을 공유하는 관련 단어 목록을 최대 5개 표시한다.
3. WHEN 사용자가 관련 단어 중 하나를 탭하면, THE Vocab_Helper SHALL 해당 단어의 Vocab_Helper 시트로 전환한다.
4. THE Etymology_View SHALL 외부 교재의 콘텐츠를 직접 복제하지 않고 자체 제작 또는 공개 어원 데이터 기반 데이터만 사용한다.

### Requirement 10: Vocab Helper — Mnemonic (경선식) 콘텐츠

**User Story:** 학습자로서 발음 기반 한국어 연상으로 단어를 빠르게 기억하고자 한다.

#### Acceptance Criteria

1. THE Mnemonic_View SHALL 단어 발음을 이용한 한국어 연상 문구를 1개 표시한다.
2. THE Mnemonic_View SHALL 연상을 뒷받침하는 한 문장의 스토리 설명을 포함한다.
3. THE Mnemonic_View SHALL 외부 교재 콘텐츠를 복제하지 않고 자체 제작된 연상 데이터만 사용한다.

### Requirement 11: Content Pool — 콘텐츠 적재 및 필터링

**User Story:** 학습자로서 내 수준에 맞는 문장만 제시받아 이탈 없이 학습하고자 한다.

#### Acceptance Criteria

1. THE Content_Pool SHALL 각 Sentence에 영어 원문, 한국어 번역, CEFR_Level, 상황 태그, 출처(Source), 라이선스(License), 수집일을 저장한다.
2. WHEN Track_A_Player 또는 Track_B_Player가 다음 Sentence를 요청하면, THE Content_Pool SHALL 사용자 CEFR_Level과 일치하거나 한 단계 낮은 레벨의 Sentence만 반환한다.
3. THE Content_Pool SHALL Word_Unresolved_Score가 높은 단어를 포함한 Sentence에 추천 가중치를 부여한다.
4. THE Content_Pool SHALL 큐레이션 체크리스트를 통과한 Sentence만 production으로 승격하며 staging 상태의 Sentence는 사용자에게 노출하지 않는다.
5. THE Content_Pool SHALL Source에 따라 노출 제약을 적용한다. (CC BY-SA 출처 문장은 앱 내 개인 학습용으로만 제공하며 별도 표시)

### Requirement 12: Word Unresolved Score

**User Story:** 학습자로서 자주 막히는 단어가 포함된 문장을 더 자주 만나 복습 효과를 얻고자 한다.

#### Acceptance Criteria

1. WHEN 사용자가 문장 학습 중 단어를 탭하여 Vocab_Helper를 열면, THE Local_Store SHALL 해당 단어의 탭 이벤트(word, timestamp)를 기록한다.
2. THE Word_Unresolved_Score SHALL 최근 30일 내 탭 횟수와 최근 탭 시점의 가중치로 단어별 점수를 계산한다.
3. THE Word_Unresolved_Score SHALL 단어 단독 SRS 복습 화면을 노출하지 않는다. 복습은 해당 단어를 포함한 Sentence 우선 노출로만 이루어진다.
4. WHERE 사용자가 "내 단어 다시 보기" 메뉴에 진입하면, THE App SHALL 최근 탭된 단어 목록을 Vocab_Helper 카드 형태로 나열한다.

### Requirement 13: Progress Tracker — 일일 목표와 스트릭

**User Story:** 학습자로서 매일 꾸준히 공부하는 리듬을 시각적으로 유지하고자 한다.

#### Acceptance Criteria

1. THE Progress_Tracker SHALL 사용자별 Daily_Goal(기본 10문장)을 저장하고 사용자가 설정 변경 시 즉시 반영한다.
2. THE Progress_Tracker SHALL 사용자 로컬 타임존 자정 기준으로 일일 학습 카운터를 리셋한다.
3. WHEN 사용자가 Sentence 하나를 학습 완료하면, THE Progress_Tracker SHALL 오늘의 학습 카운터를 1 증가시킨다.
4. WHEN 오늘의 학습 카운터가 Daily_Goal 이상이 되면, THE Progress_Tracker SHALL 해당 날짜를 "학습한 날"로 기록하고 Streak을 1 증가시킨다.
5. IF 사용자가 달력상 하루(자정~자정)를 완전히 건너뛰면, THEN THE Progress_Tracker SHALL Streak을 0으로 재설정한다.
6. THE Progress_Tracker SHALL 대시보드에 누적 학습 문장 수, 오늘 학습 수, 현재 Streak, 최고 Streak을 표시한다.

### Requirement 14: AdMob 배너

**User Story:** 운영자로서 학습 흐름을 해치지 않는 위치에만 배너를 노출해 운영비를 확보한다.

#### Acceptance Criteria

1. THE Ad_Service SHALL 대시보드, 설정, "내 단어 다시 보기" 화면에만 배너를 노출한다.
2. THE Ad_Service SHALL Track_A_Player 및 Track_B_Player가 활성화된 학습 세션 중에는 배너를 노출하지 않는다.
3. THE Ad_Service SHALL Vocab_Helper 바텀 시트 내부에 배너를 노출하지 않는다.
4. IF Ad_Service가 광고 로드에 실패하면, THEN THE App SHALL 배너 영역을 0 높이로 축소하여 레이아웃 붕괴를 방지한다.
5. THE App SHALL 배너 상단에 "운영 후원 광고" 라벨을 표시한다.

### Requirement 15: AdMob Rewarded

**User Story:** 학습자로서 광고를 선택적으로 시청하고 보상을 받고자 한다.

#### Acceptance Criteria

1. WHEN 사용자가 Rewarded 시청 버튼을 탭하면, THE Ad_Service SHALL AdMob Rewarded Ad를 표시한다.
2. THE Ad_Service SHALL Rewarded Ad 진입 전 보상 내용과 예상 시청 시간을 확인 화면으로 표시한다.
3. WHEN 사용자가 Rewarded Ad를 끝까지 시청 완료하면, THE Ad_Service SHALL Reward_Grant를 발행한다.
4. IF 사용자가 Rewarded Ad를 도중에 종료하면, THEN THE Ad_Service SHALL Reward_Grant를 발행하지 않는다.
5. THE Reward_Grant SHALL 다음 중 사용자가 선택한 한 가지를 지급한다: Heart 회복, 잠금된 다음 레슨 미리 열기, 패턴 드릴 재도전 기회.
6. THE Ad_Service SHALL 보상 유형별 1일 Rewarded 획득 횟수 상한을 적용한다.
7. THE Ad_Service SHALL 학습 세션 중 전면 광고를 자동 재생하지 않는다.

### Requirement 16: Auth Service — 로그인과 익명 모드

**User Story:** 학습자로서 기기를 바꿔도 진도가 유지되고, 가입 전에도 학습을 시작할 수 있어야 한다.

#### Acceptance Criteria

1. THE Auth_Service SHALL Supabase Auth 기반 이메일 로그인, Apple 로그인, Google 로그인을 지원한다.
2. WHERE 사용자가 로그인하지 않은 상태이면, THE App SHALL 익명 모드로 동작하며 모든 학습 데이터를 Local_Store에만 저장한다.
3. WHEN 익명 사용자가 처음 로그인하면, THE Sync_Service SHALL 로컬 학습 데이터를 해당 계정으로 병합한 뒤 Supabase에 업로드한다.
4. WHEN 로그인 사용자가 로그아웃하면, THE App SHALL 로컬 캐시된 개인 데이터를 정리하되 전송되지 않은 동기화 큐는 보존한다.
5. THE Auth_Service SHALL Firebase Authentication을 사용하지 않는다.

### Requirement 17: Sync Service — 오프라인 동기화

**User Story:** 학습자로서 오프라인에서도 학습할 수 있고, 온라인 복구 시 자동으로 동기화되길 원한다.

#### Acceptance Criteria

1. WHEN 학습 이벤트(Sentence 완료, Word 탭, Heart 변화, Streak 업데이트 등)가 발생하면, THE Local_Store SHALL 해당 이벤트를 즉시 기록한다.
2. THE Sync_Service SHALL 기록된 이벤트를 Local_Store의 동기화 큐에 순서대로 enqueue한다.
3. WHEN 네트워크 연결이 복구되면, THE Sync_Service SHALL 동기화 큐의 이벤트를 순차적으로 Supabase에 전송한다.
4. WHEN 동일 엔터티에 대해 로컬과 서버 양쪽 변경이 감지되면, THE Sync_Service SHALL updated_at이 더 큰 쪽을 채택한다.
5. WHEN 이벤트 전송이 성공하면, THE Sync_Service SHALL 해당 이벤트를 동기화 큐에서 제거한다.
6. IF 이벤트 전송이 실패하면, THEN THE Sync_Service SHALL 지수 백오프로 최대 3회 재시도한 뒤 큐에 유지한다.
7. THE Sync_Service SHALL 사용자 데이터 업로드 시 Supabase RLS 정책을 신뢰하며 본인 소유 레코드만 접근한다.

### Requirement 18: 첫 실행 온보딩

**User Story:** 처음 앱을 여는 학습자로서 자신에게 맞는 레벨과 트랙을 빠르게 설정하고자 한다.

#### Acceptance Criteria

1. WHEN 사용자가 앱을 처음 실행하면, THE App SHALL 언어 선호, CEFR_Level 자가 진단, 기본 트랙 선택(A / B / 둘 다) 플로우를 표시한다.
2. THE 온보딩 SHALL 발화 강제 기능이 없다는 점을 명시적으로 안내한다.
3. WHEN 사용자가 온보딩을 완료하면, THE App SHALL Local_Store에 기본 설정을 저장한다.
4. THE 온보딩 SHALL 로그인을 필수로 요구하지 않으며 건너뛰기가 가능하다.

## Out of Scope (본 스펙 제외)

다음은 Product Context의 Non-Goals 또는 후속 스펙에서 다룬다:

- 사용자 발음·발화 평가, STT 연동, "다 말했어요" 버튼, 발화 타이머
- 단어 단독 학습 코스, 단어 플래시카드 SRS 화면
- 사용자 수집 기능 (공유 시트, 클립보드, OCR, 내 문장 저장)
- 주관식 독해 퀴즈 AI 채점 및 생성 (후속 스펙)
- AI 회화 파트너 (후속 스펙)
- 빈칸 채우기, 듣고 받아쓰기 보조 퀴즈 (후속 스펙)
- 외부 매체(FOX/CNN/Reuters) 헤드라인 + 링크 (후속 스펙)
- 영어 교육 제휴(CPA) 관련 지면
- 유료 구독, 프리미엄 기능 잠금
