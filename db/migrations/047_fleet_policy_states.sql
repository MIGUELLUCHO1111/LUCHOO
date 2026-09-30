-- ============================================================
-- 047_fleet_policy_states.sql
-- Respuestas de Julio (30/09/2026) sobre la Ficha de Vehiculos:
--   * Condicion operativa con los estados de la politica FP-MTTO-PO-01 §4.1:
--     Operativo en contrato, Standby / back-up (BG), Disponible y Fuera de
--     servicio (con causa). La cambiara Mantenimiento al abrir/cerrar una OT;
--     mientras ese modulo no exista, solo un admin la cambia a mano.
--   * Codigo corto de la politica (ej. GT-02) guardado aparte del codigo
--     oficial del sistema (FP-GT.02, el del GPS).
-- OJO al integrar con la rama de Julio (la principal): si alli existe una
-- 047, se renumera ESTA.
-- ============================================================

BEGIN;

ALTER TABLE public.fleet_unit_profile DROP CONSTRAINT IF EXISTS fleet_unit_profile_operational_status_check;

-- Estados viejos -> estados de la politica ("En taller" pasa a Fuera de servicio con esa causa).
UPDATE public.fleet_unit_profile SET operational_status = 'DISPONIBLE' WHERE operational_status = 'OPERATIVO';
ALTER TABLE public.fleet_unit_profile ADD COLUMN IF NOT EXISTS status_cause VARCHAR(150);
UPDATE public.fleet_unit_profile SET operational_status = 'FUERA_DE_SERVICIO', status_cause = COALESCE(status_cause, 'En taller') WHERE operational_status = 'EN_TALLER';

ALTER TABLE public.fleet_unit_profile ALTER COLUMN operational_status SET DEFAULT 'DISPONIBLE';
ALTER TABLE public.fleet_unit_profile ADD CONSTRAINT fleet_unit_profile_operational_status_check
  CHECK (operational_status IN ('OPERATIVO_CONTRATO', 'STANDBY', 'DISPONIBLE', 'FUERA_DE_SERVICIO'));

ALTER TABLE public.fleet_unit_profile ADD COLUMN IF NOT EXISTS short_code VARCHAR(20);

COMMIT;
