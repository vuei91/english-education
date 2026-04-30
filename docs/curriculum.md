# Curriculum — 트랙 A 회화 커리큘럼 설계

> 이 문서는 트랙 A(짧은 문장) **커리큘럼의 구조·순서·확장 알고리즘**을 정의한다.
> 교수법 원리와 콘텐츠 소스 전략은 `docs/planning.md` 6-1-1 / 6-1-1-1을 따른다. 여기서는 그 원리를 바탕으로 **어떤 단원을, 어떤 순서로, 어떻게 확장해 가르칠지**를 구체화한다.

## 0. 이 문서의 스코프

| 다룬다 | 다루지 않는다 |
|--------|--------------|
| 단원 구조, 단계(Step) 모델, 확장 알고리즘 | 교수법 이론 배경 (→ planning 6-1-1) |
| 단원 순서(시퀀스)와 레벨 매핑 | 콘텐츠 소스·라이선스 (→ planning 6-1-1-1) |
| 데이터 모델 제안 (단원·단계·문장 관계) | DB 마이그레이션 구현 (→ 후속 spec) |
| 첫 5개 단원의 샘플 콘텐츠 | 트랙 B(독해) 커리큘럼 (별도 문서 예정) |

## 1. 설계 원리

커리큘럼의 근간은 공개된 **Pattern Drill (Substitution Drill)** 교수법이다. SentenceFlow는 이 원리를 **3단계 확장 모델**로 구체화한다.

### 1-1. 3단계 확장 모델

하나의 표현이 사용자에게 "내 것"이 되는 과정을 세 단계로 끊어 제시한다.

```
┌─ Step 1. Phrase ──────────────────────────────────┐
│  최소 의미 단위(동사구/명사구)를 반복해서 듣고 말한다.    │
│    "drink coffee" × N                              │
│  목표: 강세·리듬·발음 각인                            │
└───────────────────────────────────────────────────┘
                    ↓
┌─ Step 2. Conjugation ─────────────────────────────┐
│  같은 구를 주어·인칭·시제로 굴절시킨다.                 │
│    I drink coffee / you drink coffee /             │
│    she drinks coffee / they drink coffee           │
│  목표: 굴절 규칙을 문맥 속에서 자연 습득                │
│         (특히 3인칭 단수 -s)                          │
└───────────────────────────────────────────────────┘
                    ↓
┌─ Step 3. Substitution ────────────────────────────┐
│  같은 문형에 어휘를 치환한다.                          │
│    I drink coffee → I drink juice → I drink water  │
│  목표: 문형 고정 + 어휘 확장                          │
│         기존 PatternDrillPanel로 처리                 │
└───────────────────────────────────────────────────┘
```

### 1-2. 확장 축

단원이 올라갈수록 **세 축**이 점진적으로 열린다.

| 축 | 초반 | 중반 | 후반 |
|----|------|------|------|
| 시제 | 현재형만 | + 과거·미래 | + 완료·진행 |
| 문장 유형 | 긍정 평서문만 | + 부정문 | + 의문문·명령문 |
| 주어·목적어 다양성 | 1~2인칭 · 고빈도 명사 | + 3인칭 · 추상명사 | 자유 |

> 각 단원은 "어떤 축을 새로 여는가"를 명시한다. 한 단원에서 두 축 이상을 동시에 열지 않는다 — 한 번에 하나만 바꿔야 학습자가 변화를 감지할 수 있다.

### 1-3. "왜 패턴 A 먼저인가"의 원칙

단원 순서를 정할 때는 아래 우선순위를 따른다:

1. **고빈도 동사 우선** — `have / do / go / get / make / take / drink / eat / want` 등
2. **굴절 규칙이 단순한 것 우선** — 불규칙 동사는 같은 문형이 익은 뒤 도입
3. **앞 단원의 어휘·구조를 재활용할 수 있는 것** — 복습이 자동으로 일어나도록
4. **일상 상황 커버리지** — 너무 추상적·업무적 표현은 중급 이후

## 2. 문법 트랙 카탈로그

