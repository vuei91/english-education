-- pick_next_sentence를 랜덤 대신 created_at 순서로 반환하도록 수정.
--
-- 학습 문장은 seed 순서(쉬운 패턴 → 복잡한 패턴)를 유지해야 학습 효과가 있음.
-- 기존: order by hot_score desc, jitter (random)
-- 변경: order by hot_score desc, created_at asc, id asc
--
-- hot_words 스코어는 여전히 1순위 우선, 동점이면 created_at asc로 순서 고정.

DROP FUNCTION IF EXISTS public.pick_next_sentence(
  track_kind,
  cefr_level,
  text[],
  uuid[],
  uuid
);

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
      )::float as hot_score
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
  order by hot_score desc, created_at asc, id asc
  limit 1;
$function$;

GRANT EXECUTE ON FUNCTION public.pick_next_sentence(
  track_kind,
  cefr_level,
  text[],
  uuid[],
  uuid
) TO authenticated, anon;
