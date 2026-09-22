-- ============================================================
-- 039_fleet_unit_unify.sql
-- Unifica Vehiculo (Combustible), Unidad (Tracker) y Equipo (Horas) en
-- una sola tabla (Julio, 21/09/2026) -- eran el mismo objeto fisico
-- registrado hasta 3 veces con puntuacion distinta (ej. equipment.code
-- 'FP-GT-02' vs tracker_unit.code 'FP-GT.02', la misma grua de
-- Izamiento). tracker_unit se convierte en la base (81 filas, la unica
-- alimentada en vivo por el GPS) porque renombrar una tabla no rompe las
-- FK que ya apuntan a ella (tracker_snapshot.unit_id, tracker_alert.
-- unit_id, tracker_snapshot_summary.unit_id, tracker_geofence_state.
-- unit_id siguen intactas).
--
-- PASO ADITIVO A PROPOSITO: esta migracion NO borra vehicle/equipment ni
-- las columnas viejas -- solo agrega fleet_unit_id en paralelo y lo
-- rellena. El borrado real (040_fleet_unit_cleanup.sql) se aplica aparte,
-- despues de verificar a mano que este paso quedo bien (mismo patron que
-- ya se uso en esta sesion para separar cambios reversibles de los que
-- no lo son).
-- ============================================================

BEGIN;

ALTER TABLE public.tracker_unit RENAME TO fleet_unit;

ALTER TABLE public.fleet_unit
  ADD COLUMN IF NOT EXISTS name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS tank_capacity_liters NUMERIC(8,2);

ALTER TABLE public.fuel_carga ADD COLUMN IF NOT EXISTS fleet_unit_id BIGINT REFERENCES public.fleet_unit(id);
ALTER TABLE public.fuel_pesada ADD COLUMN IF NOT EXISTS fleet_unit_id BIGINT REFERENCES public.fleet_unit(id);
ALTER TABLE public.project_equipment_assignment ADD COLUMN IF NOT EXISTS fleet_unit_id BIGINT REFERENCES public.fleet_unit(id);
ALTER TABLE public.hours_daily_entry ADD COLUMN IF NOT EXISTS fleet_unit_id BIGINT REFERENCES public.fleet_unit(id);

-- ---------- vehicle -> fleet_unit ----------
-- Match por codigo normalizado (sin separadores, sin distinguir
-- mayus/minus) contra fleet_unit. Si matchea, solo rellena los campos
-- que fleet_unit tenia vacios (no pisa datos de Tracker, que es la
-- fuente mas viva). Si no matchea (datos de prueba viejos, sin
-- contraparte real en Tracker), inserta una fila nueva.
CREATE TEMP TABLE _vehicle_to_fleet_unit (vehicle_id BIGINT PRIMARY KEY, fleet_unit_id BIGINT NOT NULL);

DO $$
DECLARE
  v RECORD;
  matched_id BIGINT;
  new_id BIGINT;
BEGIN
  FOR v IN SELECT * FROM public.vehicle LOOP
    SELECT id INTO matched_id
    FROM public.fleet_unit
    WHERE UPPER(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')) = UPPER(regexp_replace(v.code, '[^A-Za-z0-9]', '', 'g'))
    LIMIT 1;

    IF matched_id IS NOT NULL THEN
      UPDATE public.fleet_unit
      SET name = COALESCE(name, v.name),
          tank_capacity_liters = COALESCE(tank_capacity_liters, v.tank_capacity_liters),
          fleet_type = COALESCE(fleet_type, UPPER(v.fleet_type))
      WHERE id = matched_id;
      INSERT INTO _vehicle_to_fleet_unit VALUES (v.id, matched_id);
    ELSE
      INSERT INTO public.fleet_unit (code, name, plate, tank_capacity_liters, fleet_type, is_active, created_at, deleted_at)
      VALUES (v.code, v.name, v.plate, v.tank_capacity_liters, UPPER(v.fleet_type), v.is_active, v.created_at, v.deleted_at)
      RETURNING id INTO new_id;
      INSERT INTO _vehicle_to_fleet_unit VALUES (v.id, new_id);
    END IF;
  END LOOP;
END $$;

UPDATE public.fuel_carga fc SET fleet_unit_id = m.fleet_unit_id
  FROM _vehicle_to_fleet_unit m WHERE fc.vehicle_id = m.vehicle_id;
UPDATE public.fuel_pesada fp SET fleet_unit_id = m.fleet_unit_id
  FROM _vehicle_to_fleet_unit m WHERE fp.vehicle_id = m.vehicle_id;

-- ---------- equipment -> fleet_unit ----------
-- Mismo criterio. Los equipos no traen fleet_type propio (concepto que
-- no existia en Horas) -- se asume 'PESADA' para los que no matchean con
-- Tracker (Izamiento es maquinaria pesada), marcado para que Julio lo
-- confirme/corrija despues desde Tracker -> Gestion de Unidades.
CREATE TEMP TABLE _equipment_to_fleet_unit (equipment_id BIGINT PRIMARY KEY, fleet_unit_id BIGINT NOT NULL);

DO $$
DECLARE
  e RECORD;
  matched_id BIGINT;
  new_id BIGINT;
BEGIN
  FOR e IN SELECT * FROM public.equipment LOOP
    SELECT id INTO matched_id
    FROM public.fleet_unit
    WHERE UPPER(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')) = UPPER(regexp_replace(e.code, '[^A-Za-z0-9]', '', 'g'))
    LIMIT 1;

    IF matched_id IS NOT NULL THEN
      UPDATE public.fleet_unit
      SET name = COALESCE(name, e.name),
          fleet_type = COALESCE(fleet_type, 'PESADA')
      WHERE id = matched_id;
      INSERT INTO _equipment_to_fleet_unit VALUES (e.id, matched_id);
    ELSE
      INSERT INTO public.fleet_unit (code, name, fleet_type, is_active, created_at, deleted_at)
      VALUES (e.code, e.name, 'PESADA', e.is_active, e.created_at, e.deleted_at)
      RETURNING id INTO new_id;
      INSERT INTO _equipment_to_fleet_unit VALUES (e.id, new_id);
    END IF;
  END LOOP;
END $$;

UPDATE public.project_equipment_assignment pea SET fleet_unit_id = m.fleet_unit_id
  FROM _equipment_to_fleet_unit m WHERE pea.equipment_id = m.equipment_id;
UPDATE public.hours_daily_entry hde SET fleet_unit_id = m.fleet_unit_id
  FROM _equipment_to_fleet_unit m WHERE hde.equipment_id = m.equipment_id;

COMMIT;
