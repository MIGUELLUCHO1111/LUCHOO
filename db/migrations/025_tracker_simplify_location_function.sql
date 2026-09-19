-- ============================================================
-- 025_tracker_simplify_location_function.sql
-- Cuando una direccion del proveedor no tiene un alias manual, esta funcion
-- la simplifica automaticamente a algo puntual: toma todo lo que aparece
-- ANTES de la Parroquia (eso ya cubre avenidas cruzadas, edificios,
-- residencias, semaforos, lo que el proveedor haya puesto ahi) y lo une con
-- "CERCA DE <Parroquia>". Descarta fragmentos que sean solo numeros/codigos
-- (ej. "86-78") y evita repetir el nombre si ya aparecia antes. Si no hay
-- Parroquia, usa Municipio; si no hay ninguna referencia clara, deja el
-- texto tal cual (solo en mayusculas).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.tracker_simplify_location(raw_text TEXT)
RETURNS TEXT AS $$
DECLARE
  parts TEXT[];
  ref_idx INT := NULL;
  ref_name TEXT;
  pre_parts TEXT[] := ARRAY[]::TEXT[];
  i INT;
  main_part TEXT;
BEGIN
  IF raw_text IS NULL THEN
    RETURN NULL;
  END IF;

  parts := regexp_split_to_array(raw_text, '\s*,\s*');

  FOR i IN 1..array_length(parts, 1) LOOP
    IF parts[i] ILIKE 'Parroquia %' THEN
      ref_idx := i;
      EXIT;
    END IF;
  END LOOP;

  IF ref_idx IS NULL THEN
    FOR i IN 1..array_length(parts, 1) LOOP
      IF parts[i] ILIKE 'Municipio %' THEN
        ref_idx := i;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF ref_idx IS NULL OR ref_idx <= 1 THEN
    RETURN UPPER(raw_text);
  END IF;

  ref_name := regexp_replace(parts[ref_idx], '^(Parroquia|Municipio)\s+', '', 'i');

  FOR i IN 1..(ref_idx - 1) LOOP
    IF parts[i] !~ '^[0-9\-/]+$' THEN
      pre_parts := array_append(pre_parts, parts[i]);
    END IF;
  END LOOP;

  IF array_length(pre_parts, 1) > 0 AND LOWER(pre_parts[array_length(pre_parts, 1)]) = LOWER(ref_name) THEN
    pre_parts := pre_parts[1:array_length(pre_parts, 1) - 1];
  END IF;

  IF pre_parts IS NULL OR array_length(pre_parts, 1) = 0 THEN
    RETURN UPPER(ref_name);
  END IF;

  main_part := array_to_string(pre_parts, ', ');
  RETURN UPPER(main_part || ', CERCA DE ' || ref_name);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMIT;
