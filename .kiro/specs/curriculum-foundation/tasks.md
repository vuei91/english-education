# Tasks — 커리큘럼 기반(Foundation)

## 1. Supabase 스키마 · 테이블 생성

- [x] 1. Supabase 커리큘럼 스키마 마이그레이션
  - [x] 1.1 `supabase/migrations/<ts>_curriculum_foundation.sql` 생성 — 5개 신규 테이블(`vocab_pack`, `vocab_pack_entry`, `curriculum_unit`, `curriculum_step`, `curriculum_unit_prerequisite`)과 CHECK 제약을 design.md Data Model 그대로 적재 (Req 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11)
  - [x] 1.2 동일 마이그레이션에 5개 테이블 모두 RLS 활성화 + `authenticated` 역할의 `SELECT` 정책 추가 (Req 1.12)
  - [x] 1.3 `sentences` 테이블에 `curriculum_step_id uuid nullable` + `is_phrase bool not null default false` 컬럼 추가 · `ON DELETE SET NULL` · 기존 행은 디폴트로 채움 · `idx_sentences_curriculum_step` 부분 인덱스 생성 (Req 2.1, 2.2, 2.3, 2.4, 2.5)
  > design.md Data Model 섹션의 DDL 을 그대로 따른다. UUID 생성은 `gen_random_uuid()` 사용. `pgcrypto` 가 이미 활성화되어 있는지 마이그레이션 첫 줄에서 `CREATE EXTENSION IF NOT EXISTS pgcrypto;` 로 확인.

- [x] 2. `pick_next_sentence` RPC 확장
  - [x] 2.1 기존 RPC 를 `DROP FUNCTION ... ; CREATE OR REPLACE FUNCTION ...` 로 재생성하면서 `p_curriculum_step_id uuid DEFAULT NULL` 파라미터 추가 (Req 5.1, 5.2)
  - [x] 2.2 WHERE 절에 `(p_curriculum_step_id IS NULL OR s.curriculum_step_id = p_curriculum_step_id)` 조건 추가 — 기본값 NULL 시 기존 동작 유지 (Req 5.3)
  - [x] 2.3 `p_curriculum_step_id` 가 NOT NULL 인데 결과가 비면 폴백 없이 빈 결과 반환 (Req 5.4)
  > 기존 RPC 시그니처가 기존 트랙 A/B 화면에서 호출 중이다. 파라미터 순서는 기존 4개 뒤에 추가해 기존 호출부가 깨지지 않게 한다.

## 2. TypeScript 도메인 타입

- [x] 3. `app/src/types/domain.ts` 확장
  - [x] 3.1 `GrammarTrack`, `GrammarPoint`, `UnitOpens`, `CurriculumStepType`, `VocabPackPos` 유니온 타입 추가 (Req 3.1, 3.2, 3.3, 3.4)
  - [x] 3.2 `CurriculumUnit`, `CurriculumStep`, `VocabPack`, `VocabPackEntry`, `ChunkEntry` 타입 + `isChunkEntry(entry): entry is ChunkEntry` 타입 가드 추가 (Req 3.1, 3.5)
  - [x] 3.3 기존 `Sentence` 를 `ContentService.ts` 에서 `domain.ts` 로 이동 · `curriculumStepId?: string | null` 과 `isPhrase: boolean` 필드 추가 · `ContentService` 는 re-export (Req 3.6, 2.3)
  > Req 3.6 는 기존 `Sentence` 이동을 요구한다. 이동 후 `TrackASessionScreen`, `TrackBSessionScreen` 등 기존 import 가 깨지지 않도록 `ContentService` 에서 `export type { Sentence } from '../../types/domain';` 로 재공급.

- [x] 4. 타입 검증
  - [x] 4.1 `getDiagnostics` 로 `app/src/types/domain.ts`, `app/src/services/content/ContentService.ts`, Sentence 를 사용하는 모든 파일 타입 검사 (Req 3.1~3.6)
  > 이동 후 repo 전체에서 `Sentence` import 경로가 바뀐 곳이 없는지 확인. 있으면 이 태스크에서 함께 수정.

