-- ============================================================
-- 046_fleet_family.sql
-- Familias de equipo editables desde el Catalogo de Flota (pedido de
-- Lguerra 30/09/2026): antes estaban fijas en el codigo del frontend. La
-- familia = prefijo del codigo interno de la unidad (FP-GT.06 -> GT) y cada
-- una tiene su nombre y la ilustracion que se muestra cuando un modelo no
-- tiene foto. Se siembran solo las confirmadas en ROADMAP_FLOTA_DETALLE.md.
-- OJO al integrar con la rama de Julio (la principal): si alli existe una
-- 046, se renumera ESTA.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fleet_family (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  art VARCHAR(20) NOT NULL DEFAULT 'truck',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.fleet_family (code, name, art) VALUES
  ('GT', 'Grúa telescópica', 'crane'),
  ('BA', 'Brazo articulado', 'knuckle'),
  ('MT', 'Montacargas', 'forklift'),
  ('CF', 'Cargador frontal', 'loader'),
  ('CC', 'Camión cesta', 'bucket'),
  ('VEH', 'Vehículo', 'pickup')
ON CONFLICT (code) DO NOTHING;

COMMIT;
