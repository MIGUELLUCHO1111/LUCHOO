-- ============================================================
-- 052_fleet_remove_standby.sql
-- Se quita la condicion operativa "Standby / back-up" (pedido de Lguerra,
-- 05/10/2026). Quedan: Operativo en contrato, Disponible y Fuera de
-- servicio. Las unidades que estaban en Standby pasan a Disponible (el
-- estado por defecto) y queda anotado en su historial.
-- OJO al integrar con la rama de Julio (la principal): si alli ya existe una
-- migracion 052, se renumera esta, nunca la suya.
-- ============================================================

INSERT INTO public.fleet_unit_event (unit_id, event_type, title, detail, created_by)
SELECT unit_id, 'ESTADO', 'Condición: Disponible', 'Antes: Standby / back-up (se quitó esa opción)', 'sistema'
FROM public.fleet_unit_profile
WHERE operational_status = 'STANDBY';

UPDATE public.fleet_unit_profile
SET operational_status = 'DISPONIBLE', updated_at = NOW()
WHERE operational_status = 'STANDBY';

ALTER TABLE public.fleet_unit_profile DROP CONSTRAINT IF EXISTS fleet_unit_profile_operational_status_check;
ALTER TABLE public.fleet_unit_profile ADD CONSTRAINT fleet_unit_profile_operational_status_check
  CHECK (operational_status IN ('OPERATIVO_CONTRATO', 'DISPONIBLE', 'FUERA_DE_SERVICIO'));
