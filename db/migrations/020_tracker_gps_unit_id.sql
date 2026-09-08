-- ============================================================
-- 020_tracker_gps_unit_id.sql
-- La API devuelve un "ID" numérico estable por unidad (el identificador
-- real del dispositivo GPS), presente incluso cuando la unidad no tiene
-- placa asignada. Hasta ahora se deduplicaba por placa: varias unidades
-- sin placa (plate = '' o NULL) colapsaban en una sola fila en
-- "última lectura por unidad", y en tracker_snapshot_summary una
-- sobreescribía a la otra por compartir la misma placa vacía -- ambos
-- casos perdían unidades reales que la API sí confirma. Se agrega esta
-- columna para deduplicar por el ID real de la unidad, no por la placa.
-- ============================================================

BEGIN;

ALTER TABLE public.tracker_snapshot ADD COLUMN IF NOT EXISTS gps_unit_id INTEGER;

-- Backfill: cada fila ya guarda la respuesta cruda de la API (raw_response),
-- que siempre trae "ID" -- se recupera de ahí en vez de perder el historial.
UPDATE public.tracker_snapshot
SET gps_unit_id = (raw_response->>'ID')::int
WHERE gps_unit_id IS NULL AND raw_response ? 'ID';

CREATE INDEX IF NOT EXISTS idx_tracker_snapshot_gps_unit_id ON public.tracker_snapshot(gps_unit_id, fetched_at DESC);

ALTER TABLE public.tracker_snapshot_summary ADD COLUMN IF NOT EXISTS gps_unit_id INTEGER;
ALTER TABLE public.tracker_snapshot_summary DROP CONSTRAINT IF EXISTS tracker_snapshot_summary_fecha_turno_plate_key;
ALTER TABLE public.tracker_snapshot_summary ADD CONSTRAINT tracker_snapshot_summary_fecha_turno_gps_unit_id_key UNIQUE (fecha, turno, gps_unit_id);

COMMIT;
