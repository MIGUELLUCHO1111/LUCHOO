-- ============================================================
-- 015_tracker_remove_expected_category.sql
-- Se descarta el concepto de "zona esperada" geografica (Base/Campo/
-- Oficina/Otras) para la alerta de la unidad -- lo que realmente se
-- necesita es la regla de horario ya existente (fuera_de_horario):
-- fuera del horario de circulacion, la unidad deberia estar
-- ESTACIONADO; si aparece ACTIVO, esa es la alerta real.
-- ============================================================

BEGIN;

ALTER TABLE public.tracker_unit DROP COLUMN IF EXISTS expected_category;

COMMIT;
