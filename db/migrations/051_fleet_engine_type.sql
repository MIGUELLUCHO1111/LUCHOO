-- ============================================================
-- 051_fleet_engine_type.sql
-- Tipo de motor en el "ADN del vehiculo" de la ficha (pedido de Lguerra,
-- 05/10/2026), junto al color que ya existia (043). Texto libre con
-- sugerencias en la app (4 cilindros, V6, turbo diesel...).
-- OJO al integrar con la rama de Julio (la principal): si alli ya existe una
-- migracion 051, se renumera esta, nunca la suya.
-- ============================================================

ALTER TABLE public.fleet_unit_profile
  ADD COLUMN IF NOT EXISTS engine_type VARCHAR(60);

COMMENT ON COLUMN public.fleet_unit_profile.engine_type IS 'Tipo de motor (4 cilindros, V6, turbo diesel...)';
