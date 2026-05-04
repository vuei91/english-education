-- Migration: curriculum_day_unit 브릿지 테이블 생성
--
-- 100일 → 30일 압축 마이그레이션 Step 1.
-- 기존 curriculum_day.unit_id (1:1) 관계를 1:N으로 전환하기 위한
-- 브릿지 테이블. 하루에 여러 unit을 배정할 수 있다.

CREATE TABLE curriculum_day_unit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id      uuid NOT NULL REFERENCES curriculum_day(id) ON DELETE CASCADE,
  unit_id     uuid NOT NULL REFERENCES curriculum_unit(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  UNIQUE (day_id, unit_id)
);

CREATE INDEX idx_day_unit_day ON curriculum_day_unit(day_id);
CREATE INDEX idx_day_unit_unit ON curriculum_day_unit(unit_id);

-- RLS
ALTER TABLE curriculum_day_unit ENABLE ROW LEVEL SECURITY;

CREATE POLICY curriculum_day_unit_select_authenticated
  ON curriculum_day_unit FOR SELECT TO authenticated USING (true);

CREATE POLICY curriculum_day_unit_select_anon
  ON curriculum_day_unit FOR SELECT TO anon USING (true);
