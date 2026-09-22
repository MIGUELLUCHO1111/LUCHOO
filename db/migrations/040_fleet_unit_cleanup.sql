-- ============================================================
-- 040_fleet_unit_cleanup.sql
-- Paso destructivo de la unificacion Vehiculo/Unidad/Equipo -> fleet_unit
-- (Julio, 21/09/2026). Solo se aplica DESPUES de verificar a mano que
-- 039_fleet_unit_unify.sql dejo fleet_unit_id correctamente rellenado en
-- las 4 tablas (verificado: 0 filas NULL, joins de muestra correctos,
-- 87 filas totales en fleet_unit como se esperaba).
--
-- Truco para minimizar el resto del cambio: fleet_unit_id se renombra de
-- vuelta a vehicle_id (fuel_carga/fuel_pesada) y a equipment_id
-- (project_equipment_assignment/hours_daily_entry) -- asi casi ninguna
-- query existente en queries.yaml necesita tocar el nombre de columna,
-- solo la tabla a la que hace JOIN (vehicle/equipment -> fleet_unit).
-- ============================================================

BEGIN;

-- ---------- 1. fleet_unit_id pasa a NOT NULL ----------
ALTER TABLE public.fuel_carga ALTER COLUMN fleet_unit_id SET NOT NULL;
ALTER TABLE public.fuel_pesada ALTER COLUMN fleet_unit_id SET NOT NULL;
ALTER TABLE public.project_equipment_assignment ALTER COLUMN fleet_unit_id SET NOT NULL;
ALTER TABLE public.hours_daily_entry ALTER COLUMN fleet_unit_id SET NOT NULL;

-- ---------- 2. Eliminar columnas y FKs viejas ----------
ALTER TABLE public.fuel_carga DROP CONSTRAINT IF EXISTS fuel_carga_vehicle_id_fkey;
ALTER TABLE public.fuel_carga DROP COLUMN IF EXISTS vehicle_id;

ALTER TABLE public.fuel_pesada DROP CONSTRAINT IF EXISTS fuel_pesada_vehicle_id_fkey;
ALTER TABLE public.fuel_pesada DROP COLUMN IF EXISTS vehicle_id;

ALTER TABLE public.project_equipment_assignment DROP CONSTRAINT IF EXISTS project_equipment_assignment_equipment_id_fkey;
ALTER TABLE public.project_equipment_assignment DROP COLUMN IF EXISTS equipment_id;

ALTER TABLE public.hours_daily_entry DROP CONSTRAINT IF EXISTS hours_daily_entry_equipment_id_fkey;
ALTER TABLE public.hours_daily_entry DROP COLUMN IF EXISTS equipment_id;

-- ---------- 3. Renombrar fleet_unit_id de vuelta a los nombres viejos ----------
ALTER TABLE public.fuel_carga RENAME COLUMN fleet_unit_id TO vehicle_id;
ALTER TABLE public.fuel_pesada RENAME COLUMN fleet_unit_id TO vehicle_id;
ALTER TABLE public.project_equipment_assignment RENAME COLUMN fleet_unit_id TO equipment_id;
ALTER TABLE public.hours_daily_entry RENAME COLUMN fleet_unit_id TO equipment_id;

-- ---------- 4. Eliminar las tablas viejas, ya migradas ----------
DROP TABLE public.vehicle;
DROP TABLE public.equipment;

COMMIT;