3단계 확장 모델은 "한 단원을 어떻게 가르치나"를 정의한다. 문법 트랙은 "단원들을 어떤 순서로 배치하나"를 정의한다.

트랙은 네 갈래로 나눈다. 한 단원은 네 트랙 중 **정확히 한 지점**을 "새로 여는" 역할만 한다. 다른 세 트랙은 이전 단원 수준을 그대로 이어 쓴다.

### 2-1. 시제 트랙

가장 굵은 축. 대부분의 단원은 이 축의 한 지점을 연다.

| 순서 | 포인트 | 핵심 굴절 | 대표 패턴 |
|------|--------|---------|----------|
| T1 | 단순현재 — 1·2인칭 | 원형 | `I/you drink coffee.` |
| T2 | 단순현재 — 3인칭 단수 | -s / -es | `She drinks coffee.` |
| T3 | 단순과거 — 규칙 | -ed | `I worked yesterday.` |
| T4 | 단순과거 — 불규칙 | go→went, eat→ate 등 | `I went home.` |
| T5 | 단순미래 — will | will + 원형 | `I will call you.` |
| T6 | 미래 — be going to | be going to + 원형 | `I'm going to study.` |
| T7 | 현재진행 | be + -ing | `I'm eating lunch.` |
| T8 | 과거진행 | was/were + -ing | `I was reading.` |
| T9 | 현재완료 — 경험 | have/has + p.p. | `I have been to Seoul.` |
| T10 | 현재완료 — 계속 | for / since | `I've lived here for 2 years.` |

> T9~T10은 한국어 직역이 안 되는 지점이라 `textKo`를 "의미 번역"으로 제공한다. 기계 직역 금지.

### 2-2. 문장 유형 트랙

시제 트랙과 직교한다. 같은 시제라도 유형이 달라지면 새 단원이 된다.

| 순서 | 포인트 | 대표 패턴 |
|------|--------|----------|
| S1 | 긍정 평서문 | `I drink coffee.` |
| S2 | 부정문 (do/does/don't/doesn't) | `I don't drink coffee.` |
| S3 | Yes/No 의문문 | `Do you drink coffee?` |
| S4 | Wh- 의문문 | `What do you drink?` |
| S5 | 명령문 | `Drink some water.` |
| S6 | 부가의문문 | `You drink coffee, don't you?` (중급 이후) |

### 2-3. 준동사 트랙

준동사는 **시제 트랙 중반(T5 전후)** 이 된 뒤 열린다. 먼저 의미를 들어본 뒤 규칙을 구조화한다.

| 순서 | 포인트 | 대표 패턴 |
|------|--------|----------|
| V1 | to부정사 — 목적 | `I go to the store to buy milk.` |
| V2 | to부정사 — 명사적 쓰임 | `I want to eat pizza.` (T1에서 살짝 선행 소개) |
| V3 | 동명사 — 주어·목적어 | `I like reading books.` |
| V4 | 동명사 vs to부정사 | `stop smoking` vs `stop to smoke` (B1~) |
| V5 | 분사 — 현재분사로 수식 | `the running boy` |
| V6 | 분사 — 과거분사로 수식 | `the broken window` |

### 2-4. 접속사 트랙

두 문장을 잇는 법. 준동사 트랙과 비슷한 시점에 병렬로 열린다.

| 순서 | 포인트 | 대표 패턴 |
|------|--------|----------|
| C1 | 등위접속사 — and/but/or | `I'm tired, but I'm happy.` |
| C2 | 이유 — because / so | `I'm late because the bus was slow.` |
| C3 | 시간 — when / while / before / after | `Call me when you arrive.` |
| C4 | 조건 — if | `If it rains, we'll stay home.` |
| C5 | 양보 — although / though | `Although it's cold, I like it.` (B1~) |

### 2-5. 트랙 간 교차 규칙

- 한 단원은 **한 트랙에서 한 지점만** 새로 연다
- 새로 여는 지점이 아닌 트랙들은 **이전 단원의 최신 지점**을 그대로 쓴다
- 네 트랙은 독립적으로 전진하지만, 한 트랙이 앞서가면 다른 트랙에서 그 수준의 문장이 필요해진다 — 이 연결은 §5 단원 시퀀스에서 푼다

