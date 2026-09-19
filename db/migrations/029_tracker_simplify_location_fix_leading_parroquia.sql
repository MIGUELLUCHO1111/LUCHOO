-- ============================================================
-- 029_tracker_simplify_location_fix_leading_parroquia.sql
-- tracker_simplify_location (migracion 025) se rendia y devolvia el texto
-- crudo COMPLETO sin tocar cuando la Parroquia/Municipio era el primer
-- segmento de la direccion (nada antes que sirviera de referencia puntual)
-- -- eso dejaba visible la basura que trae el proveedor despues (codigo
-- postal, y el "~Zulia"/"~Carabobo" que le pega al final del pais, ej.
-- "...Venezuela~Zulia"). Ahora en ese caso arma "CERCA DE <Parroquia>" en
-- vez de reenviar el texto crudo -- que de todas formas es lo unico
-- disponible cuando no hay nada antes de la Parroquia.
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

  IF ref_idx IS NULL THEN
    RETURN UPPER(raw_text);
  END IF;

  ref_name := regexp_replace(parts[ref_idx], '^(Parroquia|Municipio)\s+', '', 'i');

  -- La Parroquia/Municipio es el primer dato: no hay nada antes que sirva
  -- de referencia puntual, asi que no se arma "X, CERCA DE Y" -- solo
  -- queda "CERCA DE <Parroquia>", descartando lo que venga despues.
  IF ref_idx = 1 THEN
    RETURN UPPER('CERCA DE ' || ref_name);
  END IF;

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
