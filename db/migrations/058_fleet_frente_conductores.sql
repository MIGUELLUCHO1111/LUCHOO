-- ============================================================
-- 058_fleet_frente_conductores.sql
-- Flota (pedido de Lguerra, 07/10/2026):
--   * fleet_unit_assignment -> frente / contrato / sitio donde esta asignada
--     cada unidad, con historial (una sola asignacion vigente por unidad).
--   * fleet_driver          -> registro de conductores (cedula, telefono,
--     licencia con su vencimiento, foto).
--   * fleet_unit_driver     -> que conductor maneja cada unidad, con
--     historial. fleet_unit.driver_name se sigue llenando (lo usan el
--     Tracker y los reportes).
--   * fleet_setting IDLE_ALERT_DAYS -> dias sin moverse para marcar una
--     unidad como "parada" (90 por defecto).
--   * Pantalla /fleet/drivers (Conductores) para admin y encargado de flota.
-- OJO al integrar con la rama de Julio (la principal): si alli ya existe una
-- migracion 058, se renumera esta, nunca la suya.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fleet_unit_assignment (
  id BIGSERIAL PRIMARY KEY,
  unit_id BIGINT NOT NULL REFERENCES public.fleet_unit(id) ON DELETE CASCADE,
  frente VARCHAR(120) NOT NULL,
  contrato VARCHAR(120),
  started_at DATE NOT NULL DEFAULT CURRENT_DATE,
  ended_at DATE,
  note TEXT,
  created_by VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fleet_unit_assignment_open ON public.fleet_unit_assignment (unit_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_unit_assignment_unit ON public.fleet_unit_assignment (unit_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.fleet_driver (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  cedula VARCHAR(30),
  phone VARCHAR(40),
  license_number VARCHAR(40),
  license_category VARCHAR(20),
  license_expires_at DATE,
  photo_url TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fleet_driver_cedula ON public.fleet_driver (UPPER(cedula)) WHERE cedula IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fleet_unit_driver (
  id BIGSERIAL PRIMARY KEY,
  unit_id BIGINT NOT NULL REFERENCES public.fleet_unit(id) ON DELETE CASCADE,
  driver_id BIGINT NOT NULL REFERENCES public.fleet_driver(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_by VARCHAR(120)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fleet_unit_driver_open ON public.fleet_unit_driver (unit_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fleet_unit_driver_driver ON public.fleet_unit_driver (driver_id) WHERE ended_at IS NULL;

INSERT INTO public.fleet_setting (key, value) VALUES ('IDLE_ALERT_DAYS', '90')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.option (name, description) VALUES
  ('/fleet/drivers', 'Flota - Conductores')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
CROSS JOIN public.option o
WHERE p.name IN ('admin', 'encargado_flota') AND o.name = '/fleet/drivers'
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