## 3. 어휘 팩 (Vocab Pack)

> 어휘는 **단원에 딸린 팩** 으로만 존재한다. 단어장 코스도, 플래시카드 SRS도, 단독 진입 화면도 만들지 않는다 (product-context.md Non-Goals).

### 3-1. 어휘 팩이란

하나의 단원에 등장하는 **명사·동사·형용사 15~25개**를 묶은 것. 팩은 단원의 **슬롯 치환 풀**로만 쓰인다.

```
단원 "drink + 음료" Vocab Pack
  음료 명사: coffee, tea, water, juice, milk, soda, beer, wine
  동사: drink, have, order, pour, finish
  형용사: hot, cold, sweet, strong
```

단원의 모든 문장은 이 팩 안에서 슬롯을 치환해 생성된다. 그래서 학습자는 같은 문형을 반복하는 동안 팩 안 어휘를 **자연스럽게 여러 번 만난다**.

### 3-2. 팩 설계 규칙

| 규칙 | 이유 |
|------|------|
| 팩당 15~25개 | 이보다 작으면 변주가 부족, 크면 반복 노출이 흐려진다 |
| 명사·동사·형용사 섞기 | 한 종류만 있으면 문형 변주가 안 됨 |
| 이전 팩의 20~30%를 재활용 | 자연스러운 복습 — 신규 어휘는 팩당 10~18개 선 |
| 고빈도부터 | COCA / General Service List 등 공개 빈도 자료 기준 |
| 단원 주제와 결합 | "drink + 음료 팩"처럼 상황 앵커가 있어야 기억이 박힌다 |

### 3-3. 팩과 Vocab Helper의 관계

- 팩 안의 단어라도 **사용자가 막히지 않으면 Vocab Helper는 자동으로 뜨지 않는다** — 방해 금지
- 사용자가 단어를 탭했을 때만 voca(어원) + 경선식(연상)이 바텀 시트로 제공된다 (Vocab Helper)
- 실제로 열어본 단어만 `RecentWordsScreen`("최근 본 단어")에 누적된다 — 팩 전체가 자동으로 들어가지 않는다
- "최근 본 단어"는 **복습 도우미**지 학습 코스가 아니다. 별도 진도·SRS 일정을 가지지 않는다

### 3-4. 팩이 하지 않는 것 (Non-Goals 재확인)

- ❌ 팩의 단어로 **플래시카드 세션** 을 구성
- ❌ 팩의 단어를 **메인 탭** 으로 올림
- ❌ 팩의 단어를 **스펠링/다지선다 퀴즈** 로 평가
- ✅ 팩의 단어가 단원 문장에 슬롯 치환으로 반복 등장 — 그것이 전부

### 3-5. 콜로케이션·구동사의 팩 내 취급

숙어·관용어를 별도 트랙으로 꺼내지 않는다 (§9). 대신 자주 함께 쓰이는 **콜로케이션**(`have breakfast`, `take a picture`)과 **구동사**(`get up`, `look for`)는 팩 구성 시에 **통째로 등록**해서 문장에 자연 노출시킨다.

팩 엔트리에 세 필드를 더한다:

- `chunk` — 단어 단독이 아니라 덩어리로 등록할 때 쓰는 표기 (예: `have breakfast`)
- `collocates` — 이 단어와 자주 붙는 파트너들 (예: `picture → take`, `decision → make`)
- `phrasal_of` — 구동사인 경우 뿌리 동사 참조 (예: `get up → get`)

운영 원칙:

- 팩에 `chunk`가 들어가면 Step 3 슬롯 치환 시 **덩어리 단위**로 들어간다 — 분해해서 넣지 않는다
- `collocates`는 굳이 UI에 노출하지 않는다. 문장 생성 파이프라인이 참고해서 **부자연스러운 조합을 피하는 용도**
- 구동사는 뿌리 동사가 있는 팩에 함께 배치한다 — 별도 구동사 팩을 만들지 않는다 (문장 안에서 섞여 나와야 패턴이 몸에 박힌다)


