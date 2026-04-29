# Design — 문장·독해 학습 MVP

## Overview

SentenceFlow의 문장·독해 학습 MVP는 **오프라인 우선** React Native 앱으로, 모든 학습 이벤트를 로컬 SQLite에 기록한 뒤 Supabase로 비동기 동기화한다. 사용자 발화 평가가 없으므로 STT 의존성을 제거하고, TTS는 사전 생성 오디오 캐시를 1순위로 둔다. AI 호출(Vocab Helper·청킹·구조 요약)은 **사전 배치 생성**으로만 이루어지며 런타임에는 앱에서 AI에 직접 요청하지 않는다. 이로써 MVP의 런타임 비용은 AdMob/Supabase 무료 티어 + TTS 저장소 비용으로 한정된다.

**제약 요약**
- 플랫폼: iOS 14+, Android 8+ (React Native 0.74+, TypeScript strict)
- 오프라인: 네트워크 없이도 기존 Content Pool로 학습 진행
- 무료: 유료 구독 없음. 배너 + Rewarded Ad로만 수익
- AI: 런타임 호출 없음 (MVP 범위). 콘텐츠는 사전 배치로 생성·큐레이션
- 비평가: 사용자 발화·발음·시간 측정 일체 없음

## Architecture

### High-level

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (React Native)                 │
│                                                              │
│  [Navigation]                                                │
│   ├─ Onboarding       → OnboardingScreen                    │
│   ├─ Home (Tabs)                                             │
│   │   ├─ Dashboard    → DashboardScreen + BannerAd          │
│   │   ├─ Track A      → TrackASessionScreen                 │
│   │   ├─ Track B      → TrackBSessionScreen                 │
│   │   └─ Me           → MeScreen + BannerAd                 │
│   └─ Modals                                                  │
│       ├─ VocabHelperSheet  (bottom sheet)                   │
│       └─ RewardedConfirm                                     │
│                                                              │
│  [State & Services]                                          │
│   ├─ Stores (Zustand)                                        │
│   │   ├─ useSessionStore  (current sentence/chunk/step)     │
│   │   ├─ useProgressStore (daily count, streak, hearts)     │
│   │   ├─ useUserStore     (auth, settings, CEFR level)      │
│   │   └─ useVocabStore    (recent tapped words)             │
│   ├─ ContentService   (Content Pool reader)                 │
│   ├─ AudioService     (cache → Storage URL → device TTS)    │
│   ├─ SyncService      (local queue → Supabase)              │
│   ├─ AdService        (AdMob banner + rewarded)             │
│   └─ AuthService      (Supabase Auth)                       │
│                                                              │
│  [Local Store]                                               │
│   └─ SQLite (react-native-quick-sqlite)                     │
│       ├─ user_settings, daily_progress, streak              │
│       ├─ sentence_progress, word_tap_events                 │
│       ├─ sync_queue                                          │
│       └─ content_cache (read-only mirror of server pool)    │
└─────────────────────────────────────────────────────────────┘
                           ▲  │
                           │  ▼
┌─────────────────────────────────────────────────────────────┐
│                         Supabase                             │
│                                                              │
│  Auth (email / Apple / Google)                               │
│  PostgreSQL (RLS on)                                         │
│    ├─ sentences, chunks, sentence_summary                   │
│    ├─ vocab_entries                                          │
│    ├─ pattern_drills                                         │
│    ├─ user_sentence_progress, user_word_tap                 │
│    ├─ user_daily_progress, user_streak                      │
│    └─ user_rewards_log                                       │
│  Storage: audio/{sentence_id}.m4a, audio/chunks/{chunk_id}  │
│  Edge Functions:                                             │
│    └─ get-signed-audio-url (Storage signed URLs)             │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │  (batch, offline, not runtime)
┌─────────────────────────────────────────────────────────────┐
│             Content Pipeline (별도 프로세스, MVP 밖)          │
│   Tatoeba / VOA / Wiki seed → LLM 확장 → 큐레이션 →          │
│   Supabase 적재 + TTS 사전 생성                               │
└─────────────────────────────────────────────────────────────┘
```

### 학습 세션 데이터 흐름 (트랙 A 예시)

```
User taps "트랙 A 시작"
  → TrackASessionScreen mounts
  → useSessionStore.loadNext()
      → ContentService.getNextSentence(cefr, wordUnresolvedScore)
          → SELECT FROM content_cache (local) — 우선
          → 없으면 Supabase 조회 후 캐시 채움
      → AudioService.prefetch(sentenceId)
          → local FS hit? → return
          → Storage signed URL → download → cache
  → 화면 렌더 + 🔊 자동 재생 1회 (Req 1.3)
  → 사용자 탭 "다음" → useSessionStore.complete()
      → Local_Store: insert sentence_progress
      → SyncService.enqueue("sentence_completed", {...})
      → useProgressStore.bumpDailyCount()
      → loadNext() 반복
