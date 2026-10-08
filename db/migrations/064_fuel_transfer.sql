-- ============================================================
-- 064_fuel_transfer.sql
-- Combustible > Transferencias (Julio, 07/10/2026): hay unidades (dos
-- montacargas a gasolina, por ejemplo) que no pueden ir a una estación de
-- servicio; otra unidad (hoy la FP-VEH.02-11, pero puede cambiar) les pasa
-- de su gasolina. La transferencia:
--   * tiene su propio Transaction ID con la misma nomenclatura que las
--     cargas: FP-{AA}TR{MM}{DD}{###} (fuel_transaction_counter, código TR);
--   * descuenta los litros y el costo de la unidad de origen y se los suma
--     a la de destino en los reportes (costo = litros x precio por litro,
--     por defecto el de la última carga del origen);
--   * guarda la lectura (horómetro/odómetro) del destino, que Mantenimiento
--     usa como medidor;
--   * puede llevar fotos opcionales (fuel_foto.transfer_id).
-- Origen y destino: cualquier unidad, distintas entre sí.
-- Transacciones 188-193.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fuel_transfer (
  id BIGSERIAL PRIMARY KEY,
  transaction_no VARCHAR(40) NOT NULL UNIQUE,
  from_vehicle_id BIGINT NOT NULL REFERENCES public.fleet_unit(id),
  to_vehicle_id BIGINT NOT NULL REFERENCES public.fleet_unit(id),
  filled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  liters NUMERIC(10,2) NOT NULL,
  fuel_type VARCHAR(20) NOT NULL DEFAULT 'gasolina',
  unit_price_usd NUMERIC(10,4),
  amount NUMERIC(12,2),
  measurement_value NUMERIC(12,1),
  measurement_type VARCHAR(10),
  responsible_id BIGINT REFERENCES public.person(id),
  notes TEXT,
  created_by BIGINT REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_fuel_transfer_units CHECK (from_vehicle_id <> to_vehicle_id),
  CONSTRAINT ck_fuel_transfer_liters CHECK (liters > 0),
  CONSTRAINT ck_fuel_transfer_amounts CHECK ((unit_price_usd IS NULL OR unit_price_usd >= 0) AND (amount IS NULL OR amount >= 0)),
  CONSTRAINT ck_fuel_transfer_measurement CHECK (measurement_type IS NULL OR measurement_type IN ('km', 'horas'))
);
CREATE INDEX IF NOT EXISTS idx_fuel_transfer_filled ON public.fuel_transfer(filled_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fuel_transfer_from ON public.fuel_transfer(from_vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fuel_transfer_to ON public.fuel_transfer(to_vehicle_id) WHERE deleted_at IS NULL;

-- Fotos opcionales de la transferencia: fuel_foto ya sirve a cargas y pesadas.
ALTER TABLE public.fuel_foto ADD COLUMN IF NOT EXISTS transfer_id BIGINT REFERENCES public.fuel_transfer(id);
ALTER TABLE public.fuel_foto DROP CONSTRAINT IF EXISTS ck_fuel_foto_exactly_one_target;
ALTER TABLE public.fuel_foto ADD CONSTRAINT ck_fuel_foto_exactly_one_target
  CHECK (((refuel_id IS NOT NULL)::int + (pesada_id IS NOT NULL)::int + (transfer_id IS NOT NULL)::int) = 1);

INSERT INTO public.option (name, description) VALUES ('/fuel/transfers', 'Combustible - Transferencias')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id FROM public.profile p JOIN public.option o ON o.name = '/fuel/transfers'
WHERE p.name = 'admin'
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
