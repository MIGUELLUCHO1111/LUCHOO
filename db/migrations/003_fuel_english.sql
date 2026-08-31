-- ============================================================
-- Migración 003: Modelo Combustible en inglés + Flota Pesada
-- Fecha: 27/08/2026
-- Decision: los identificadores de BD en inglés (además de código).
--
-- ⚠️ COORDINADO (fase backend): esta migración RENOMBRA columnas en
-- public.vehicle, public.fuel_carga y public.fuel_foto. Debe aplicarse
-- a la vez que se actualizan:
--   - backend/config/queries.yaml        (vehiculo/carga → English keys)
--   - backend/src/bo/.../vehiculo.js     (clase Vehicle)
--   - backend/src/bo/.../carga.js        (clase Refuel)
--   - frontend/src/services/fuelService.js  (wire keys en inglés)
--   - frontend/src/pages/fuel/*.jsx      (keys en inglés)
-- Aplicarla con la BD vieja y el backend viejo rompe tx 81-90.
--
-- Tabla fuel_pesada se crea AQUÍ en inglés (medida única valor+tipo).
-- fuel_tanque y fuel_tanque_movimiento: quedan documentadas (fase 2),
-- NO se crean en esta migración.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. vehicle: columnas en inglés
-- ------------------------------------------------------------
ALTER TABLE public.vehicle RENAME COLUMN codigo TO code;
ALTER TABLE public.vehicle RENAME COLUMN nombre TO name;
ALTER TABLE public.vehicle RENAME COLUMN placa TO plate;
ALTER TABLE public.vehicle RENAME COLUMN tanque_capacidad_litros TO tank_capacity_liters;
ALTER TABLE public.vehicle RENAME CONSTRAINT uq_vehicle_codigo TO uq_vehicle_code;

-- Tipo de flota (liviana | pesada) pendiente de persistencia:
ALTER TABLE public.vehicle ADD COLUMN IF NOT EXISTS fleet_type VARCHAR(20) NOT NULL DEFAULT 'liviana';

-- ------------------------------------------------------------
-- 2. fuel_carga: columnas en inglés
-- ------------------------------------------------------------
ALTER TABLE public.fuel_carga RENAME COLUMN fecha TO filled_at;
ALTER TABLE public.fuel_carga RENAME COLUMN litros TO liters;
ALTER TABLE public.fuel_carga RENAME COLUMN tanque_lleno TO tank_full;
ALTER TABLE public.fuel_carga RENAME COLUMN estacion TO station;
ALTER TABLE public.fuel_carga RENAME COLUMN odometro TO odometer;
ALTER TABLE public.fuel_carga RENAME COLUMN monto TO amount;
ALTER TABLE public.fuel_carga RENAME COLUMN observaciones TO notes;
ALTER TABLE public.fuel_carga RENAME CONSTRAINT ck_fuel_carga_litros_positive TO ck_fuel_carga_liters_positive;

-- Pendientes de la fase backend (hoy solo las maneja el front):
ALTER TABLE public.fuel_carga ADD COLUMN IF NOT EXISTS responsible_id BIGINT REFERENCES public.person(id);
ALTER TABLE public.fuel_carga ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(20) NOT NULL DEFAULT 'gasolina';

-- ------------------------------------------------------------
-- 3. fuel_foto: columnas en inglés
-- ------------------------------------------------------------
ALTER TABLE public.fuel_foto RENAME COLUMN carga_id TO refuel_id;
ALTER INDEX idx_fuel_foto_carga RENAME TO idx_fuel_foto_refuel;

-- ------------------------------------------------------------
-- 4. person: department (catálogo precargado en el front)
-- ------------------------------------------------------------
ALTER TABLE public.person ADD COLUMN IF NOT EXISTS department VARCHAR(150);

-- ------------------------------------------------------------
-- 5. fuel_pesada (flota pesada) — NUEVA, en inglés.
--    Medida única: valor + tipo ('km' | 'horas'). No hay odómetro:
--    hay unidades que se rigen por horas.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fuel_pesada (
  id BIGSERIAL PRIMARY KEY,
  transaction_no VARCHAR(40),
  vehicle_id BIGINT NOT NULL REFERENCES public.vehicle(id),
  filled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requester VARCHAR(120),
  fuel_type VARCHAR(20) NOT NULL DEFAULT 'gasoil',
  measurement_value NUMERIC(10,1),
  measurement_type VARCHAR(10) NOT NULL DEFAULT 'km',
  gallons NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_by BIGINT REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_fuel_pesada_gallons_positive CHECK (gallons > 0),
  CONSTRAINT ck_fuel_pesada_measurement_type CHECK (measurement_type IN ('km', 'horas'))
);

CREATE INDEX IF NOT EXISTS idx_fuel_pesada_vehicle
  ON public.fuel_pesada (vehicle_id, filled_at DESC);

COMMIT;