```

### 오프라인 → 온라인 복구

```
Network comes back
  → SyncService watchdog (NetInfo) fires
  → read sync_queue in FIFO order
  → POST /rest/v1/... (Supabase PostgREST) via authorized client
  → success → DELETE from sync_queue
  → failure → exponential backoff (max 3 retries) → remain in queue
```

## Components

각 Component는 요구사항 ID를 명시적으로 참조한다.

### Navigation

- 역할: 루트 네비게이션, 탭/스택/모달 구조 관리
- Stack: `Onboarding` (초기), `Root` (Tab Navigator: Dashboard / TrackA / TrackB / Me)
- Modal Stack: `VocabHelperSheet`, `RewardedConfirm`
- 의존: React Navigation v6
- 요구사항 매핑: Req 18 (onboarding 진입), 기타 화면 컴포넌트 전개

### OnboardingScreen

- 역할: 언어 선호 선택 → CEFR 자가 선택 → 기본 트랙 선택 3스텝 플로우
- Props 없음. `useUserStore`에 저장
- 발화 강제 없음을 안내하는 고정 패널 포함
- 로그인은 건너뛰기 버튼 제공
- 요구사항 매핑: Req 18.1, 18.2, 18.3, 18.4

### DashboardScreen

- 역할: 오늘의 학습 수, Streak, 누적 학습 수, 일일 목표 진행률, 시작 CTA 2개(트랙 A/B)
- `useProgressStore` 구독
- 하단 `BannerAd` 배치 (세션 중 화면이 아니므로 허용)
- 요구사항 매핑: Req 13.6, Req 14.1

### TrackASessionScreen / Track_A_Player

- 역할: 짧은 문장 1개 단위의 제시 → 듣기 → 이해 확인 루프
- 상태: `currentSentence`, `isKoreanVisible`, `isPatternDrillMode`
- 서브 컴포넌트:
  - `SentenceCard` — 영어 원문, 한국어 토글, 단어 탭 가능
  - `AudioControls` — 🔊 재생 버튼 (속도 조절은 트랙 A에서 비노출, 기본 1x)
  - `FeedbackBar` — "알았어요 / 어려워요" 두 버튼
  - `PatternDrillPanel` — 드릴 모드 전환 시 노출 (Req 2)
- 배너 노출 금지 (Req 14.2)
- 요구사항 매핑: Req 1.1~1.8, Req 2.1~2.7

### TrackBSessionScreen / Track_B_Player

- 역할: 긴 문장 1개 단위의 4단계(청킹→듣기→섀도잉→구조 요약) 플로우
- 상태: `currentSentence`, `chunks`, `currentStep` (enum: CHUNKING / LISTEN / SHADOWING / SUMMARY)
- 서브 컴포넌트:
  - `ChunkingView` (Req 4)
  - `ShadowingPlayer` (Req 5)
  - `StructureSummaryView` (Req 6)
  - `StepNavigator` — 이전/다음/건너뛰기
- 요구사항 매핑: Req 3.1~3.5, Req 4.1~4.5, Req 5.1~5.5, Req 6.1~6.4

### VocabHelperSheet / Vocab_Helper

- 역할: 단어 탭 시 바텀 시트로 열려 voca/경선식/예문 탭 제공
- Props: `word: string`, `sourceSentenceId?: string`
- 내부 상태: `activeTab` (etymology | mnemonic | examples), 사용자 선호 탭 기본 활성
- 진입 시 로컬 캐시 조회 → 없으면 Supabase `vocab_entries` 조회 → 캐시
- 단어 탭 이벤트를 `word_tap_events`에 기록 (Req 12.1)
- 요구사항 매핑: Req 8.1~8.8, Req 9.1~9.4, Req 10.1~10.3, Req 12.1

### Etymology_View / Mnemonic_View

- 역할: Vocab_Helper의 탭별 뷰
- 데이터 없음 시 탭 자체 숨김 (Req 8.5, 8.6)
- 관련 단어 탭 시 `VocabHelperSheet`를 새 단어로 swap (Req 9.3)
- 요구사항 매핑: Req 9, Req 10

### MeScreen

- 역할: 설정, "내 단어 다시 보기", 로그인/로그아웃, Daily_Goal 설정
- `BannerAd` 허용 (세션 중 아님)
- 요구사항 매핑: Req 12.4, Req 13.1, Req 14.1, Req 16

### AudioService

- 역할: 재생 요청을 받아 캐시 → 사전 생성 오디오 → 기기 TTS 순서로 시도
- 공개 메서드:
  ```ts
  play(sourceId: string, kind: 'sentence' | 'chunk' | 'word', speed?: 0.5|0.75|1|1.25): Promise<void>
  stop(): void
  prefetch(sourceId: string, kind): Promise<void>
  ```
- 내부:
  - `react-native-track-player` 또는 `expo-av` 기반
  - LRU 오디오 캐시 (최대 200MB, 설정에서 비우기 가능)
  - 속도 조절은 `setRate` API로 (재합성 아님) — Req 7.4
  - 마이크 권한 요청하지 않음 — Req 7.5
- 요구사항 매핑: Req 7.1~7.6, Req 1.3, Req 5.2

### ContentService

- 역할: 문장·청크·vocab 데이터 fetch + 캐시
- 공개 메서드:
  ```ts
  getNextSentence(track: 'A' | 'B', cefr: CEFRLevel): Promise<Sentence>
  getChunks(sentenceId: string): Promise<Chunk[]>
  getSentenceSummary(sentenceId: string): Promise<StructureSummary | null>
  getVocabEntry(word: string): Promise<VocabEntry | null>
  getPatternDrillSet(originSentenceId: string): Promise<PatternDrill | null>
  getRecentTappedWords(limit: number): Promise<Word[]>
  ```
- 우선순위 계산: `wordUnresolvedScore`가 높은 단어 포함 문장에 +가중치
- 요구사항 매핑: Req 11.1~11.5, Req 12.2, Req 12.3

### SyncService

- 역할: 로컬 학습 이벤트 → Supabase 업로드
- 공개 메서드:
  ```ts
  enqueue(event: LearningEvent): void        // 즉시 로컬에 저장
  flushIfOnline(): Promise<void>             // 온라인 복구 시 호출
  mergeAnonymousData(userId: string): Promise<void>  // 익명→로그인 병합
  ```
- 충돌 해결: 동일 레코드 양측 변경 시 `updated_at` 늦은 쪽 채택 (Req 17.4)
- 재시도: 지수 백오프, 최대 3회, 실패 시 큐 유지 (Req 17.6)
- 요구사항 매핑: Req 17.1~17.7, Req 16.3

### AdService

- 역할: AdMob 배너·Rewarded 광고 관리
- 공개 메서드:
  ```ts
  renderBanner(placement: 'dashboard' | 'me' | 'recent-words'): ReactElement
  showRewarded(rewardType: 'heart' | 'unlock' | 'drill-retry'): Promise<RewardGrant | null>
  canGrantReward(rewardType): boolean   // 일일 상한 체크
  ```
- Rewarded 시청 완료 콜백에서만 `RewardGrant` 발행 (Req 15.3, 15.4)
- 배너는 화이트리스트 placement 외 렌더 거부 (Req 14.1, 14.2, 14.3)
- 로드 실패 시 0 높이 반환 (Req 14.4)
- 전면광고 미사용 (Req 15.7)
- 요구사항 매핑: Req 14.1~14.5, Req 15.1~15.7

### AuthService

- 역할: Supabase Auth 래퍼
- 공개 메서드: `signIn / signOut / getUser / signInAnonymouslyLocal`
- `signInAnonymouslyLocal`은 실제 서버 계정 없이 UUID만 로컬 발급 — Supabase 익명 로그인을 쓰지 않고 앱 내부 익명 처리로 단순화
- 로그인 시 `SyncService.mergeAnonymousData()` 호출 (Req 16.3)
- Firebase Auth 사용 안 함 (Req 16.5)
- 요구사항 매핑: Req 16.1~16.5

### Progress_Tracker (논리 컴포넌트, `useProgressStore`)

- 역할: Daily_Goal, 오늘의 학습 수, Streak, Heart 상태 관리
- 자정 리셋 로직: 앱 포그라운드 진입 시 `lastActiveDate != today` 체크 → 일일 카운터 리셋 + 하루 이상 공백이면 Streak 리셋
- 요구사항 매핑: Req 13.1~13.6

## Data Model

### Supabase (PostgreSQL, RLS 활성)

#### `sentences`
```sql
id            uuid PK
track         text         -- 'A' | 'B'
text_en       text NOT NULL
text_ko       text
cefr_level    text         -- 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
situation     text         -- 'cafe' | 'travel' | 'news' 등
source        text NOT NULL   -- 'tatoeba' | 'voa' | 'simple_wiki' | 'llm_expansion'
license       text NOT NULL   -- 'CC-BY-2.0-FR' | 'CC-BY-SA-3.0' | 'PD' | 'proprietary'
word_count    int
status        text NOT NULL   -- 'staging' | 'production'
created_at    timestamptz
updated_at    timestamptz
```

- RLS: public read on `status='production'`. write는 서버 키만.
- 인덱스: (track, cefr_level, status), GIN on situation

#### `chunks`
```sql
id            uuid PK
sentence_id   uuid FK → sentences
order_index   int
text          text
depth         int          -- 0~N 종속절 깊이
role          text         -- enum: subject|verb|object|relative|prep_phrase|...
```

#### `sentence_summary`
```sql
sentence_id   uuid PK FK → sentences
who           text
what          text
where_        text
when_         text
```

#### `pattern_drills`
```sql
id                uuid PK
origin_sentence_id uuid FK → sentences
variants          jsonb    -- [{level, text, slot_hints}]
```

#### `vocab_entries`
```sql
word              text PK (lowercase, normalized)
pos               text
meaning_ko        text
ipa               text
etymology         jsonb    -- {parts: [{text, meaning}], gloss, related: [word]}
mnemonic          jsonb    -- {korean_phrase, story}
example_sentence_ids uuid[]  -- references sentences
```

#### `user_sentence_progress`
```sql
user_id       uuid
sentence_id   uuid
completed_at  timestamptz
feedback      text         -- 'known' | 'hard'
updated_at    timestamptz
PRIMARY KEY (user_id, sentence_id)
```
- RLS: `user_id = auth.uid()`만 select/insert/update

#### `user_word_tap`
```sql
user_id       uuid
word          text
tapped_at     timestamptz
source_sentence_id uuid
```
- RLS: 본인만

#### `user_daily_progress`
```sql
user_id       uuid
date          date
sentences_completed int
goal_met      boolean
PRIMARY KEY (user_id, date)
```

#### `user_streak`
```sql
user_id       uuid PK
current_streak int
best_streak   int
last_goal_met_date date
updated_at    timestamptz
```

#### `user_rewards_log`
```sql
id            uuid PK
user_id       uuid
reward_type   text          -- 'heart' | 'unlock' | 'drill-retry'
granted_at    timestamptz
```
- 일일 상한 체크 시 `granted_at >= today` 카운트 (Req 15.6)

### Local SQLite (클라이언트)

서버 스키마의 축약 복사본 + `sync_queue` + `content_cache`.

```sql
-- 읽기 전용 미러
CREATE TABLE content_cache (
  kind TEXT,           -- 'sentence' | 'chunk' | 'vocab' | ...
  key TEXT,
  payload_json TEXT,
  fetched_at INTEGER,
  PRIMARY KEY (kind, key)
);

