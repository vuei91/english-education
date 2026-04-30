# Design — 커리큘럼 기반(Foundation)

## Overview

본 설계는 `docs/curriculum.md` 의 커리큘럼 모델을 SentenceFlow 런타임에 얹는 **기반 층**을 정의한다. 초점은 세 가지다:

1. **데이터 레이어** — Supabase 에 커리큘럼·팩 테이블을 추가하고, 기존 `sentences` 테이블을 비파괴적으로 확장한다
2. **서비스 레이어** — `CurriculumService` 를 신설하고 `ContentService` 는 옵션 필터를 더한다 (기존 시그니처 하위호환)
3. **상태 레이어** — 세션·진도 스토어가 단원·단계 진행 상태를 추적한다

UI 레이어(대시보드 배지, 단원 선택 화면 등)는 **본 스펙 대상 외** 다. 후속 스펙에서 이 기반 위에 얹는다.

제약:

- `docs/curriculum.md` 는 ground truth. 본 설계는 문서의 §1~§7 모델을 그대로 구현한다. 설계 중 문서 수정이 필요해지면 소급 수정 후 본 문서 갱신
- 기존 `ContentService.pick_next_sentence` RPC 시그니처는 깨지 않는다 (트랙 A/B 기존 화면이 사용 중)
- Product Context Non-Goals 가드(Req 9)는 "컴포넌트 레벨에서 단어장·플래시카드 UI를 export 하지 않는다" 로 구현

## Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                            Screens (기존)                              │
│   TrackASessionScreen · TrackBSessionScreen · RecentWordsScreen        │
│   (본 스펙에서 수정하지 않음 — curriculum 인식은 후속 스펙)              │
└──────┬────────────────────────────────────────────────────────────────┘
       │
       │ 기존 호출 유지 + 새 선택적 경로
       │
       ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Services                                            │
│  ┌──────────────────────┐      ┌──────────────────────────────────┐   │
│  │ ContentService       │      │ CurriculumService  (NEW)          │   │
│  │ (EXTEND)             │◀────▶│  - listUnits / getUnitWithSteps   │   │
│  │  + curriculumStepId  │      │  - getNextStep                    │   │
│  │    옵션                │      │  - isUnitUnlocked                 │   │
│  └──────────┬───────────┘      │  - 인메모리 + SQLite 캐시           │   │
│             │                   └──────────────┬──────────────────┘   │
│             ▼                                  ▼                        │
│  ┌──────────────────────┐      ┌──────────────────────────────────┐   │
│  │ Supabase             │      │ Local SQLite                      │   │
│  │  - sentences (+2 col)│      │  - content_cache (kind 확장)       │   │
│  │  - pick_next_sentence│      │  - 진도 Set 직렬화용 기존 path 유지  │   │
│  │    RPC (+1 param)    │      └──────────────────────────────────┘   │
│  │  - curriculum_unit   │                                              │
│  │  - curriculum_step   │                                              │
│  │  - curriculum_unit_  │                                              │
│  │    prerequisite      │                                              │
│  │  - vocab_pack        │                                              │
│  │  - vocab_pack_entry  │                                              │
│  └──────────────────────┘                                              │
└───────────────────────────────────────────────────────────────────────┘
       ▲
       │
       │
┌───────────────────────────────────────────────────────────────────────┐
│                    State (Zustand)                                     │
│   useSessionStore                 useProgressStore                     │
│   + currentUnitId                 + completedUnitIds (Set→Array 직렬화) │
│   + currentCurriculumStepId       + completedStepIds                   │
└───────────────────────────────────────────────────────────────────────┘
```

**데이터 흐름 (단원 진입 → 문장 공급)**

```
1. 사용자가 단원 진입 (후속 스펙의 UI)
       │
       ▼
2. CurriculumService.getUnitWithSteps(unitId)
       → curriculum_unit + 3 steps + vocab_pack 을 한 번에 로드
       │
       ▼
3. useSessionStore.startSession(track, firstSentenceId, {
     unitId, curriculumStepId
   })
       │
       ▼