## 4. 단원 (Unit) 모델

단원은 커리큘럼의 **원자 단위** 다. 학습자에게 "한 덩어리"로 체감되는 분량이기도 하다.

### 4-1. 단원 구성 공식

```
단원 = (문법 포인트 1개) × (어휘 팩 1개) × (3단계 확장)

  Step 1. Phrase         — 팩의 핵심 구 3~5개를 반복
  Step 2. Conjugation    — 그 구를 인칭/시제로 굴절
  Step 3. Substitution   — 팩의 나머지 어휘로 슬롯 치환
```

### 4-2. 단원 분량 기준

| 항목 | 기본값 |
|------|-------|
| 어휘 팩 크기 | 15~25 단어 |
| 완성 문장 수 | 20~40개 |
| 단원당 예상 학습 시간 | 10~15분 |
| Step 1 구 개수 | 3~5개 |
| Step 2 굴절 조합 | 6인칭 × 구 3개 = 18문장 내외 |
| Step 3 치환 문장 | 10~20개 |

### 4-3. 단원의 메타데이터 (필수)

단원 하나에 반드시 붙어야 할 속성:

- **opens**: 이 단원이 새로 여는 트랙·지점 (예: `{ track: 'tense', point: 'T2' }`)
- **prerequisites**: 선행되어야 하는 단원 ID 목록
- **cefr_level**: A1 / A2 / B1 / B2
- **vocab_pack_id**: 어휘 팩 참조
- **pattern_family_id**: planning.md 6-1-1-1 파이프라인에서 오는 패턴 가족 ID
- **theme**: 상황 태그 (일상·음식·이동·쇼핑·업무 등)

## 5. 단원 시퀀스 (MVP 목차)

> **A1~A2 를 같은 깊이로**, **B1 은 뼈대만** 잡는다. 실제 문장·팩은 후속 작업.
> 각 줄은 `[단원번호] 여는 지점 · 주제 · (선행)` 형식.

### 5-1. A1 (왕초보)

| # | 여는 지점 | 주제 | 선행 |
|---|---------|------|------|
| 1 | T1 · S1 · 현재형 1·2인칭 긍정 | drink + 음료 | — |
| 2 | (팩만 확장) | eat + 음식 | 1 |
| 3 | (팩만 확장) | have + 소지품 | 1~2 |
| 4 | T2 · 3인칭 단수 -s | drink/eat/have 재사용 | 1~3 |
| 5 | S2 · 부정문 don't/doesn't | 이전 팩 재활용 | 1~4 |
| 6 | S3 · Yes/No 의문문 | 일상 행동 팩 (go/come/sleep 등) | 1~5 |
| 7 | S4 · Wh- 의문문 (what/where/when) | 장소·시간 팩 | 6 |
| 8 | S5 · 명령문 | 길 안내·부탁 팩 | 1~7 |

> A1 종료 시: **현재형 평서·부정·의문·명령** 네 유형과 **일상 어휘 ~100어**가 확보된다.

### 5-2. A2 (초급)

| # | 여는 지점 | 주제 | 선행 |
|---|---------|------|------|
| 9 | T3 · 단순과거 규칙 -ed | 어제 한 일 (work/play/watch) | A1 전체 |
| 10 | T4 · 단순과거 불규칙 | go→went, eat→ate, have→had | 9 |
| 11 | T5 · will 미래 | 내일 계획 | 9~10 |
| 12 | T6 · be going to | 가까운 계획 | 11 |
| 13 | T7 · 현재진행 be + -ing | 지금 하는 일 | A1~12 |
| 14 | V2 · to부정사 명사적 (want to, need to, like to) | 선호·의도 | 13 |
| 15 | C1 · and / but / or | 이전 팩 재활용 | A1~14 |
| 16 | C2 · because / so | 이유 설명 | 15 |

> A2 종료 시: **과거·미래·진행**의 기본형과 **문장 잇기**가 확보된다.

### 5-3. B1 (중급) — 뼈대만