-- 학습 이벤트 로컬 저장 (서버 user_* 테이블들과 대응)
CREATE TABLE sentence_progress (...);
CREATE TABLE word_tap_events (...);
CREATE TABLE daily_progress (...);
CREATE TABLE streak (...);
CREATE TABLE rewards_log (...);

-- 동기화 큐
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op TEXT,              -- 'upsert' | 'delete'
  table_name TEXT,
  payload_json TEXT,
  enqueued_at INTEGER,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT
);
```

### Word Unresolved Score (계산식)

Req 12.2의 근거로 아래 수식을 채택한다:

```
score(word) = Σ_{tap in last_30d} decay(now - tap.timestamp)
decay(Δt) = exp( -Δt / HALF_LIFE )   // HALF_LIFE = 7일
```

- 계산은 클라이언트에서 수행 (`useVocabStore` 파생값)
- 상위 N개 단어가 포함된 `sentences`가 `ContentService.getNextSentence` 가중치 +0.5
- 이 값을 바탕으로 **단어 단독 SRS 화면을 절대 만들지 않는다** (Req 12.3, product-context Non-Goals)

## Interfaces

### AudioService → Supabase Storage

1. 오디오 파일 경로 규약:
   - `audio/sentences/{sentence_id}.m4a`
   - `audio/chunks/{chunk_id}.m4a`
   - `audio/vocab/{word}.m4a`
2. signed URL 발급: Edge Function `get-signed-audio-url`
   - 요청: `{kind, key}`
   - 응답: `{url, expires_at}` (15분 유효)
3. 캐시 미스 → 다운로드 → 로컬 FS 저장 → 재생

### External AI (사전 배치, 런타임 아님)

MVP 런타임에는 AI를 부르지 않는다. 아래는 콘텐츠 파이프라인용 스펙:

- **청킹 생성** (Llama 3.1 8B 배치) → `chunks` 테이블에 적재
- **Vocab 생성** (Llama 3.1 8B 배치) → `vocab_entries` 테이블에 적재
- **Structure Summary 생성** (Llama 3.1 8B 배치) → `sentence_summary` 테이블에 적재

프롬프트와 출력 스키마는 `#ai-prompt-designer` steering에서 관리한다. 큐레이터가 적재 전 검수한다.

