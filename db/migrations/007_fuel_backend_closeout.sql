-- ============================================================
-- Migración 007: Cierre backend de Combustible
-- Fecha: 01/09/2026
--
-- 1. fuel_carga: agrega transaction_no (nomenclatura libre, ya existe en
--    fuel_pesada).
-- 2. fuel_foto: refuel_id pasa a ser opcional y se agrega pesada_id, con un
--    CHECK que exige exactamente uno de los dos (antes solo podía apuntar a
--    fuel_carga, nunca a fuel_pesada).
-- 3. fuel_tank / fuel_tank_movement (nuevas, en inglés): tanque de gasoil
--    (fase 2 del roadmap) + ledger de entradas/salidas. Se siembra un tanque
--    activo por defecto para que el descuento automático desde Pesada
--    funcione desde el primer arranque.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. fuel_carga: nomenclatura libre
-- ------------------------------------------------------------
ALTER TABLE public.fuel_carga ADD COLUMN IF NOT EXISTS transaction_no VARCHAR(40);

-- ------------------------------------------------------------
-- 2. fuel_foto: soporte para apuntar también a fuel_pesada
-- ------------------------------------------------------------
ALTER TABLE public.fuel_foto ALTER COLUMN refuel_id DROP NOT NULL;
ALTER TABLE public.fuel_foto ADD COLUMN IF NOT EXISTS pesada_id BIGINT REFERENCES public.fuel_pesada(id);
ALTER TABLE public.fuel_foto ADD CONSTRAINT ck_fuel_foto_exactly_one_target
  CHECK ((refuel_id IS NOT NULL)::int + (pesada_id IS NOT NULL)::int = 1);
CREATE INDEX IF NOT EXISTS idx_fuel_foto_pesada ON public.fuel_foto (pesada_id);

-- ------------------------------------------------------------
-- 3. fuel_tank / fuel_tank_movement (tanque de gasoil, fase 2)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fuel_tank (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  capacity_liters NUMERIC(10,2) NOT NULL,
  min_alert_liters NUMERIC(10,2) NOT NULL DEFAULT 0,
  fuel_type VARCHAR(20) NOT NULL DEFAULT 'gasoil',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.fuel_tank_movement (
  id BIGSERIAL PRIMARY KEY,
  tank_id BIGINT NOT NULL REFERENCES public.fuel_tank(id),
  movement_type VARCHAR(10) NOT NULL,
  quantity_liters NUMERIC(10,2) NOT NULL,
  reference_type VARCHAR(20),
  reference_id BIGINT,
  notes TEXT,
  created_by BIGINT REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_fuel_tank_movement_type CHECK (movement_type IN ('in', 'out')),
  CONSTRAINT ck_fuel_tank_movement_qty_positive CHECK (quantity_liters > 0)
);

CREATE INDEX IF NOT EXISTS idx_fuel_tank_movement_tank
  ON public.fuel_tank_movement (tank_id, created_at DESC);

INSERT INTO public.fuel_tank (code, name, capacity_liters, min_alert_liters, fuel_type)
SELECT 'TANQUE-01', 'Tanque Principal de Gasoil', 5000, 500, 'gasoil'
WHERE NOT EXISTS (SELECT 1 FROM public.fuel_tank WHERE code = 'TANQUE-01');

COMMIT;