- T8 · 과거진행
- T9 · 현재완료 경험
- T10 · 현재완료 계속 (for / since)
- V1 · to부정사 목적
- V3 · 동명사 주어·목적어
- V5 / V6 · 분사 수식
- C3 / C4 · when / if
- S6 · 부가의문문

> B1은 MVP 범위 외. 사용자가 A2를 절반 이상 완료한 뒤 데이터를 보며 우선순위를 재정렬한다.

## 6. 데이터 모델 제안

기존 `sentences` 테이블과 `PatternDrillPanel`을 건드리지 않고, **위에 얹는** 방식으로 설계한다.

### 6-1. 새 테이블

```
curriculum_unit
  id              uuid        PK
  order_index     int         전역 순서 (1,2,3,...)
  title_ko        text        "drink + 음료"
  cefr_level      text        'A1' | 'A2' | 'B1' | 'B2'
  opens_track     text        'tense' | 'sentence_type' | 'verbal' | 'conjunction' | null
  opens_point     text        'T2' | 'S3' | 'V2' | ...  | null
  vocab_pack_id   uuid        → vocab_pack.id
  theme           text        'food' | 'daily' | ...

curriculum_step
  id              uuid        PK
  unit_id         uuid        → curriculum_unit.id
  step_type       text        'phrase' | 'conjugation' | 'substitution'
  order_index     int         단원 내 순서 (1,2,3)

curriculum_unit_prerequisite
  unit_id         uuid
  prerequisite_id uuid        선행 단원
  PK (unit_id, prerequisite_id)

vocab_pack
  id              uuid        PK
  title_ko        text
  size            int         팩 크기 (15~25)

vocab_pack_entry
  pack_id         uuid        → vocab_pack.id
  word            text        lemma (소문자) · chunk인 경우 덩어리 표현
  is_chunk        bool        true면 덩어리(콜로케이션·구동사)
  pos             text        'noun' | 'verb' | 'adj' | 'chunk'
  role            text        'new' | 'review'   팩 내 역할
  phrasal_of      text        구동사인 경우 뿌리 동사 (nullable)
  collocates      text[]      자주 붙는 파트너 lemma들 (nullable)
  PK (pack_id, word)
```

### 6-2. 기존 `sentences` 테이블과의 연결

`sentences`에 필드 두 개만 추가한다. 기존 행은 NULL 허용.

```
sentences
  ...
  curriculum_step_id  uuid   → curriculum_step.id   (NULL 가능)
  is_phrase           bool   Step 1 용 구인지 (완전한 문장이 아닐 수 있음)
```

> `is_phrase = true` 인 행은 **마침표 없는 구**("drink coffee")도 허용한다. 재생·노출은 일반 문장과 동일하되 SentenceCard 쪽에서 종결 부호를 기대하지 않게 분기한다.

### 6-3. 굴절(Step 2) 데이터 생성 전략

Step 2 문장은 손으로 다 쓰지 않고 **굴절 템플릿**으로 생성한다.

```
템플릿:  "{subject} {verb:conj} {object}."
주어 풀: I, you, he, she, we, they
동사:    drink  →  drink / drink / drinks / drinks / drink / drink
결과:    6문장 × 팩의 구 3개 = 18문장
```

검수 포인트:
- 불규칙 동사는 굴절표를 명시적으로 단원 메타에 포함
- 자동 생성 후 사람이 자연스러움 검수 (planning 6-1-1-1 파이프라인 재사용)

## 7. 기존 코드와의 연결

| 기존 모듈 | 커리큘럼과의 관계 |
|----------|-----------------|
| `ContentService.getNextSentence` | 세션 시작 시 현재 진행 중 단원·단계를 받아 그 단계의 문장만 후보로 필터링 |
| `PatternDrillPanel` | Step 3 (Substitution) 실행기. 어휘 팩을 슬롯 choices로 공급 |
| `SentenceCard` | Step 1·2·3 공용. `is_phrase` 플래그만 인식하면 됨 |
| `RecentWordsScreen` | 팩 자동 주입 금지. 사용자가 연 단어만 기록 (현재 동작 유지) |
| `VocabHelperSheet` | 팩 단어든 아니든 구분 없이 탭으로만 호출 |
| `useSessionStore` | `currentUnitId` / `currentStepId` 추가 — 세션이 어느 단원·단계에서 열렸는지 기록 |
| `useProgressStore` | 단원 단위 완료도 누적. Step별 완료율도 남겨 후일 분석에 씀 |

