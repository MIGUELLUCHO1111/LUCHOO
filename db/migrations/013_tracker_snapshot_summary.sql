-- ============================================================
-- 013_tracker_snapshot_summary.sql
-- Politica de retencion del Tracker GPS: el detalle crudo de
-- tracker_snapshot (una fila por unidad cada 10 min) se conserva
-- solo por TRACKER_RETENTION_MONTHS; antes de borrarlo se resume
-- a esta tabla (una fila por unidad, por fecha y por turno) para
-- que el Reporte de Turno siga funcionando indefinidamente hacia
-- atras, sin conservar el detalle de alta frecuencia para siempre.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tracker_snapshot_summary (
  id BIGSERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  turno VARCHAR(20) NOT NULL,
  unit_id BIGINT REFERENCES public.tracker_unit(id),
  plate VARCHAR(20),
  gps_name VARCHAR(150),
  location_text VARCHAR(300),
  location_category VARCHAR(20),
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  speed NUMERIC(6,2),
  ignition BOOLEAN,
  status VARCHAR(20),
  is_stale BOOLEAN,
  last_report_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fecha, turno, plate)
);
CREATE INDEX IF NOT EXISTS idx_tracker_snapshot_summary_lookup ON public.tracker_snapshot_summary(fecha, turno);

COMMIT;
