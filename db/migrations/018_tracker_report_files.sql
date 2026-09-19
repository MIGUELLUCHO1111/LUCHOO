-- ============================================================
-- 018_tracker_report_files.sql
-- Archivo Excel del Reporte de Turno generado automáticamente al cierre
-- de cada turno (ver Notificador.notificarCierreDeTurno / scheduler.js),
-- guardado por fecha+turno para poder descargarlo después con un clic
-- desde el historial, sin tener que reconstruirlo a mano cada vez.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tracker_report_file (
  id BIGSERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  turno VARCHAR(20) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  url VARCHAR(300) NOT NULL,
  mime_type VARCHAR(150) NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  size_bytes INTEGER,
  total INTEGER,
  activas INTEGER,
  estacionadas INTEGER,
  telegram_sent BOOLEAN NOT NULL DEFAULT FALSE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fecha, turno)
);
CREATE INDEX IF NOT EXISTS idx_tracker_report_file_fecha ON public.tracker_report_file(fecha DESC, turno);

COMMIT;
