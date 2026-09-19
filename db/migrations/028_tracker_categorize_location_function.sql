-- ============================================================
-- 028_tracker_categorize_location_function.sql
-- Reemplaza la clasificacion de ubicacion (BASE/CAMPO/OFICINA/OTRAS), que
-- hasta ahora dependia de tracker_location_category (match EXACTO contra
-- el texto crudo que devuelve el proveedor). Esa tabla se sembro una sola
-- vez (migracion 009, ~45 direcciones tomadas del Excel manual del
-- 07/09/2026); el proveedor varia ligeramente el texto entre lecturas, asi
-- que casi ninguna direccion nueva volvia a calzar, y snapshot.js la
-- insertaba en el momento como 'OTRAS' -- quedando asi para siempre (nunca
-- hay un UPDATE que la corrija). Resultado: casi todo terminaba en OTRAS
-- (confirmado por Lguerra, 15/09/2026, comparando contra el reporte
-- interno real, donde cada direccion SI pertenece a un grupo especifico).
--
-- La solucion reutiliza el sistema de alias/simplificacion de ubicacion
-- (tracker_location_alias + tracker_simplify_location, migraciones 023-025)
-- que ya normaliza el texto crudo a un nombre limpio y estable ("BASE
-- FULLPETRO - CAMPO BOSCAN", "CAMPO BOSCAN", "OFICINA ADMINISTRATIVA FULL
-- PETRO", "TALLER FULL PETRO - ..."), y clasifica por el INICIO de ese
-- nombre ya normalizado -- mismo criterio que usa el Excel manual real
-- (columna Listas: BASE/CAMPO/OFICINA/OTRAS).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.tracker_categorize_location(location_text TEXT)
RETURNS VARCHAR(20)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN location_text IS NULL THEN 'OTRAS'
    WHEN location_text ILIKE 'BASE%' THEN 'BASE'
    WHEN location_text ILIKE 'CAMPO%' THEN 'CAMPO'
    WHEN location_text ILIKE 'OFICINA%' OR location_text ILIKE 'TALLER%' THEN 'OFICINA'
    ELSE 'OTRAS'
  END;
$$;

COMMIT;
