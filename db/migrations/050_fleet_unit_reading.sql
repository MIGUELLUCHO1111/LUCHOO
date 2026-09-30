-- ============================================================
-- 050_fleet_unit_reading.sql
-- Historial de lecturas de odometro (km) y horometro (horas) de cada
-- unidad (respuestas de Julio, 30/09/2026): "el odometro no se edita, se
-- vuelve a leer". Cada lectura queda guardada con su origen; un error se
-- corrige con una lectura nueva, o un admin la ANULA con motivo (no se
-- borra). La primera lectura es la BASE; si se cambia el tablero se
-- registra un REEMPLAZO, que empieza una nueva serie desde esa lectura.
-- Las lecturas de Combustible y Control de Horas NO se copian aqui: se leen
-- de sus tablas al consultar. Mantenimiento agregara una lectura
-- (source MANTENIMIENTO) al cerrar una orden de trabajo.
-- OJO al integrar con la rama de Julio (la principal): si alli existe una
-- 050, se renumera ESTA.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fleet_unit_reading (
  id BIGSERIAL PRIMARY KEY,
  unit_id BIGINT NOT NULL REFERENCES public.fleet_unit(id) ON DELETE CASCADE,
  meter VARCHAR(6) NOT NULL CHECK (meter IN ('KM', 'HORAS')),
  value NUMERIC(12,1) NOT NULL CHECK (value >= 0),
  read_at TIMESTAMPTZ NOT NULL,
  source VARCHAR(15) NOT NULL CHECK (source IN ('BASE', 'MANUAL', 'GPS', 'MANTENIMIENTO', 'REEMPLAZO')),
  note VARCHAR(250),
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voided_at TIMESTAMPTZ,
  voided_by VARCHAR(100),
  void_reason VARCHAR(250)
);
CREATE INDEX IF NOT EXISTS idx_fleet_unit_reading_unit ON public.fleet_unit_reading (unit_id, meter, read_at DESC) WHERE voided_at IS NULL;

-- Si alguna ficha ya tenia un odometro cargado a mano, pasa a ser su lectura base.
INSERT INTO public.fleet_unit_reading (unit_id, meter, value, read_at, source, note, created_by)
SELECT p.unit_id, 'KM', p.odometer_km, COALESCE(p.odometer_at::timestamptz, p.updated_at), 'BASE', 'Migrado del odómetro manual de la ficha', 'sistema'
FROM public.fleet_unit_profile p
WHERE p.odometer_km IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.fleet_unit_reading r WHERE r.unit_id = p.unit_id);

COMMIT;
