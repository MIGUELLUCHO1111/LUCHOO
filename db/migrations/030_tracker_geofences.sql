-- ============================================================
-- 030_tracker_geofences.sql
-- Geocercas sincronizadas desde GEvolution (plataforma Foresight
-- GPS): perimetro permitido de la operacion, pedido de Lguerra
-- 16/09/2026 -- cualquier unidad que quede fuera de TODAS las
-- geocercas registradas debe alertar de inmediato, todo el dia.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tracker_geofence (
  id BIGSERIAL PRIMARY KEY,
  external_id VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  comments TEXT,
  polygon JSONB NOT NULL, -- [[lng, lat], ...] en el mismo orden que trae la API (cierra sobre si mismo)
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
