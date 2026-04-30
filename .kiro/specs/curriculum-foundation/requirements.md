# Requirements Document — 커리큘럼 기반(Foundation)

## Introduction

본 스펙은 SentenceFlow 트랙 A(짧은 문장)에 **커리큘럼 구조**를 얹는 기반 작업을 다룬다. `docs/curriculum.md` 에 정의된 3단계 확장 모델(Phrase → Conjugation → Substitution), 문법 트랙(T/S/V/C), 어휘 팩을 실제 데이터 모델·타입·선택 로직으로 구현한다.

본 스펙에서 다루는 범위:

- 커리큘럼 도메인 데이터 모델 (Supabase 스키마 + TypeScript 타입)
- `sentences` 테이블의 커리큘럼 연결 (NULL 허용 필드 2개 추가)
- A1 8개 단원의 메타 정의 (실제 문장 콘텐츠는 후속 스펙)
- `ContentService` 의 단원·단계 필터 지원
- 세션 상태에 현재 단원·단계 추적 추가
- 대시보드·RecentWords 에 커리큘럼 진도 노출 **금지** (다음 스펙 범위)

본 스펙에서 다루지 **않는** 범위:

- 실제 A1 단원의 Phrase/Conjugation/Substitution 문장 생성 · TTS 사전 생성
- 어휘 팩의 voca/경선식 Vocab Helper 콘텐츠 생성
- 단원 선택 UI · 진도 표시 화면 변경
- 트랙 B(긴 문장) 커리큘럼
- B1 이상 단원

## Glossary

- **Curriculum_Unit**: 커리큘럼의 원자 단위. 1개 문법 포인트 × 1개 어휘 팩 × 3단계(Phrase/Conjugation/Substitution)로 구성
- **Curriculum_Step**: 단원 내 학습 단계. `phrase | conjugation | substitution` 중 하나
- **Step_Phrase**: Step 1 — 팩의 핵심 구를 마침표 없이 반복 노출하는 단계 (`is_phrase: true`)
- **Step_Conjugation**: Step 2 — 동일 구를 주어·시제로 굴절시킨 문장 단계 (템플릿 기반 생성)
- **Step_Substitution**: Step 3 — 동일 문형 내 어휘 슬롯을 치환하는 단계 (`PatternDrillPanel` 실행)
- **Grammar_Track**: 문법 축. `tense | sentence_type | verbal | conjunction` 중 하나
- **Grammar_Point**: 문법 축 내부의 한 지점 (예: `T2` = 단순현재 3인칭 단수)
- **Unit_Opens**: 이 단원이 새로 여는 `{ track, point }` 쌍. 팩만 확장하는 단원은 `null`
- **Unit_Prerequisite**: 현재 단원 시작 전에 완료해야 하는 선행 단원들의 집합
- **Vocab_Pack**: 단원에 딸린 15~25개의 어휘·덩어리 묶음. 단원 내 슬롯 치환 풀로만 사용
- **Vocab_Pack_Entry**: 팩 안의 한 항목. 단어 또는 덩어리(`is_chunk: true`)
- **Chunk_Entry**: `is_chunk: true` 인 엔트리. 콜로케이션·구동사의 덩어리 표기
- **Curriculum_Catalog**: 모든 Curriculum_Unit + Curriculum_Step + Vocab_Pack 의 정적 메타 총합. MVP에서는 마이그레이션으로 사전 적재
- **Content_Service**: 현재 단원/단계에 맞는 Sentence를 공급하는 서비스(`app/src/services/content/`). 본 스펙에서 단원·단계 필터 추가
- **Session_Store**: 현재 진행 중 세션 상태. 본 스펙에서 `currentUnitId`/`currentStepId` 추가
- **Progress_Store**: 누적 진도 상태. 본 스펙에서 단원별 완료 집합 추가

## Requirements

### Requirement 1: 커리큘럼 도메인 데이터 모델 — Supabase 스키마

**User Story:** 운영자로서 단원·단계·어휘 팩을 서버에서 관리하여, 클라이언트가 일관된 커리큘럼을 받을 수 있게 하고자 한다.

#### Acceptance Criteria

