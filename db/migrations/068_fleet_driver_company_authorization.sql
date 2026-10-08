-- Autorizacion de manejo por la empresa (pedido de Lguerra, 08/10/2026):
-- documento firmado por el Presidente de la empresa que autoriza a ese
-- conductor a manejar los vehiculos de la empresa. Se exige a todos los
-- conductores. Foto o PDF hasta 10 MB (solo queda el mas reciente), fecha de
-- firma y, si la autorizacion tiene vigencia, fecha de vencimiento.
-- (Numero 068: Julio uso hasta 067 en su rama.)
ALTER TABLE public.fleet_driver
  ADD COLUMN IF NOT EXISTS auth_file_url TEXT, ADD COLUMN IF NOT EXISTS auth_file_mime VARCHAR(60),
  ADD COLUMN IF NOT EXISTS auth_signed_at DATE,
  ADD COLUMN IF NOT EXISTS auth_expires_at DATE;
