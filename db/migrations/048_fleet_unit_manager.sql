-- ============================================================
-- 048_fleet_unit_manager.sql
-- Encargado de cada unidad (respuestas de Julio, 30/09/2026): un admin le
-- asigna a cada unidad su encargado (usuario con perfil encargado_flota) y
-- ese encargado completa la ficha de SUS unidades. El backend valida en cada
-- funcion que modifica (ver classes/fleetAccess.js). Se guarda el historial:
-- al cambiar de encargado se cierra la fila anterior (ended_at).
-- OJO al integrar con la rama de Julio (la principal): si alli existe una
-- 048, se renumera ESTA.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fleet_unit_manager (
  id BIGSERIAL PRIMARY KEY,
  unit_id BIGINT NOT NULL REFERENCES public.fleet_unit(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES public."user"(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by VARCHAR(100),
  ended_at TIMESTAMPTZ,
  ended_by VARCHAR(100)
);
-- Un solo encargado vigente por unidad.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fleet_unit_manager_current ON public.fleet_unit_manager (unit_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_unit_manager_user ON public.fleet_unit_manager (user_id) WHERE ended_at IS NULL;

-- Perfil del encargado (syncPermissions tambien lo crearia al arrancar, pero
-- hace falta ya para darle sus secciones del menu).
INSERT INTO public.profile (name, description)
SELECT 'encargado_flota', 'Encargado de flota: completa la ficha de las unidades que tiene asignadas'
WHERE NOT EXISTS (SELECT 1 FROM public.profile WHERE name = 'encargado_flota');

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
CROSS JOIN public.option o
WHERE p.name = 'encargado_flota' AND o.name IN ('/fleet', '/fleet/catalog')
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
