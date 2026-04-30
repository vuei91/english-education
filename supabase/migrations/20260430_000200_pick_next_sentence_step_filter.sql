-- Migration: pick_next_sentence — 커리큘럼 step 필터 추가
--
-- Scope (Tasks 2.1, 2.2, 2.3 — .kiro/specs/curriculum-foundation):
--   - 기존 4-arg 시그니처를 DROP 후 5-arg 로 재생성
--   - p_curriculum_step_id uuid DEFAULT NULL 파라미터 추가 (5번째)
--   - WHERE 절에 (p_curriculum_step_id IS NULL
--              OR s.curriculum_step_id = p_curriculum_step_id) 조건 추가
--   - RETURNS TABLE 에 curriculum_step_id, is_phrase 컬럼을 마지막에 append
--     (Task 8.2 의 클라이언트 매핑을 위해 미리 노출)
--
-- 설계 근거:
--   - p_curriculum_step_id 가 NULL(기본) 이면 기존 동작 완전 보존 (Req 5.3)
--   - NOT NULL 인데 결과가 비면 빈 결과. 전체 풀로 폴백하지 않는다 (Req 5.4)
--   - 파라미터 순서: 기존 4개 뒤에 append — 기존 트랙 A/B 화면 호출부가 깨지지
--     않도록 보장 (tasks.md §2 quote note)
--
-- 베이스 정의: 라이브 DB 에서 덤프한 기존 함수 본문을 그대로 사용하고 5번째
-- 파라미터와 WHERE 조건, RETURNS TABLE 두 컬럼만 추가했다. 로직 변경 없음.
--
-- Live DB 에 GRANT EXECUTE 가 이미 설정되어 있었으나 DROP 시 함께 제거되므로
-- 재생성 후 authenticated 역할에 GRANT 를 다시 부여한다.

-- ---------------------------------------------------------------------------
-- 기존 4-arg 시그니처 명시적 DROP
-- RETURNS TABLE 모양이 바뀌므로 CREATE OR REPLACE 만으로는 교체 불가 —
-- 반드시 DROP 후 재생성.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.pick_next_sentence(
  track_kind,
  cefr_level,
  text[],
  uuid[]
);

-- ---------------------------------------------------------------------------
-- 재생성: 5-arg 시그니처
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pick_next_sentence(
  p_track                track_kind,
  p_cefr                 cefr_level,
  p_hot_words            text[] DEFAULT ARRAY[]::text[],
  p_exclude_ids          uuid[] DEFAULT ARRAY[]::uuid[],
  p_curriculum_step_id   uuid   DEFAULT NULL
)
 RETURNS TABLE (
   id                  uuid,
   track               track_kind,
   text_en             text,
   text_ko             text,
   cefr_level          cefr_level,
   situation           text,
   source              text,
   license             text,
   curriculum_step_id  uuid,
   is_phrase           boolean
 )
 LANGUAGE sql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  with levels_allowed as (
    select unnest(enum_range(null::public.cefr_level, p_cefr)) as lvl
  ),
  candidates as (
    select s.*
    from public.sentences s
    where s.track = p_track
      and s.status = 'production'
      and s.cefr_level in (select lvl from levels_allowed)
      and (p_exclude_ids is null
           or cardinality(p_exclude_ids) = 0
           or not (s.id = any(p_exclude_ids)))
      and (p_curriculum_step_id is null
           or s.curriculum_step_id = p_curriculum_step_id)
  ),
  scored as (
    select
      c.*,
      (
        case
          when p_hot_words is null or cardinality(p_hot_words) = 0 then 0
          else (
            select count(distinct hw)
            from unnest(p_hot_words) hw
            where hw = any (regexp_split_to_array(lower(c.text_en), '\W+'))
          )
        end
      )::float as hot_score,
      random() as jitter
    from candidates c
  )
  select
    id,
    track,
    text_en,
    text_ko,
    cefr_level,
    situation,
    source,
    license,
    curriculum_step_id,
    is_phrase
  from scored
  order by hot_score desc, jitter
  limit 1;
$function$;

-- ---------------------------------------------------------------------------
-- GRANT EXECUTE
-- 라이브 DB 에서 authenticated 에게 부여되어 있던 권한을 재부여한다.
-- DROP 으로 함께 제거되므로 반드시 재생성 후 GRANT 를 다시 실행해야 앱에서
-- 호출 가능하다.
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.pick_next_sentence(
  track_kind,
  cefr_level,
  text[],
  uuid[],
  uuid
) TO authenticated;
