-- ============================================================
-- 021_tracker_report_file_sin_senal.sql
-- "Sin señal reciente" pasa a ser un cuarto dato guardado junto con
-- total/activas/estacionadas en cada reporte generado (antes solo vivía
-- como una marca por fila, sin sumarse en ningún lado).
-- ============================================================

BEGIN;

ALTER TABLE public.tracker_report_file ADD COLUMN IF NOT EXISTS sin_senal INTEGER;

COMMIT;
