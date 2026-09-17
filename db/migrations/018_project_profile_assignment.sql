-- ============================================================
-- 018_project_profile_assignment.sql
-- Restringe el Registro Diario de Control de Horas por proyecto: no todos
-- los proyectos los rellena la misma persona. El modelo de permisos
-- existente (Security/Profile) solo autoriza por método, sin noción de
-- "y solo para este proyecto" -- esta tabla agrega esa segunda capa:
-- qué perfil(es) pueden tocar cada proyecto. `admin` siempre tiene acceso
-- a todos los proyectos (no necesita fila aquí, se resuelve en el BO).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.project_profile_assignment (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.project(id),
  profile_id BIGINT NOT NULL REFERENCES public.profile(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_project_profile_project ON public.project_profile_assignment(project_id);
CREATE INDEX IF NOT EXISTS idx_project_profile_profile ON public.project_profile_assignment(profile_id);

COMMIT;
