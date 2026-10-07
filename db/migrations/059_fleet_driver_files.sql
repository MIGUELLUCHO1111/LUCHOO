-- ============================================================
-- 059_fleet_driver_files.sql
-- Conductores (pedido de Lguerra, 07/10/2026): cargar la imagen (o PDF) de
-- la licencia de conducir y de la carta medica, con el vencimiento de la
-- carta medica (la licencia ya tenia license_expires_at, 058).
-- Archivos en backend/uploads/fleet/drivers/<driver_id>/ (no versionados).
-- OJO al integrar con la rama de Julio (la principal): si alli ya existe una
-- migracion 059, se renumera esta, nunca la suya.
-- ============================================================

BEGIN;

ALTER TABLE public.fleet_driver
  ADD COLUMN IF NOT EXISTS license_file_url TEXT,
  ADD COLUMN IF NOT EXISTS license_file_mime VARCHAR(60),
  ADD COLUMN IF NOT EXISTS medical_file_url TEXT,
  ADD COLUMN IF NOT EXISTS medical_file_mime VARCHAR(60),
  ADD COLUMN IF NOT EXISTS medical_expires_at DATE;

COMMIT;