1. THE Supabase 데이터베이스 SHALL `curriculum_unit` 테이블을 포함하며, 컬럼은 `id (uuid pk)`, `order_index (int, unique)`, `title_ko (text)`, `cefr_level (text)`, `opens_track (text nullable)`, `opens_point (text nullable)`, `vocab_pack_id (uuid fk)`, `theme (text)` 이다.
2. THE `curriculum_unit.cefr_level` SHALL `'A1' | 'A2' | 'B1' | 'B2'` 중 하나의 값만 허용한다.
3. IF `opens_track` 이 NULL 이면, THEN `opens_point` 도 NULL 이어야 한다 (CHECK 제약).
4. THE Supabase 데이터베이스 SHALL `curriculum_step` 테이블을 포함하며, 컬럼은 `id (uuid pk)`, `unit_id (uuid fk)`, `step_type (text)`, `order_index (int)` 이고 `step_type` 은 `'phrase' | 'conjugation' | 'substitution'` 중 하나만 허용한다.
5. THE `(curriculum_step.unit_id, step_type)` 쌍 SHALL 유니크 제약을 가진다.
6. THE Supabase 데이터베이스 SHALL `curriculum_unit_prerequisite` 테이블을 포함하며, `(unit_id, prerequisite_id)` 복합 PK로 다대다 선행 관계를 표현한다. `unit_id == prerequisite_id` 인 행은 CHECK 제약으로 금지한다.
7. THE Supabase 데이터베이스 SHALL `vocab_pack` 테이블을 포함하며, 컬럼은 `id (uuid pk)`, `title_ko (text)`, `size (int)` 이고 `size` 는 15~25 범위여야 한다 (CHECK 제약).
8. THE Supabase 데이터베이스 SHALL `vocab_pack_entry` 테이블을 포함하며, 컬럼은 `pack_id (uuid fk)`, `word (text)`, `is_chunk (bool)`, `pos (text)`, `role (text)`, `phrasal_of (text nullable)`, `collocates (text[] nullable)` 이고 `(pack_id, word)` 가 PK 이다.
9. THE `vocab_pack_entry.pos` SHALL `'noun' | 'verb' | 'adj' | 'chunk'` 중 하나의 값만 허용한다.
10. IF `is_chunk` 가 `true` 이면, THEN `pos` 는 `'chunk'` 여야 한다 (CHECK 제약).
11. THE `vocab_pack_entry.role` SHALL `'new' | 'review'` 중 하나의 값만 허용한다.
12. THE 모든 신규 테이블 SHALL Row Level Security 를 활성화하고, 콘텐츠 테이블(`curriculum_unit`, `curriculum_step`, `curriculum_unit_prerequisite`, `vocab_pack`, `vocab_pack_entry`)은 인증된 사용자에게 `SELECT` 만 허용한다.

### Requirement 2: `sentences` 테이블의 커리큘럼 연결

**User Story:** 운영자로서 기존 문장 데이터를 파괴하지 않으면서 단원·단계에 문장을 연결하고자 한다.

#### Acceptance Criteria

1. THE `sentences` 테이블 SHALL `curriculum_step_id (uuid nullable fk → curriculum_step.id)` 컬럼을 추가한다.
2. THE `sentences` 테이블 SHALL `is_phrase (bool not null default false)` 컬럼을 추가한다.
3. IF `is_phrase` 가 `true` 이면, THEN 해당 Sentence 는 마침표 없는 구 형태를 허용한다.
4. WHEN 기존 `sentences` 행에 대해 마이그레이션이 실행되면, THE 마이그레이션 SHALL `curriculum_step_id = NULL`, `is_phrase = false` 로 채워 기존 동작을 보존한다.
5. THE `sentences.curriculum_step_id` 에 대한 `ON DELETE` 동작 SHALL `SET NULL` 이다 — 단계 삭제가 문장 물리 삭제로 전파되지 않도록.

### Requirement 3: TypeScript 도메인 타입

**User Story:** 개발자로서 커리큘럼 엔터티를 타입 안전하게 다루어, 런타임 오류를 컴파일 타임에 잡고자 한다.

#### Acceptance Criteria

