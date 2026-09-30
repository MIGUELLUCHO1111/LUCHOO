-- ============================================================
-- 044_fleet_catalog.sql
-- Catalogo de Flota (pedido de Lguerra 30/09/2026, idea tomada del demo de
-- PJ y de ROADMAP_FLOTA_DETALLE.md): "lo que un equipo ES" -- marca, modelo
-- y version, con su foto -- separado de la unidad concreta (placa, serial).
-- La ficha de cada unidad elige su modelo de esta lista en vez de escribir
-- marca y modelo a mano (evita "Grove" / "GROVE" / "Grove RT760E").
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fleet_brand (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fleet_brand_name ON public.fleet_brand (LOWER(name));

CREATE TABLE IF NOT EXISTS public.fleet_model (
  id BIGSERIAL PRIMARY KEY,
  brand_id BIGINT NOT NULL REFERENCES public.fleet_brand(id),
  name VARCHAR(120) NOT NULL,
  -- Familia del equipo = prefijo del codigo interno (GT, MT, CF, VEH...).
  category VARCHAR(10) NOT NULL DEFAULT 'OTRO',
  body_type VARCHAR(60),
  capacity VARCHAR(40),
  fuel_type VARCHAR(30),
  meter_type VARCHAR(10) NOT NULL DEFAULT 'KM' CHECK (meter_type IN ('KM', 'HORAS', 'AMBOS')),
  photo_url VARCHAR(300),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fleet_model_name ON public.fleet_model (brand_id, LOWER(name));

CREATE TABLE IF NOT EXISTS public.fleet_model_version (
  id BIGSERIAL PRIMARY KEY,
  model_id BIGINT NOT NULL REFERENCES public.fleet_model(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fleet_model_version ON public.fleet_model_version (model_id, LOWER(name));

ALTER TABLE public.fleet_unit_profile
  ADD COLUMN IF NOT EXISTS model_id BIGINT REFERENCES public.fleet_model(id),
  ADD COLUMN IF NOT EXISTS version_id BIGINT REFERENCES public.fleet_model_version(id) ON DELETE SET NULL;

INSERT INTO public.option (name, description) VALUES
  ('/fleet/catalog', 'Flota - Catalogo de modelos')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
CROSS JOIN public.option o
WHERE p.name = 'admin' AND o.name = '/fleet/catalog'
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
