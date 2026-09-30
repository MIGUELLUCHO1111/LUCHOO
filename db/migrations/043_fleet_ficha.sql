-- ============================================================
-- 043_fleet_ficha.sql
-- Modulo "Ficha de Vehiculos" (pedido de Lguerra, 30/09/2026): una ficha
-- 360 por unidad de fleet_unit, con los datos que hoy viven en Odoo
-- (Flotilla) mas lo que el tracker ya sabe (GPS, combustible).
--   * fleet_unit_profile  -> ficha tecnica, estado operativo, fiscal/contrato
--   * fleet_unit_document -> seguros, permisos, revisiones con vencimiento
--   * fleet_unit_service  -> mantenimientos (preventivos/correctivos)
--   * fleet_unit_event    -> historial (timeline) de la ficha
--   * fleet_setting       -> intervalo de mantenimiento por tipo de flota
-- Los datos se importan una vez desde Odoo y despues se editan en la app.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fleet_unit_profile (
  unit_id BIGINT PRIMARY KEY REFERENCES public.fleet_unit(id) ON DELETE CASCADE,
  operational_status VARCHAR(20) NOT NULL DEFAULT 'OPERATIVO'
    CHECK (operational_status IN ('OPERATIVO', 'EN_TALLER', 'FUERA_DE_SERVICIO')),
  -- ADN del vehiculo
  brand VARCHAR(80),
  model VARCHAR(120),
  model_year INT,
  vin VARCHAR(60),           -- serial de carroceria / chasis
  engine_serial VARCHAR(60), -- serial de motor
  color VARCHAR(40),
  fuel_type VARCHAR(30),
  -- Estado operativo / asignacion
  assigned_zone VARCHAR(120),
  driver_phone VARCHAR(40),
  driver_assigned_at DATE,
  next_driver VARCHAR(150),
  change_plan BOOLEAN NOT NULL DEFAULT FALSE,
  fleet_manager VARCHAR(150),
  avg_consumption_kml NUMERIC(8,2),
  -- Odometro cargado a mano (el GPS no lo manda); se compara contra el de
  -- los llenados de combustible y se usa el mas reciente.
  odometer_km NUMERIC(12,1),
  odometer_at DATE,
  -- Mantenimiento: NULL = usar el intervalo de su tipo de flota (fleet_setting)
  maint_interval_km INT,
  last_maint_km NUMERIC(12,1),
  last_maint_at DATE,
  -- Fiscal / contrato
  order_date DATE,
  registration_date DATE,
  cancellation_date DATE,
  first_contract_date DATE,
  hp_tax NUMERIC(14,2),
  catalog_value NUMERIC(14,2),
  purchase_value NUMERIC(14,2),
  residual_value NUMERIC(14,2),
  tags VARCHAR(250),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fleet_unit_document (
  id BIGSERIAL PRIMARY KEY,
  unit_id BIGINT NOT NULL REFERENCES public.fleet_unit(id) ON DELETE CASCADE,
  doc_type VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  number VARCHAR(80),
  provider VARCHAR(150),
  issued_at DATE,
  expires_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_fleet_unit_document_unit ON public.fleet_unit_document(unit_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fleet_unit_service (
  id BIGSERIAL PRIMARY KEY,
  unit_id BIGINT NOT NULL REFERENCES public.fleet_unit(id) ON DELETE CASCADE,
  service_at DATE NOT NULL,
  service_type VARCHAR(20) NOT NULL DEFAULT 'PREVENTIVO'
    CHECK (service_type IN ('PREVENTIVO', 'CORRECTIVO', 'OTRO')),
  odometer_km NUMERIC(12,1),
  description TEXT NOT NULL,
  workshop VARCHAR(150),
  cost NUMERIC(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_fleet_unit_service_unit ON public.fleet_unit_service(unit_id, service_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.fleet_unit_event (
  id BIGSERIAL PRIMARY KEY,
  unit_id BIGINT NOT NULL REFERENCES public.fleet_unit(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  detail TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fleet_unit_event_unit ON public.fleet_unit_event(unit_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.fleet_setting (
  key VARCHAR(50) PRIMARY KEY,
  value VARCHAR(100) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.fleet_setting (key, value) VALUES
  ('MAINT_INTERVAL_LIVIANA', '5000'),
  ('MAINT_INTERVAL_PESADA', '10000'),
  ('DOC_ALERT_DAYS', '30')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.option (name, description) VALUES
  ('/fleet', 'Flota - Fichas de Vehiculos')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
CROSS JOIN public.option o
WHERE p.name = 'admin' AND o.name = '/fleet'
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