## 8. 열어둔 질문 (후속 결정 필요)

이 문서에서는 결정하지 않는다. 구현 spec 들어갈 때 답한다.

1. **Step 1 구(phrase)의 오디오** — 사전 생성 캐시를 구로도 보관할지, 문장만 보관하고 구는 기기 TTS로 폴백할지
2. **자유 순서 vs 강제 순서** — 사용자가 단원을 건너뛸 수 있게 할지, 선행 완료를 강제할지 (KPI 관점에서 A/B 테스트 여지) → curriculum-foundation 스펙에서 enforce=false 로 결정 (D4)
3. **팩 재활용 비율 자동화** — 팩 간 20~30% 재활용을 수작업으로 보장할지, 파이프라인에서 자동 계산할지
4. **굴절 템플릿 확장** — T9(현재완료)까지 템플릿으로 커버 가능한지, 아니면 수작업 비중을 늘릴지

## 9. 숙어·관용어 정책

> 숙어·구동사·관용어는 **별도 트랙·단원·팩으로 분리하지 않는다**. 문장 안에서 자연스럽게 녹아들게 한다.

### 9-1. 이 정책의 근거

- **Non-Goals 정합성** — "단어 단독 학습 코스"를 만들지 않는다는 원칙(product-context.md)은 "표현 단독 학습 코스"에도 똑같이 적용된다. 숙어장 탭·숙어 플래시카드도 같은 함정이다
- **학습 효율** — 숙어는 문맥 없이 암기하면 실제 사용 순간에 떠오르지 않는다. 문장 속 반복 노출이 더 강하다
- **MVP 단순성** — 별도 축을 하나 더 열면 단원 설계·콘텐츠 생성·UI 분기가 전부 두 배가 된다. 효과 대비 비용이 맞지 않는다

### 9-2. 대신 이렇게 녹인다

| 유형 | 취급 |
|------|------|
| **콜로케이션** (`have breakfast`, `take a picture`, `make a decision`) | §3-5에 따라 어휘 팩에 `chunk`로 등록. Step 3 슬롯 치환 시 덩어리째 들어간다 |
| **구동사** (`get up`, `look for`, `turn on`) | 뿌리 동사(get / look / turn)가 있는 팩에 함께 배치. 별도 P 트랙을 만들지 않는다 |
| **진짜 관용어** (`break a leg`, `it's raining cats and dogs`) | **MVP 대상 아님**. 왕초보~초급 단계에서 꺼낼 이유가 없다. B1 이후 재검토 |

### 9-3. 막혔을 때 해결은 Vocab Helper가 한다

덩어리를 처음 만난 사용자가 의미를 모를 때:

- 문장 안에서 덩어리 전체를 탭하면 Vocab Helper 바텀 시트가 열린다
- 바텀 시트는 이미 `🧬 voca(어원)` + `🎨 경선식(연상)` 구조다. 구동사·콜로케이션은 이 구조에 자연스럽게 들어간다 — 예: `get up`의 `up`을 "완료·상승"의 방향성으로 설명
- 단어가 아니라 덩어리여도 `RecentWordsScreen`에 누적된다 (사용자가 실제로 탭했을 때만)

### 9-4. 설계할 때 기억할 것

- 숙어가 "예뻐서" 별도 섹션을 만들고 싶은 유혹이 생길 수 있다. 그때마다 묻는다: **"이건 단어장 코스와 본질적으로 다른가?"** 다르지 않으면 만들지 않는다
- 새 구동사·콜로케이션이 커리큘럼에 필요해지면 **가장 가까운 기존 팩에 추가**한다. 새 단원을 만들지 않는다
- 파이프라인(planning.md 6-1-1-1)이 구동사를 생성할 때는 **그 구동사가 포함된 완성 문장**을 출력해야 한다. 구동사만 따로 목록화하지 않는다
