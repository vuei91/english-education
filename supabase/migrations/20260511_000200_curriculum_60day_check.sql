-- Migration: 30일 → 60일 커리큘럼 CHECK 제약 확장
--
-- curriculum_day.day_number 상한을 30에서 60으로 변경한다.
-- Day 31~60 데이터는 별도 마이그레이션에서 삽입한다.

ALTER TABLE curriculum_day DROP CONSTRAINT IF EXISTS curriculum_day_day_number_check;
ALTER TABLE curriculum_day ADD CONSTRAINT curriculum_day_day_number_check CHECK (day_number >= 1 AND day_number <= 60);
