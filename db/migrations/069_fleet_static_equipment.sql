-- Equipos estaticos (pedido de Lguerra, 08/10/2026): vacuum, maquinas de
-- soldar y compresores salen de la Flota Pesada a su propia categoria
-- ESTATICO. No llevan placa: lo que hoy esta en fleet_unit.plate es el
-- identificador con el que los reconoce el GPS y NO se borra (si se borrara,
-- la sincronizacion los volveria a registrar como unidades nuevas); la app
-- simplemente no lo muestra como placa ni les pide documentos de vehiculo.
BEGIN;

ALTER TABLE public.fleet_unit DROP CONSTRAINT IF EXISTS tracker_unit_fleet_type_check;
ALTER TABLE public.fleet_unit DROP CONSTRAINT IF EXISTS fleet_unit_fleet_type_check;
ALTER TABLE public.fleet_unit
  ADD CONSTRAINT fleet_unit_fleet_type_check CHECK (fleet_type IS NULL OR fleet_type IN ('LIVIANA', 'PESADA', 'ESTATICO'));

-- Plan preventivo de Mantenimiento: tambien puede filtrar por equipos estaticos.
ALTER TABLE public.mnt_plan DROP CONSTRAINT IF EXISTS ck_mnt_plan_fleet;
ALTER TABLE public.mnt_plan
  ADD CONSTRAINT ck_mnt_plan_fleet CHECK (fleet_type IS NULL OR fleet_type IN ('LIVIANA', 'PESADA', 'ESTATICO'));

-- Las 7 unidades de hoy (compresores CPS, maquinas de soldar MDS, vacuum VA).
WITH movidas AS (
  UPDATE public.fleet_unit SET fleet_type = 'ESTATICO'
  WHERE deleted_at IS NULL AND code IN ('FP-CPS.01', 'FP-CPS.02', 'FP-MDS.01', 'FP-MDS.02', 'FP-MDS.03', 'FP-VA.01', 'FP-VA.02')
    AND fleet_type IS DISTINCT FROM 'ESTATICO'
  RETURNING id, code
)
INSERT INTO public.fleet_unit_event (unit_id, event_type, title, detail, created_by)
SELECT id, 'EDICION', 'Pasa a Equipos Estáticos', 'Antes: Flota Pesada. Vacuum, máquinas de soldar y compresores no llevan placa.', 'Sistema'
FROM movidas;

COMMIT;
