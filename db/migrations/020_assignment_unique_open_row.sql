-- ============================================================
-- 020_assignment_unique_open_row.sql
-- El invariante "un equipo tiene, a lo sumo, UNA asignación vigente
-- (assigned_to IS NULL) a la vez" hasta ahora solo lo garantizaba el
-- código de la aplicación (Equipo.asignarAProyecto). Un bug ya corregido
-- ahí demostró que confiar solo en el código no basta -- para producción
-- esto tiene que ser imposible de violar, sin importar bugs futuros,
-- reintentos de red o llamadas concurrentes. Se sube a restricción real
-- de base de datos: un índice único parcial. Cualquier intento de dejar
-- dos filas abiertas para el mismo equipo falla con un error de Postgres
-- (23505), en vez de corromper silenciosamente el historial.
-- ============================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_assignment_equipment_open;

CREATE UNIQUE INDEX idx_assignment_equipment_open
  ON public.project_equipment_assignment(equipment_id) WHERE assigned_to IS NULL;

COMMIT;