### AdMob

- 배너: `ca-app-pub-.../<banner_unit_id>` × placement별 분리 (impression 분석용)
- Rewarded: `ca-app-pub-.../<rewarded_unit_id>`
- SDK: `react-native-google-mobile-ads`
- 테스트 기기 ID를 debug 빌드에서만 등록

### UI Routes

| Route | Screen | 배너? | 세션 화면? |
|-------|--------|-------|----------|
| `/onboarding` | OnboardingScreen | no | no |
| `/home/dashboard` | DashboardScreen | yes | no |
| `/home/track-a` | TrackASessionScreen | **no** | **yes** |
| `/home/track-b` | TrackBSessionScreen | **no** | **yes** |
| `/home/me` | MeScreen | yes | no |
| `/me/recent-words` | RecentWordsScreen | yes | no |
| modal `/vocab-helper/:word` | VocabHelperSheet | **no** | n/a |
| modal `/rewarded-confirm` | RewardedConfirm | no | no |

## Error Handling

| 상황 | 대응 |
|------|------|
| Content Pool 조회 실패 (네트워크) | `content_cache`로 폴백. 캐시에도 없으면 "오프라인에서 학습할 콘텐츠가 없어요" 안내 + 일부 pre-seed 20문장 사용 |
| Audio 재생 실패 (캐시·Storage 둘 다 실패) | 기기 TTS 폴백 (Req 7.3). 그마저 실패하면 토스트 안내 후 "다음" 버튼만 노출 |
| Chunk 데이터 없음 | 단일 Chunk = 전체 문장으로 폴백 (Req 4.4) |
| `sentence_summary` 값 없음 | 슬롯을 "—"로 표시 (Req 6.3) |
| AdMob 로드 실패 | 배너 0 높이 (Req 14.4), Rewarded는 시청 버튼 비활성 |
| Rewarded 중도 종료 | Reward 미지급 (Req 15.4) |
| 일일 Rewarded 상한 도달 | 시청 버튼 비활성 + "내일 다시" 문구 |
| Sync 업로드 실패 | 지수 백오프 3회 후 큐 유지, 상단 배너에 "동기화 대기 N건" 표시 |
| 로컬 DB 쓰기 실패 | 세션 일시 중단 + 로그 수집. 복구 후 재시도 |
| 마이크 권한 요청 팝업 발생 | 코드 경로 없음. 발생 시 버그로 간주하고 즉시 제거 |