4. ContentService.getNextSentence(track, cefr, {
     curriculumStepId,   ← NEW
     hotWords,
     excludeIds
   })
       → pick_next_sentence RPC 호출 (p_curriculum_step_id 추가)
       │
       ▼
5. Sentence 수신 → SentenceCard 렌더링
       → is_phrase: true 인 경우 마침표 없는 구 허용
       │
       ▼
6. 문장 완료 시 useProgressStore.completeSentence() +
   step 의 모든 문장이 소진되면 completedStepIds 에 추가
       │
       ▼
7. 3개 step 모두 완료되면 completedUnitIds 에 추가
```

## Components

### CurriculumService (신규)

**파일**: `app/src/services/curriculum/CurriculumService.ts`

- **역할**: 커리큘럼 카탈로그의 단일 조회 창구. 단원·단계·팩 메타를 일관된 인터페이스로 공급한다. 인메모리 + SQLite 캐시.
- **의존**:
  - `SupabaseClient` (카탈로그 원본)
  - `SQLite.SQLiteDatabase | null` (오프라인 캐시 · 테스트에서는 null)
- **공개 인터페이스**:
  ```typescript
  class CurriculumService {
    constructor(
      db: SQLite.SQLiteDatabase | null,
      supabase: SupabaseClient,
    );

    listUnits(level?: CEFRLevel): Promise<CurriculumUnit[]>;

    getUnitWithSteps(unitId: string): Promise<{
      unit: CurriculumUnit;
      steps: CurriculumStep[];
      pack: VocabPack;
    }>;

    getNextStep(
      unitId: string,
      completedStepIds: ReadonlySet<string>,
    ): CurriculumStep | null;

    isUnitUnlocked(
      unitId: string,
      completedUnitIds: ReadonlySet<string>,
      options?: { enforce?: boolean },  // default: false (경고만)
    ): boolean;

    invalidateCache(): void;
  }

  export class CurriculumUnavailableError extends Error {}
  ```
- **요구사항 매핑**: Req 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4

**캐시 전략** (Req 7.5, 7.6)

- 인메모리: 세션 내 첫 조회 결과를 `Map<unitId, ...>` 에 보관. `invalidateCache()` 로 수동 만료
- SQLite: 기존 `content_cache` 테이블 재사용 — `kind` 에 `'curriculum_catalog' | 'curriculum_unit' | 'vocab_pack'` 확장
- 오프라인에서 SQLite 캐시도 비어 있으면 `CurriculumUnavailableError` throw (Req 7.6)

**`getNextStep` 순서 강제** (Req 7.4)

- step_type 순서: `phrase(1) → conjugation(2) → substitution(3)` — `order_index` 컬럼으로 DB 에도 고정
- `completedStepIds` 에 없는 최소 `order_index` 의 step 반환
- 모든 step 완료 시 `null`

### ContentService (확장)

**파일**: `app/src/services/content/ContentService.ts`

- **역할**: 기존 역할 유지 + 커리큘럼 필터 옵션 추가. 시그니처 하위호환.
- **변경점**:
  ```typescript
  async getNextSentence(
    track: Track,
    cefr: CEFRLevel,
    options: {
      hotWords?: string[];
      excludeIds?: string[];
      curriculumStepId?: string;  // NEW
    } = {},
  ): Promise<Sentence | null>
  ```
- **RPC 변경**: `pick_next_sentence(p_track, p_cefr, p_hot_words, p_exclude_ids, p_curriculum_step_id)` — 다섯 번째 인자 추가, 기본값 `NULL`
- **폴백 금지** (Req 5.4): `curriculumStepId` 로 필터링한 결과가 비어 있으면 `null`. 전체 풀로 폴백하지 않는다
- **요구사항 매핑**: Req 5.1, 5.2, 5.3, 5.4, 5.5

**`Sentence` 타입 이동**

기존 `Sentence` 는 `ContentService.ts` 에 인라인 정의돼 있다. 본 스펙에서:

- `app/src/types/domain.ts` 로 이동 (Req 3.6)
- `curriculumStepId?: string | null` 과 `isPhrase: boolean` 필드 추가
- `ContentService` 는 이동된 타입을 re-import. 기존 소비자(`TrackASessionScreen` 등)는 변경 불필요

### useSessionStore (확장)

**파일**: `app/src/stores/useSessionStore.ts`

- **필드 추가** (Req 6.1):
  ```typescript
  currentUnitId: string | null;
  currentCurriculumStepId: string | null;
  ```
- **필드명 선택 근거**: 기존에 이미 `currentStep: TrackBStep | null` 이 있다. 충돌을 피하려고 `currentCurriculumStepId` 로 명시적 분리 (Decisions 참조)
- **액션 변경** (Req 6.2, 6.3):
  ```typescript
  startSession: (
    track: Track,
    firstSentenceId: string | null,
    curriculum?: { unitId: string; curriculumStepId: string },
  ) => void;
  endSession: () => void;  // curriculum 필드도 null 로
  ```
- `curriculum` 인자는 **선택 사항**. 기존 호출부(커리큘럼 비인식 세션)는 수정 없이 동작
- **요구사항 매핑**: Req 6.1, 6.2, 6.3

### useProgressStore (확장)

**파일**: `app/src/stores/useProgressStore.ts`

- **필드 추가** (Req 6.4):
  ```typescript
  completedUnitIds: Set<string>;
  completedStepIds: Set<string>;
  ```
- **액션 추가** (Req 6.5, 6.6):
  ```typescript
  markStepCompleted: (
    unitId: string,
    stepId: string,
    allStepIdsOfUnit: readonly string[],
  ) => { unitCompleted: boolean };
  ```
  - `completedStepIds` 에 추가
  - `allStepIdsOfUnit` 가 모두 `completedStepIds` 에 들어가면 `completedUnitIds` 에 `unitId` 추가, `unitCompleted: true` 반환
- **직렬화** (Req 6.7):
  - `PersistedShape` 는 Set 를 직렬화할 수 없다 → `completedUnitIds: string[]` · `completedStepIds: string[]` 로 저장
  - `hydrate` 에서 `new Set(array)` 로 복원
  - Sync 큐 등록: `syncCurriculumProgress(userId, unitIds, stepIds)` 를 `SyncService` 에 추가 (설계는 Sync 쪽 후속 작업이 있으므로 인터페이스만 선언)
- **요구사항 매핑**: Req 6.4, 6.5, 6.6, 6.7

### Migrations (신규)

**Supabase**: `supabase/migrations/<ts>_curriculum_foundation.sql`

- 테이블 생성: `curriculum_unit`, `curriculum_step`, `curriculum_unit_prerequisite`, `vocab_pack`, `vocab_pack_entry`
- 컬럼 추가: `sentences.curriculum_step_id`, `sentences.is_phrase`
- RPC 확장: `pick_next_sentence` 를 drop-and-recreate (파라미터 추가)
- RLS 정책: 모든 커리큘럼 테이블에 `authenticated` 역할의 `SELECT` 만 허용 (Req 1.12)

**Supabase 시드**: `supabase/migrations/<ts>_curriculum_a1_seed.sql`

- A1 8개 단원의 `curriculum_unit` / `curriculum_step` / `curriculum_unit_prerequisite` / `vocab_pack` / `vocab_pack_entry` 를 `INSERT`
- 단원 고정 UUID 사용 (마이그레이션 재실행 idempotent 를 위해 `ON CONFLICT DO NOTHING`)
- **Sentence 는 적재하지 않는다** (Req 4.8)

**로컬 SQLite**: 본 스펙에서 로컬 커리큘럼 테이블은 만들지 않는다. `content_cache` 의 `kind` 확장만 사용.

요구사항 매핑: Req 1.1~1.12, 2.1~2.5, 4.1~4.8

## Data Model

### Supabase — 신규 테이블

```sql
CREATE TABLE curriculum_unit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index     integer NOT NULL UNIQUE,
  title_ko        text NOT NULL,
  cefr_level      text NOT NULL
                  CHECK (cefr_level IN ('A1','A2','B1','B2')),
  opens_track     text
                  CHECK (opens_track IN ('tense','sentence_type','verbal','conjunction')),
  opens_point     text,
  vocab_pack_id   uuid NOT NULL REFERENCES vocab_pack(id) ON DELETE RESTRICT,
  theme           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK ((opens_track IS NULL) = (opens_point IS NULL))
);

