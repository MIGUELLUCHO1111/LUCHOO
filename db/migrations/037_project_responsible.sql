-- ============================================================
-- 037_project_responsible.sql
-- Responsable de cada proyecto (quién está a cargo), elegido desde el
-- registro de Personas -- un solo campo, lo pone/cambia quien crea o
-- edita el proyecto (admin por ahora, ver ROADMAP). Sin historial de
-- cambios ni múltiples responsables por diseño explícito de Julio.
-- ============================================================

BEGIN;

ALTER TABLE public.project
  ADD COLUMN IF NOT EXISTS responsible_person_id BIGINT REFERENCES public.person(id);

COMMIT;
