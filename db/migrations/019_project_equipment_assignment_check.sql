-- ============================================================
-- 019_project_equipment_assignment_check.sql
-- Un bug ya corregido en Equipo.asignarAProyecto (llamadas repetidas para
-- el mismo equipo+proyecto generaban una fila con assigned_to anterior a
-- assigned_from) dejó filas de historial con rango de fechas invertido --
-- inertes para las consultas (nunca hacen match), pero basura en el
-- historial. Este check evita que vuelva a pasar, sea cual sea la causa.
-- ============================================================

BEGIN;

DELETE FROM public.project_equipment_assignment
WHERE assigned_to IS NOT NULL AND assigned_to < assigned_from;

ALTER TABLE public.project_equipment_assignment
  ADD CONSTRAINT chk_assignment_dates_valid
  CHECK (assigned_to IS NULL OR assigned_to >= assigned_from);

COMMIT;