## 3. CurriculumService 구현

- [x] 5. CurriculumService 골격
  - [x] 5.1 `app/src/services/curriculum/CurriculumService.ts` 생성 · 클래스 생성자 + `CurriculumUnavailableError`, `CurriculumIntegrityError` 두 에러 타입 정의 (Req 7.1)
  - [x] 5.2 Supabase 에서 `curriculum_unit` + `curriculum_unit_prerequisite` join 쿼리로 `listUnits(level?)` 구현 · `order_index` 오름차순 정렬 (Req 7.1, 7.2)
  - [x] 5.3 `getUnitWithSteps(unitId)` 구현 — 단원 + 3 step + vocab_pack(entries 포함) 한 번에 로드 · step 이 3개 미만이면 `CurriculumIntegrityError` (Req 7.3)
  - [x] 5.4 `getNextStep(unitId, completedStepIds)` 구현 — step_type 순서 `phrase → conjugation → substitution` 엄격 강제 · 모두 완료 시 `null` (Req 7.4)
  - [x] 5.5 `isUnitUnlocked(unitId, completedUnitIds, options)` 구현 · `enforce` 기본 `false` — 경고만 (Req 8.1, 8.2, 8.3, 8.4)
  > `CurriculumService` 는 Supabase 직접 쿼리. RPC 만들 필요 없음. `vocab_pack_entry` 를 조인할 때 배열로 묶는 건 TS 쪽에서 reduce.

- [x] 6. CurriculumService 캐시 레이어
  - [x] 6.1 인메모리 Map 캐시 추가 — `listUnits` 결과 전체 + `getUnitWithSteps` 결과 per unitId (Req 7.5)
  - [x] 6.2 `content_cache` SQLite 테이블 재사용 — `kind` 값으로 `'curriculum_catalog'`, `'curriculum_unit'`, `'vocab_pack'` 추가 사용 · `readCache`/`writeCache` 패턴을 `ContentService` 에서 그대로 모방 (Req 7.5)
  - [x] 6.3 오프라인 + 캐시 miss 시 `CurriculumUnavailableError` throw (Req 7.6)
  - [x] 6.4 `invalidateCache()` public 메서드 — 메모리·SQLite 둘 다 비움
  > `ContentService` 의 `readCache`/`writeCache` 는 `private` 이다. 공통화 리팩토링은 하지 말 것 — 이 스펙 범위 밖이다. 같은 패턴을 `CurriculumService` 내부에 그대로 재구현.

- [x] 7. `app/src/services/curriculum/index.ts` barrel export 생성
  - [x] 7.1 `CurriculumService`, `CurriculumUnavailableError`, `CurriculumIntegrityError` export

## 4. ContentService 확장

- [x] 8. `getNextSentence` 옵션 추가
  - [x] 8.1 옵션 타입에 `curriculumStepId?: string` 추가 · RPC 호출에 `p_curriculum_step_id` 전달 (Req 5.1, 5.2)
  - [x] 8.2 RPC 응답에서 `curriculum_step_id`, `is_phrase` 컬럼을 `Sentence.curriculumStepId`, `Sentence.isPhrase` 로 매핑 (Req 2.3, 5.5)
  - [x] 8.3 폴백 없음 확인 — `curriculumStepId` 제공 시 결과가 비면 `null` (Req 5.4)
  > 기존 테스트(`ContentService.test.ts`) 가 있다. 기존 시그니처(옵션 미제공) 회귀 없음을 먼저 확인하고, 옵션 제공 케이스 테스트는 태스크 14 에서 추가.

## 5. 세션 · 진도 스토어