1. THE `app/src/types/domain.ts` SHALL `CurriculumUnit`, `CurriculumStep`, `VocabPack`, `VocabPackEntry`, `GrammarTrack`, `GrammarPoint`, `UnitOpens` 타입을 export 한다.
2. THE `GrammarTrack` 타입 SHALL `'tense' | 'sentence_type' | 'verbal' | 'conjunction'` 유니온으로 정의된다.
3. THE `UnitOpens` 타입 SHALL `{ track: GrammarTrack; point: GrammarPoint } | null` 유니온으로 정의된다.
4. THE `CurriculumStep.stepType` SHALL `'phrase' | 'conjugation' | 'substitution'` 유니온으로 정의된다.
5. THE `VocabPackEntry.pos` SHALL `'noun' | 'verb' | 'adj' | 'chunk'` 유니온으로 정의되고, `isChunk: true` 와 `pos: 'chunk'` 가 동시에 만족하는 타입 가드(`isChunkEntry(entry): entry is ChunkEntry`)를 제공한다.
6. THE 기존 `Sentence` 타입 SHALL `curriculumStepId?: string | null` 과 `isPhrase: boolean` 필드를 가진다.

### Requirement 4: A1 단원 8개의 메타 정의

**User Story:** 학습 설계자로서 A1 왕초보 커리큘럼의 뼈대를 데이터에 적재하여, 후속 콘텐츠 생성 작업이 이 목차를 기준으로 진행되게 하고자 한다.

#### Acceptance Criteria

1. THE Supabase 마이그레이션 SHALL `docs/curriculum.md` §5-1 A1 목차에 정의된 8개 Curriculum_Unit 을 `order_index` 1~8 로 적재한다.
2. THE 각 단원 SHALL 정확히 3개의 Curriculum_Step (phrase, conjugation, substitution)을 가진다.
3. THE 단원 1 SHALL `opens = { track: 'tense', point: 'T1' }` 이고 `prerequisites = []` 이다.
4. THE 단원 2·3 SHALL `opens = null` (팩만 확장) 이며 `prerequisites` 에 단원 1 을 포함한다.
5. THE 단원 4 SHALL `opens = { track: 'tense', point: 'T2' }` 이고 `prerequisites` 에 단원 1~3을 포함한다.
6. THE 각 단원 SHALL 연결된 Vocab_Pack 을 1개 가지며, 팩의 `size` 는 15~25 범위이고 A1 레벨 기준 고빈도 어휘로 채워진다.
7. THE 단원 1 이후의 모든 단원 SHALL 팩의 `review` 역할 엔트리 비율이 20%~30% 범위이다 (`docs/curriculum.md` §3-2).
8. THE 이 마이그레이션 SHALL `curriculum_step_id` 를 가진 Sentence 를 **적재하지 않는다** — 실제 문장은 후속 스펙의 책임이다.

### Requirement 5: `ContentService` 의 단원·단계 필터

**User Story:** 학습자로서 현재 진행 중 단원의 현재 단계에 맞는 문장만 이어서 받아, 학습 흐름이 흐트러지지 않게 하고자 한다.

#### Acceptance Criteria

1. THE `ContentService.getNextSentence` SHALL 옵션 파라미터 `curriculumStepId?: string` 을 받는다.
2. WHEN `curriculumStepId` 가 전달되면, THE `ContentService` SHALL 해당 step 에 연결된 Sentence 들만 후보로 필터링한다.
3. WHEN `curriculumStepId` 가 전달되지 않으면, THE `ContentService` SHALL 기존 동작(CEFR + Hot Words + Exclude Ids)을 유지한다 — 하위 호환성 보장.
4. IF `curriculumStepId` 로 필터링한 결과가 비어 있으면, THEN THE `ContentService` SHALL `null` 을 반환한다 (기존 문장 풀로 폴백하지 않는다).
5. THE `ContentService` SHALL `is_phrase: true` 인 Sentence 를 필터링 결과에 포함할 때 특별한 처리 없이 동일하게 취급한다 — 호출자가 `is_phrase` 플래그로 렌더링을 분기한다.

### Requirement 6: 세션·진도 상태의 커리큘럼 인식

**User Story:** 학습자로서 앱을 닫았다가 돌아와도 마지막으로 하던 단원·단계에서 이어 배우고자 한다.

#### Acceptance Criteria