CREATE TABLE curriculum_step (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid NOT NULL REFERENCES curriculum_unit(id) ON DELETE CASCADE,
  step_type       text NOT NULL
                  CHECK (step_type IN ('phrase','conjugation','substitution')),
  order_index     integer NOT NULL
                  CHECK (order_index IN (1,2,3)),
  UNIQUE (unit_id, step_type),
  UNIQUE (unit_id, order_index)
);

CREATE TABLE curriculum_unit_prerequisite (
  unit_id         uuid NOT NULL REFERENCES curriculum_unit(id) ON DELETE CASCADE,
  prerequisite_id uuid NOT NULL REFERENCES curriculum_unit(id) ON DELETE CASCADE,
  PRIMARY KEY (unit_id, prerequisite_id),
  CHECK (unit_id <> prerequisite_id)
);

CREATE TABLE vocab_pack (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ko        text NOT NULL,
  size            integer NOT NULL CHECK (size BETWEEN 15 AND 25),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vocab_pack_entry (
  pack_id         uuid NOT NULL REFERENCES vocab_pack(id) ON DELETE CASCADE,
  word            text NOT NULL,
  is_chunk        boolean NOT NULL DEFAULT false,
  pos             text NOT NULL
                  CHECK (pos IN ('noun','verb','adj','chunk')),
  role            text NOT NULL
                  CHECK (role IN ('new','review')),
  phrasal_of      text,
  collocates      text[],
  PRIMARY KEY (pack_id, word),
  CHECK ((is_chunk = true) = (pos = 'chunk'))
);
```

### Supabase — `sentences` 확장

```sql
ALTER TABLE sentences
  ADD COLUMN curriculum_step_id uuid
    REFERENCES curriculum_step(id) ON DELETE SET NULL,
  ADD COLUMN is_phrase boolean NOT NULL DEFAULT false;

CREATE INDEX idx_sentences_curriculum_step
  ON sentences (curriculum_step_id)
  WHERE curriculum_step_id IS NOT NULL;
```

### Supabase — RLS 정책

커리큘럼 콘텐츠는 공개 메타 성격이므로 `authenticated` 역할의 `SELECT` 만 허용한다. `anon` 접근은 차단 (Req 1.12).

```sql
ALTER TABLE curriculum_unit ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_unit_prerequisite ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_pack ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_pack_entry ENABLE ROW LEVEL SECURITY;

CREATE POLICY curriculum_unit_select
  ON curriculum_unit FOR SELECT TO authenticated USING (true);
-- (동일 패턴을 나머지 4개 테이블에도 적용)
```

쓰기는 Supabase Service Role (마이그레이션 / 관리자 도구) 만 허용 — Postgres 기본 권한.

### TypeScript 도메인 타입

```typescript
// app/src/types/domain.ts (추가분)

export type GrammarTrack =
  | 'tense' | 'sentence_type' | 'verbal' | 'conjunction';

export type GrammarPoint = string;  // 'T1' | 'T2' | ... enum 관리는 런타임 validator 에서

export type UnitOpens =
  | { track: GrammarTrack; point: GrammarPoint }
  | null;

export type CurriculumUnit = {
  id: string;
  orderIndex: number;
  titleKo: string;
  cefrLevel: CEFRLevel;
  opens: UnitOpens;
  vocabPackId: string;
  theme: string;
  prerequisiteIds: readonly string[];
};

export type CurriculumStepType = 'phrase' | 'conjugation' | 'substitution';

export type CurriculumStep = {
  id: string;
  unitId: string;
  stepType: CurriculumStepType;
  orderIndex: 1 | 2 | 3;
};

export type VocabPackPos = 'noun' | 'verb' | 'adj' | 'chunk';

export type VocabPackEntry = {
  word: string;
  isChunk: boolean;
  pos: VocabPackPos;
  role: 'new' | 'review';
  phrasalOf?: string | null;
  collocates?: readonly string[] | null;
};

export type VocabPack = {
  id: string;
  titleKo: string;
  size: number;
  entries: readonly VocabPackEntry[];
};

export type ChunkEntry = VocabPackEntry & { isChunk: true; pos: 'chunk' };

export function isChunkEntry(entry: VocabPackEntry): entry is ChunkEntry {
  return entry.isChunk === true && entry.pos === 'chunk';
}

// 기존 Sentence 를 이곳으로 이동하고 필드 추가
export type Sentence = {
  id: string;
  track: Track;
  textEn: string;
  textKo: string | null;
  cefrLevel: CEFRLevel;
  situation: string | null;
  source: string;
  license: string;
  curriculumStepId?: string | null;
  isPhrase: boolean;
};
```

요구사항 매핑: Req 3.1~3.6

## Interfaces

### 확장된 RPC — `pick_next_sentence`

```sql
CREATE OR REPLACE FUNCTION pick_next_sentence(
  p_track                text,
  p_cefr                 text,
  p_hot_words            text[],
  p_exclude_ids          uuid[],
  p_curriculum_step_id   uuid DEFAULT NULL
) RETURNS TABLE (...) AS $$
  -- 기존 로직 + WHERE 절에 다음 추가:
  --   (p_curriculum_step_id IS NULL OR s.curriculum_step_id = p_curriculum_step_id)
$$ LANGUAGE plpgsql;
```

- `p_curriculum_step_id` 가 `NULL` 이면 기존 동작 (트랙 + CEFR 기반 랜덤 선택) 유지
- `NOT NULL` 이면 해당 step 의 문장만 후보. 비어 있으면 `null` 반환 (Req 5.4)

### Client-facing 서비스 메서드

이미 Components 섹션에 나열. 요약:

| Service | Method | Req |
|---------|--------|-----|
| CurriculumService | `listUnits(level?)` | 7.1, 7.2 |
| CurriculumService | `getUnitWithSteps(unitId)` | 7.3 |
| CurriculumService | `getNextStep(unitId, completed)` | 7.4 |
| CurriculumService | `isUnitUnlocked(unitId, completed, opts)` | 8.1~8.4 |
| CurriculumService | `invalidateCache()` | 7.5 |
| ContentService | `getNextSentence(track, cefr, {..., curriculumStepId})` | 5.1~5.5 |

### 외부 AI 호출

본 스펙에는 외부 AI 호출이 없다. 카탈로그 조회는 전부 Supabase 직접 쿼리.

## Error Handling

| 실패 모드 | 동작 |
|----------|------|
| 카탈로그 조회 네트워크 실패 + SQLite 캐시 hit | 캐시 값 사용, 경고 로그 |
| 카탈로그 조회 네트워크 실패 + SQLite 캐시 miss | `CurriculumUnavailableError` throw — 화면 레이어에서 "학습 데이터를 불러오지 못했어요" 표시 (Req 7.6) |
| `getUnitWithSteps` 가 step 3개 미만 반환 | `CurriculumIntegrityError` throw — 서버 데이터 일관성 깨짐을 즉시 노출 |
| `ContentService.getNextSentence` + `curriculumStepId` 결과 empty | `null` 반환 (Req 5.4). 폴백 금지 |
| Sync 큐에 curriculum progress 등록 실패 | 기존 Sync 실패 경로와 동일 — 로컬 상태는 유지, 네트워크 복구 시 재시도 |
| 마이그레이션 실행 중 일부 단원 INSERT 실패 | Supabase 마이그레이션이 트랜잭션 내 실행되므로 전체 롤백. 원인 로그 후 수동 개입 |

## Decisions & Trade-offs

### D1. `currentStepId` vs `currentCurriculumStepId` 필드명

**선택**: `useSessionStore.currentCurriculumStepId`

**대안**: 단순히 `currentStepId`

**근거**: 기존 `useSessionStore` 에 이미 `currentStep: TrackBStep | null` 이 있다 (청킹/듣기/섀도잉/요약). 이름 충돌을 피해 의미 분리. `TrackBStep` 은 트랙 B UI 단계, `currentCurriculumStepId` 는 커리큘럼 3단계 중 어디인지 — 개념이 다르다.

### D2. 로컬에 커리큘럼 테이블을 따로 두지 않는 선택

**선택**: `content_cache` (`kind='curriculum_catalog' | 'curriculum_unit' | 'vocab_pack'`) 로만 캐시

**대안**: 로컬 SQLite 에 `curriculum_unit` / `curriculum_step` 미러 테이블을 두고 조인

**근거**: 커리큘럼 카탈로그는 **읽기 전용·작은 크기**(MVP A1 기준 단원 8개). 관계형 조인 이득이 작고, 기존 `content_cache` 패턴을 그대로 쓰면 migration 추가가 줄어든다. 카탈로그가 커지면 그때 분리 검토.

### D3. `completedUnitIds` / `completedStepIds` 를 `Set` 으로 메모리, `Array` 로 디스크

**선택**: 런타임은 `Set`, 직렬화는 `Array`, `hydrate` 에서 `new Set(array)` 변환

**대안**: 시종일관 `Array` 사용

**근거**: 완료 조회는 `has()` hot path (모든 렌더에서 호출 가능성). `Array.includes` 는 O(n). Set 변환 비용은 초기 hydrate 시 1회뿐.

### D4. 단원 잠금(prerequisite)은 기본 경고만

**선택**: `isUnitUnlocked(..., { enforce: false })` 가 기본값

**대안**: 엄격한 차단

**근거**: `docs/curriculum.md` §8 열어둔 질문 2 가 A/B 테스트 여지를 남겼다. MVP 에서는 낙오 방지보다 **학습 속도** 우선 — 경고 문구는 후속 UI 스펙에서 정의. 엄격 모드는 플래그 하나로 전환 가능하게 설계.

### D5. Sentence 타입을 `domain.ts` 로 이동

**선택**: `ContentService.ts` 에서 `domain.ts` 로 이동

**대안**: 그대로 두고 커리큘럼 필드만 추가

**근거**: Req 3.6 이 `Sentence` 도 도메인 타입임을 명시했고, `domain.ts` 헤더 주석도 "shared domain types" 라고 썼다. 현재 산재해 있는 상황이 원칙 위반. 이동 후 `ContentService` 는 re-export 로 공개 API 유지.

### D6. A1 seed 를 Supabase 마이그레이션 SQL 로 적재

**선택**: `INSERT ... ON CONFLICT DO NOTHING` 으로 SQL 마이그레이션에 포함

**대안**: 별도 admin CLI / 런타임 시드 스크립트

**근거**: MVP 단원 8개는 **정적·안정적 메타**. 버전 관리 가능한 SQL 이 가장 투명. 단원 콘텐츠(실제 문장)는 후속 스펙에서 다른 방식(`content-curator` 파이프라인)으로 관리.

### D7. Non-Goals 가드(Req 9)의 구현 위치

**선택**: 스펙의 설계 원칙으로만 존재. 런타임 가드 코드를 추가하지 않는다

**대안**: ESLint rule 로 "vocab pack export from screen" 차단

**근거**: Req 9 는 **설계 레벨**의 약속이다. 코드 린트로 강제하면 false positive 가 많고, 이미 `mobile-implementation.md` steering 이 자동 포함되어 충분히 가드된다. 재발 징후가 보이면 그때 린트 추가.