- [x] 9. `useSessionStore` 커리큘럼 필드
  - [x] 9.1 `currentUnitId: string | null`, `currentCurriculumStepId: string | null` 필드 + 초기값 추가 (Req 6.1)
  - [x] 9.2 `startSession(track, firstSentenceId, curriculum?)` 시그니처 확장 · `curriculum` 은 선택 인자로 하위호환 유지 (Req 6.2)
  - [x] 9.3 `endSession()` 에서 두 필드 null 초기화 (Req 6.3)
  > 기존 호출부(`TrackASessionScreen`, `TrackBSessionScreen`) 는 건드리지 않는다. `curriculum` 인자 미제공 시 기존 동작 그대로.

- [x] 10. `useProgressStore` 커리큘럼 완료 집합
  - [x] 10.1 `completedUnitIds: Set<string>`, `completedStepIds: Set<string>` 필드 · 초기값은 빈 Set (Req 6.4)
  - [x] 10.2 `PersistedShape` 에 `completedUnitIds: string[]`, `completedStepIds: string[]` 추가 · `snapshot()` 에서 `Array.from(set)` 으로 직렬화 · `hydrate()` 에서 `new Set(array)` 로 복원 (Req 6.7)
  - [x] 10.3 `markStepCompleted(unitId, stepId, allStepIdsOfUnit)` 액션 추가 · step 추가 → 단원 모든 step 완료 시 `completedUnitIds` 에 `unitId` 추가 · `{ unitCompleted: boolean }` 반환 (Req 6.5, 6.6)
  - [x] 10.4 `markStepCompleted` 호출 후 AsyncStorage persist (Req 6.7)
  > `initialPersisted` 기본값을 업데이트해서 pre-8.5 persist 가 이 필드를 `[]` 로 보도록. 기존 drill completion 필드 확장 패턴(task 8.5 머지 방식) 그대로 따른다.

- [x] 11. `SyncService` 인터페이스 선언 (구현은 후속 스펙)
  - [x] 11.1 `SyncService` 에 `queueCurriculumProgress(userId, { completedUnitIds, completedStepIds })` 메서드 **시그니처만** 추가 — 실제 네트워크 구현은 `Sync` 스펙에서. 내부는 TODO 주석 + 로컬 큐 테이블 write (Req 6.7)
  > 이 태스크는 인터페이스만 박는다. Req 6.7 의 "Sync_Service 동기화 큐에 올라간다" 를 만족시키려면 진입점이 존재해야 한다.

## 6. A1 단원 시드

- [x] 12. A1 vocab pack 시드
  - [x] 12.1 `supabase/migrations/<ts>_curriculum_a1_seed.sql` 생성 · A1 단원 8개 각각에 대응하는 `vocab_pack` + `vocab_pack_entry` 를 `INSERT ... ON CONFLICT DO NOTHING` 로 적재 · 팩 size 15~25 준수 · 단원 1 이후는 `role='review'` 비율 20~30% (Req 4.6, 4.7)
  - [x] 12.2 고정 UUID 사용 · 팩 title/theme 을 `docs/curriculum.md` §5-1 에 맞게 설정
  > `#vocab-pack-builder` steering 을 로드해서 각 팩 구성을 설계한 뒤 SQL 로 변환. 고빈도 A1 어휘는 General Service List / NGSL 공개 자료 기반. 팩의 구체 구성은 서브에이전트 위임 후 검토.

- [x] 13. A1 단원 · step · prerequisite 시드
  - [x] 13.1 동일 마이그레이션(또는 별도 다음 번호) 에 `curriculum_unit` 8개를 `order_index` 1~8 로 INSERT · `opens` 는 §5-1 기준 (Req 4.1, 4.3, 4.4, 4.5)
  - [x] 13.2 각 단원에 `curriculum_step` 3개(phrase/conjugation/substitution, order_index 1/2/3) INSERT (Req 4.2)
  - [x] 13.3 `curriculum_unit_prerequisite` 로 선행 관계 INSERT — 1번은 빈 배열, 2·3은 1에 의존, 4는 1~3에 의존, 그 이후 §5-1 표 따라 (Req 4.3, 4.4, 4.5)
  - [x] 13.4 시드 마이그레이션이 Sentence 를 INSERT 하지 않음을 검증 — 파일 내 `INSERT INTO sentences` 문자열 존재 금지 (Req 4.8)
  > `#curriculum-architect` 로 각 단원의 `opens`/`theme`/`prerequisites` 를 확정한 뒤 SQL 로 변환. UUID 는 고정값 상수로 공유(팩 ID 가 단원 INSERT 에 필요하므로 태스크 12 가 먼저).

