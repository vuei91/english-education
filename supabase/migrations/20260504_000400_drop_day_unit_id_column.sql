-- Migration: curriculum_day.unit_id 컬럼 제거
--
-- Step 4: 브릿지 테이블(curriculum_day_unit)로 대체되었으므로
-- 기존 1:1 FK 컬럼을 DROP 한다.
-- 이 시점에서 모든 매핑은 curriculum_day_unit에 존재한다.

ALTER TABLE curriculum_day DROP COLUMN IF EXISTS unit_id;
