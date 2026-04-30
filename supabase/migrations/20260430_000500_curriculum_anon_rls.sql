-- Migration: curriculum anon RLS — 익명 사용자에게 커리큘럼 카탈로그 읽기 허용
--
-- 커리큘럼 카탈로그(단원 목록, 스텝, 어휘 팩)는 로그인 전에도 볼 수 있어야 한다.
-- 레벨 선택 → 단원 리스트 화면이 로그인 없이 동작해야 하므로 anon 역할에
-- SELECT 정책을 추가한다.

CREATE POLICY curriculum_unit_select_anon
  ON curriculum_unit FOR SELECT TO anon USING (true);

CREATE POLICY curriculum_step_select_anon
  ON curriculum_step FOR SELECT TO anon USING (true);

CREATE POLICY vocab_pack_select_anon
  ON vocab_pack FOR SELECT TO anon USING (true);

CREATE POLICY vocab_pack_entry_select_anon
  ON vocab_pack_entry FOR SELECT TO anon USING (true);

CREATE POLICY curriculum_unit_prerequisite_select_anon
  ON curriculum_unit_prerequisite FOR SELECT TO anon USING (true);
