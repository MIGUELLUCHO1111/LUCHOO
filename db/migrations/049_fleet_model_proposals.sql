-- ============================================================
-- 049_fleet_model_proposals.sql
-- Modelos propuestos por los encargados (respuestas de Julio, 30/09/2026):
-- un encargado propone un modelo y queda PENDIENTE; mientras tanto sus
-- unidades pueden usarlo, pero no aparece en el catalogo para los demas.
-- Un admin lo aprueba (ACTIVO), o lo rechaza / fusiona con uno existente
-- (RECHAZADO + merged_into_id), para evitar duplicados tipo "Grove RT760E"
-- vs "GROVE RT-760E". Mismo patron PENDIENTE/ACTIVO que los suscriptores
-- de Telegram (042).
-- OJO al integrar con la rama de Julio (la principal): si alli existe una
-- 049, se renumera ESTA.
-- ============================================================

BEGIN;

ALTER TABLE public.fleet_model
  ADD COLUMN IF NOT EXISTS status VARCHAR(12) NOT NULL DEFAULT 'ACTIVO',
  ADD COLUMN IF NOT EXISTS proposed_by_user_id BIGINT REFERENCES public."user"(id),
  ADD COLUMN IF NOT EXISTS proposed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note VARCHAR(250),
  ADD COLUMN IF NOT EXISTS merged_into_id BIGINT REFERENCES public.fleet_model(id);

ALTER TABLE public.fleet_model DROP CONSTRAINT IF EXISTS fleet_model_status_check;
ALTER TABLE public.fleet_model ADD CONSTRAINT fleet_model_status_check CHECK (status IN ('PENDIENTE', 'ACTIVO', 'RECHAZADO'));

-- El nombre solo debe ser unico entre los modelos vigentes: uno rechazado o
-- archivado no impide volver a proponer (o crear) ese nombre.
DROP INDEX IF EXISTS public.uq_fleet_model_name;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fleet_model_name ON public.fleet_model (brand_id, LOWER(name))
  WHERE archived_at IS NULL AND status <> 'RECHAZADO';

COMMIT;
