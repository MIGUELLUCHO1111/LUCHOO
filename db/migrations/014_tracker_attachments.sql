-- ============================================================
-- 014_tracker_attachments.sql
-- Anexos del reporte diario del Tracker GPS: archivos que no vienen
-- por la API (ej. el PDF del Dashboard de Seguridad de la plataforma,
-- que solo se puede exportar como imagen/PDF, no como datos crudos)
-- y se suben a mano para quedar adjuntos al reporte del dia.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tracker_daily_attachment (
  id BIGSERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  url VARCHAR(300) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes INTEGER,
  uploaded_by BIGINT REFERENCES public."user"(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tracker_attachment_fecha ON public.tracker_daily_attachment(fecha, tipo);

COMMIT;
