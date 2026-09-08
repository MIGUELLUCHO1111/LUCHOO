-- ============================================================
-- 010_tracker_alerts.sql
-- Seccion Tracker GPS: alertas automaticas (Fase 2).
-- Agrega la "zona esperada" opcional por unidad y la tabla de
-- alertas (fuera de horario / fuera de zona) con des-duplicacion
-- por episodio (no se re-notifica mientras la alerta siga abierta).
-- ============================================================

BEGIN;

ALTER TABLE public.tracker_unit
  ADD COLUMN IF NOT EXISTS expected_category VARCHAR(20)
    CHECK (expected_category IN ('BASE','CAMPO','OFICINA','OTRAS'));

CREATE TABLE IF NOT EXISTS public.tracker_alert (
  id BIGSERIAL PRIMARY KEY,
  unit_id BIGINT REFERENCES public.tracker_unit(id),
  plate VARCHAR(20),
  alert_type VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  snapshot_id BIGINT REFERENCES public.tracker_snapshot(id),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified BOOLEAN NOT NULL DEFAULT FALSE,
  notify_error TEXT,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tracker_alert_open ON public.tracker_alert(unit_id, alert_type, resolved_at);
CREATE INDEX IF NOT EXISTS idx_tracker_alert_triggered ON public.tracker_alert(triggered_at DESC);

COMMIT;
