-- ============================================================
-- Migración: Sección Combustible
-- Fecha: 19/08/2026
-- Agrega: vehicle, fuel_carga, fuel_foto
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Vehículos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  placa VARCHAR(20),
  tanque_capacidad_litros NUMERIC(8,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_vehicle_codigo UNIQUE (codigo)
);

-- ------------------------------------------------------------
-- Cargas de combustible
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fuel_carga (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id BIGINT NOT NULL REFERENCES public.vehicle(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  litros NUMERIC(8,2) NOT NULL,
  tanque_lleno BOOLEAN NOT NULL DEFAULT false,
  estacion VARCHAR(100),
  odometro NUMERIC(10,1),
  monto NUMERIC(12,2),
  observaciones TEXT,
  created_by BIGINT REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_fuel_carga_litros_positive CHECK (litros > 0)
);

CREATE INDEX IF NOT EXISTS idx_fuel_carga_vehicle
  ON public.fuel_carga (vehicle_id, fecha DESC);

-- ------------------------------------------------------------
-- Fotos de cargas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fuel_foto (
  id BIGSERIAL PRIMARY KEY,
  carga_id BIGINT NOT NULL REFERENCES public.fuel_carga(id),
  url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  mime_type VARCHAR(30) DEFAULT 'image/jpeg',
  size_bytes BIGINT,
  uploaded_by BIGINT REFERENCES public."user"(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fuel_foto_carga
  ON public.fuel_foto (carga_id);

COMMIT;
