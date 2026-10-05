-- ============================================================
-- 054_restore_unique_after_fleet_unit.sql
-- 040_fleet_unit_cleanup.sql hizo DROP COLUMN equipment_id en
-- hours_daily_entry y project_equipment_assignment, y Postgres borra junto
-- con la columna todo índice/restricción que la usaba -- el RENAME de
-- fleet_unit_id -> equipment_id no los recupera. Se perdieron:
--
--   * UNIQUE (project_id, equipment_id, fecha) de hours_daily_entry
--     (032): upsertRegistroDiario hace ON CONFLICT sobre esas columnas, así
--     que sin ella "Guardar día" en Control de Horas falla con 42P10.
--   * idx_assignment_equipment_open (035): índice único parcial que impide
--     dos asignaciones abiertas para el mismo equipo en peticiones
--     concurrentes.
--
-- Encontrado al importar el Excel de horas de septiembre (Julio,
-- 25/09/2026). Verificado antes de aplicar: 0 duplicados en ambos casos.
-- ============================================================

BEGIN;

ALTER TABLE public.hours_daily_entry
  DROP CONSTRAINT IF EXISTS hours_daily_entry_project_id_equipment_id_fecha_key;
ALTER TABLE public.hours_daily_entry
  ADD CONSTRAINT hours_daily_entry_project_id_equipment_id_fecha_key
  UNIQUE (project_id, equipment_id, fecha);

DROP INDEX IF EXISTS public.idx_assignment_equipment_open;
CREATE UNIQUE INDEX idx_assignment_equipment_open
  ON public.project_equipment_assignment(equipment_id) WHERE assigned_to IS NULL;

COMMIT;
