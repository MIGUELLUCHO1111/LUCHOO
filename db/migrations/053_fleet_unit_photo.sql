-- ============================================================
-- 053_fleet_unit_photo.sql
-- Foto propia de cada unidad en su ficha (pedido de Lguerra, 05/10/2026):
-- se carga desde el encabezado de la ficha y queda lista al abrirla. Si la
-- unidad no tiene foto propia se sigue mostrando la del modelo del catalogo.
-- Archivos en backend/uploads/fleet/units/<unit_id>/ (no versionados).
-- OJO al integrar con la rama de Julio (la principal): si alli ya existe una
-- migracion 053, se renumera esta, nunca la suya.
-- ============================================================

ALTER TABLE public.fleet_unit_profile
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN public.fleet_unit_profile.photo_url IS 'Foto propia de la unidad (/fleet/units/file/<unit_id>/<archivo>)';