1. THE `useSessionStore` SHALL `currentUnitId: string | null` 과 `currentStepId: string | null` 필드를 추가한다.
2. WHEN `startSession` 이 호출되면, THE `useSessionStore` SHALL 전달된 unitId·stepId 를 상태에 기록한다.
3. WHEN `endSession` 이 호출되면, THE `useSessionStore` SHALL `currentUnitId` 와 `currentStepId` 를 `null` 로 초기화한다.
4. THE `useProgressStore` SHALL `completedUnitIds: Set<string>` 과 `completedStepIds: Set<string>` 필드를 추가한다.
5. WHEN 한 Curriculum_Step 의 모든 Sentence 가 완료 처리되면, THE `useProgressStore` SHALL 해당 stepId 를 `completedStepIds` 에 추가한다.
6. WHEN 한 Curriculum_Unit 의 3개 step 모두가 `completedStepIds` 에 들어가면, THE `useProgressStore` SHALL 해당 unitId 를 `completedUnitIds` 에 추가한다.
7. THE `useProgressStore` 의 단원·단계 완료 집합 SHALL Local_Store 에 영속화되고 Sync_Service 동기화 큐에 올라간다.

### Requirement 7: 커리큘럼 카탈로그 조회 서비스

**User Story:** 앱 개발자로서 단원·팩 메타를 일관된 인터페이스로 조회하여, 화면·서비스 곳곳에서 중복 쿼리를 줄이고자 한다.

#### Acceptance Criteria

1. THE `app/src/services/curriculum/CurriculumService.ts` SHALL `listUnits(level?: CEFRLevel): Promise<CurriculumUnit[]>` 을 제공한다.
2. THE `CurriculumService.listUnits` SHALL 결과를 `order_index` 오름차순으로 정렬한다.
3. THE `CurriculumService` SHALL `getUnitWithSteps(unitId: string): Promise<{ unit: CurriculumUnit; steps: CurriculumStep[]; pack: VocabPack }>` 를 제공한다.
4. THE `CurriculumService` SHALL `getNextStep(unitId: string, completedStepIds: Set<string>): CurriculumStep | null` 을 제공하며, Phrase → Conjugation → Substitution 순서를 엄격히 지킨다.
5. THE `CurriculumService` SHALL 처음 호출된 카탈로그 결과를 인메모리 캐시에 저장하고, 동일 세션 내 재호출 시 네트워크 라운드트립을 생략한다.
6. WHEN 오프라인 상태에서 카탈로그를 요청하면, THE `CurriculumService` SHALL Local_Store 캐시에서 읽어 응답한다 — 실패 시 명시적으로 `CurriculumUnavailableError` 를 throw 한다.

### Requirement 8: 선행 단원 게이트

**User Story:** 학습자로서 선행 단원을 완료하지 않으면 다음 단원을 실수로 여는 상황이 없도록, 의존성 경고를 받고자 한다.

#### Acceptance Criteria

1. THE `CurriculumService` SHALL `isUnitUnlocked(unitId: string, completedUnitIds: Set<string>): boolean` 을 제공한다.
2. WHEN 단원의 모든 `prerequisites` 가 `completedUnitIds` 에 포함되면, THE `isUnitUnlocked` SHALL `true` 를 반환한다.
3. IF 단원 잠금 강제(enforcement) 플래그가 꺼져 있으면, THEN THE `isUnitUnlocked` SHALL 항상 `true` 를 반환한다 — MVP 에서는 경고만 표시하고 진입은 막지 않는다 (`docs/curriculum.md` §8 열어둔 질문 2).
4. THE 강제 플래그의 기본값 SHALL `false` (경고만) 이다. 이 기본값은 A/B 테스트 여지를 남긴다.

### Requirement 9: Non-Goals 재확인 (설계 가드)

**User Story:** 설계자로서 커리큘럼 기반 추가가 Product Context 의 금지 항목을 부활시키지 않는지 확인하고자 한다.

#### Acceptance Criteria

1. THE 본 스펙 SHALL 어휘 팩 또는 단어 엔트리를 **메인 탭·플래시카드 세션·스펠링 퀴즈**로 노출하는 요구사항을 추가하지 않는다.
2. THE 본 스펙 SHALL 사용자의 발음·발화 평가 로직을 추가하지 않는다.
3. THE 본 스펙 SHALL 숙어·관용어 전용 트랙 또는 단원을 정의하지 않는다 (`docs/curriculum.md` §9).
4. THE 본 스펙 SHALL 학습 세션 중 배너·전면 광고를 추가하지 않는다.
5. WHEN 본 스펙의 어떤 요구사항이 위 1~4 를 위반하는 것처럼 보이면, THE 작성자 SHALL `docs/curriculum.md` · `product-context.md` 수정 여부를 먼저 확인하고, ground truth 가 바뀌지 않는 한 구현을 거부한다.