## Decisions & Trade-offs

### D1. 단어 독립 SRS를 두지 않음

- **대안**: SuperMemo SM-2 기반 단어 카드 SRS
- **선택**: Word Unresolved Score만 계산하여 문장 우선 노출에 반영
- **근거**: product-context의 "단어 단독 학습 코스 = Non-Goal". 탭 이력 기반 우선순위만으로도 문맥 안 복습 효과 확보. 구현 단순
- **트레이드오프**: 복습 집약도는 SRS 대비 떨어질 수 있음. 추후 개선 시 별도 스펙에서 평가

### D2. AI 런타임 호출 없음

- **대안**: 사용자 문장마다 Vocab Helper/청킹을 즉시 AI에 질의
- **선택**: 콘텐츠 파이프라인에서 사전 배치 생성 후 Supabase 적재
- **근거**: AI 비용 통제, 오프라인 지원, Rate Limit 회피. MVP의 콘텐츠는 큐레이션된 풀이므로 사전 생성 가능
- **트레이드오프**: Content Pool에 없는 단어·문장은 Vocab Helper 조회 불가 → "이 단어 정보가 준비 중" 안내 필요

### D3. 익명 모드를 "로컬 UUID"로 단순화

- **대안**: Supabase Anonymous Sign-In API 사용
- **선택**: 로컬에서만 UUID 발급, 로그인 시 데이터 병합
- **근거**: 익명 사용자당 Supabase 레코드 불필요. 계정 전환 시 마이그레이션만 처리하면 됨
- **트레이드오프**: 기기 재설치 시 데이터 손실 가능 → 온보딩에서 "백업하려면 로그인" 안내