## 7. 테스트

- [x] 14. CurriculumService 테스트
  - [x] 14.1 `app/src/services/curriculum/__tests__/CurriculumService.test.ts` 생성 (Req 7.1~7.6, 8.1~8.4)
  - [x] 14.2 `listUnits` 는 order_index 오름차순 — 단위 테스트
  - [x] 14.3 `getNextStep` — phrase/conj/sub 순서 강제 · 모두 완료 시 null — 단위 테스트
  - [x] 14.4 `isUnitUnlocked(enforce: false)` 는 항상 true · `enforce: true` 시 선행 미완료면 false — 단위 테스트
  - [x] 14.5 오프라인 + 캐시 miss 시 `CurriculumUnavailableError` — 단위 테스트 (Supabase 모킹)
  - [ ] 14.6* **Validates: Requirements 7.4** — property test: 임의 completedStepIds 부분집합에 대해 `getNextStep` 은 항상 `phrase(1) → conj(2) → sub(3)` 순서의 최소 미완료 step 반환

- [x] 15. ContentService 확장 테스트
  - [x] 15.1 기존 `ContentService.test.ts` 에 `getNextSentence({ curriculumStepId })` 케이스 추가 (Req 5.1~5.5)
  - [x] 15.2 `curriculumStepId` 없는 기존 호출은 기존 동작 유지 — 회귀 테스트 (Req 5.3)
  - [x] 15.3 `curriculumStepId` 제공 + 결과 empty 시 null 반환 — 폴백 없음 검증 (Req 5.4)

- [x] 16. useSessionStore / useProgressStore 테스트
  - [x] 16.1 `useSessionStore.startSession` 이 curriculum 인자 없이도 기존처럼 동작 + 제공 시 필드 채움 (Req 6.1, 6.2, 6.3)
  - [x] 16.2 `useProgressStore.markStepCompleted` 가 step 추가 + 모든 step 완료 시 unit 추가 · `{ unitCompleted: true }` 반환 (Req 6.5, 6.6)
  - [x] 16.3 `hydrate` 후 `completedUnitIds`/`completedStepIds` 가 `Set` 인스턴스로 복원 — round-trip 테스트 (Req 6.7)
  - [ ] 16.4* **Validates: Requirements 6.6** — property test: 임의의 step 완료 순열에 대해 단원 완료 플래그는 모든 step 이 완료된 시점에만 true 로 전환

- [x] 17. 타입 · 린트 최종 검증
  - [x] 17.1 `getDiagnostics` 로 본 스펙에서 수정한 모든 파일 검사
  - [x] 17.2 `npx jest --run` 으로 관련 테스트 스위트 실행 (Task 14~16)
  > watch 모드 금지. 단발 실행만.

## 8. 문서 갱신 (마무리)

- [x] 18. 기획서 · 커리큘럼 문서 갱신
  - [x] 18.1 `docs/planning.md` 6-1-1 섹션 말미에 "커리큘럼 구조는 `docs/curriculum.md` 참조" 링크 한 줄 추가 — 기획서는 ground truth 이므로 최소 수정
  - [x] 18.2 `docs/curriculum.md` §8 열어둔 질문 중 본 스펙이 답한 것(질문 2 — 단원 잠금 기본값) 옆에 "→ curriculum-foundation 스펙에서 enforce=false 로 결정 (D4)" 주석 추가
