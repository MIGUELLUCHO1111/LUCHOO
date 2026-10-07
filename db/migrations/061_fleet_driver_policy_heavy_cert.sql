-- Documentos del conductor (pedido de Lguerra, 07/10/2026):
-- * Politica de conduccion de vehiculo corporativo (firmada; fecha de firma).
-- * Certificado de conduccion de flota pesada (con vencimiento; se exige a
--   los conductores de Flota Pesada).
-- Foto o PDF hasta 10 MB, se queda solo el mas reciente de cada uno.
ALTER TABLE public.fleet_driver
  ADD COLUMN IF NOT EXISTS policy_file_url TEXT, ADD COLUMN IF NOT EXISTS policy_file_mime VARCHAR(60),
  ADD COLUMN IF NOT EXISTS policy_signed_at DATE,
  ADD COLUMN IF NOT EXISTS heavy_cert_file_url TEXT, ADD COLUMN IF NOT EXISTS heavy_cert_file_mime VARCHAR(60),
  ADD COLUMN IF NOT EXISTS heavy_cert_expires_at DATE;