### D4. 속도 조절은 트랙 B에서만 노출

- **대안**: 트랙 A/B 공통 속도 컨트롤
- **선택**: 트랙 A는 기본 1x 고정 (짧은 문장은 속도 조절 필요성 낮음), 트랙 B는 `Speed_Control` 제공 (Req 5.2)
- **근거**: UI 단순화, 짧은 문장 학습 리듬 유지
- **트레이드오프**: 트랙 A에서 느리게 듣고 싶은 사용자는 요구 무응답. 실 사용 데이터 확인 후 재검토

### D5. 네이티브 오디오 라이브러리 선택 보류

- `expo-av` (Expo 호환, 속도 조절 OK, iOS 에서 m4a 재생 OK)
- `react-native-track-player` (백그라운드 재생, 큐잉 강함)
- MVP 단계에서는 **`expo-av` 우선 시도**, 백그라운드 재생·알림 컨트롤이 필요해지면 `react-native-track-player`로 교체
- `tech-stack.md`의 "Expo 제약 시 bare 전환" 원칙에 부합

> **업데이트 (Expo SDK 54, Task 6.1):** 실제 구현은 `expo-av` 대신 **`expo-audio`** 로 진행했다.
> Expo SDK 54에서 `expo-av`의 Audio 모듈이 deprecated 되었고, 후속 패키지인 `expo-audio` 가 공식 대체재다.
> `expo-audio` 의 `createAudioPlayer().setPlaybackRate(rate)` 로 Req 7.4(0.5x/0.75x/1x/1.25x) 를 충족한다.
> 배경 재생·큐잉 요구가 생기면 여전히 `react-native-track-player` 로 교체 가능하다.

### D6. react-native-google-mobile-ads 선택

- 대안인 AdMob 공식 Unity SDK·Capacitor 플러그인은 RN 적합성 낮음
- `react-native-google-mobile-ads`는 활발히 유지보수되고 AdMob GDPR/UMP 메시지 연동 지원
- Expo 환경에서는 config plugin으로 적용 가능

### D7. 충돌 해결 = updated_at 최신 승

- **대안**: CRDT, 서버 승, 머지 UI 제공
- **선택**: `updated_at` 최신 값 채택
- **근거**: 학습 이벤트는 대부분 append-only. 동일 레코드 충돌 빈도가 매우 낮음 (같은 문장을 다른 기기에서 동시에 완료하는 케이스)
- **트레이드오프**: Streak 계산이 특수 케이스에서 꼬일 수 있음 — `user_daily_progress` 기반 재계산 로직으로 방어

### D8. Daily_Goal 기본 10문장

- 듀오링고 기본 일일 목표(하루 10~20xp)와 유사한 부담 수준
- 사용자 설정에서 5/10/20/30 중 선택 가능하게 (Req 13.1)

### D9. RLS 기본 정책

- 모든 `user_*` 테이블: `user_id = auth.uid()`
- 콘텐츠 테이블 (`sentences`, `chunks`, `vocab_entries`, `pattern_drills`, `sentence_summary`): `status='production'`에 대해 public read
- 쓰기는 서비스 키(파이프라인 전용)만

### D10. 로컬 SQLite 라이브러리 = `expo-sqlite`

- **대안**: `react-native-quick-sqlite` / `op-sqlite` (JSI 기반, 성능 우위)
- **선택**: Expo 공식 `expo-sqlite`
- **근거**: Expo Go + 웹 미리보기 호환, prebuild(bare) 불필요, tasks 1.5 시점의 개발 흐름 유지. tech-stack.md의 "react-native-quick-sqlite 계열" 가이드는 Expo 공식 대체재를 허용하는 의도로 해석
- **트레이드오프**: JSI 기반 대비 대량 쿼리 성능은 낮음. 전체 Content Pool fulltext search 같은 요구가 생기면 `op-sqlite` + bare 전환으로 재평가
