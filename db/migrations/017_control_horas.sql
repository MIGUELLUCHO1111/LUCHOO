-- ============================================================
-- 017_control_horas.sql
-- Nueva sección "Control de Horas": reemplaza el control manual en Excel
-- (horas ejecutadas/PTO/stand-by por equipo pesado, día a día) con una
-- jerarquía Empresa -> Proyecto -> Equipo (asignación con vigencia) ->
-- Registro diario. Ver ROADMAP_HORAS_RENTABILIDAD.md para el detalle
-- completo del análisis y las decisiones de alcance.
--
-- OJO: "equipment" es a propósito un registro genérico (código/nombre),
-- pensado para eventualmente convertirse en el registro centralizado de
-- "unidad" entre Fuel/Tracker/Horas -- esta migración NO toca `vehicle`
-- ni `tracker_unit`, esa unificación es trabajo aparte.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.company (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.project (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES public.company(id),
  name VARCHAR(150) NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- 'izamiento' por ahora; más tipos después (ver roadmap)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_project_company ON public.project(company_id);

CREATE TABLE IF NOT EXISTS public.equipment (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE, -- ej. FP-GT-02
  name VARCHAR(150),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Asignación equipo -> proyecto, vigente por un período (un equipo, un
-- solo proyecto a la vez). assigned_to NULL = asignación vigente.
CREATE TABLE IF NOT EXISTS public.project_equipment_assignment (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.project(id),
  equipment_id BIGINT NOT NULL REFERENCES public.equipment(id),
  assigned_from DATE NOT NULL,
  assigned_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignment_equipment_open
  ON public.project_equipment_assignment(equipment_id) WHERE assigned_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignment_project
  ON public.project_equipment_assignment(project_id);

-- Registro diario. executed_hours/pto_hours/standby_hours/contracted_hours
-- son los 4 campos que rellena a mano la persona encargada cada día
-- (contracted_hours = "HRS. TOTALES" del Excel, varía por proyecto/día,
-- también manual). TOTAL y %STAND-BY se calculan en la query, no se
-- guardan -- evita el problema de acumulado desincronizado que tenía el
-- Excel (ver ROADMAP_HORAS_RENTABILIDAD.md).
CREATE TABLE IF NOT EXISTS public.hours_daily_entry (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.project(id),
  equipment_id BIGINT NOT NULL REFERENCES public.equipment(id),
  fecha DATE NOT NULL,
  executed_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  pto_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  standby_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  contracted_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  notes VARCHAR(300),
  created_by BIGINT REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, equipment_id, fecha)
);
CREATE INDEX IF NOT EXISTS idx_hours_entry_project_fecha
  ON public.hours_daily_entry(project_id, fecha);

INSERT INTO public.option (name, description) VALUES
  ('/hours', 'Control de Horas - Registro Diario'),
  ('/hours/companies', 'Control de Horas - Empresas'),
  ('/hours/projects', 'Control de Horas - Proyectos'),
  ('/hours/equipment', 'Control de Horas - Equipos')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
CROSS JOIN public.option o
WHERE p.name = 'admin'
  AND o.name IN ('/hours', '/hours/companies', '/hours/projects', '/hours/equipment')
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
