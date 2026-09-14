-- ============================================================
-- 024_tracker_location_alias_coords.sql
-- Algunas direcciones del proveedor son identicas en texto para dos o mas
-- lugares reales distintos (ej. "La Coromoto, San Francisco..." cubre tanto
-- "Ciudad del Sol, Calle 179" como "Taller Full Petro, Calle 22"). Para esos
-- casos, el alias tambien puede acotarse a un rango de coordenadas GPS; si
-- estas columnas quedan en NULL, el alias sigue aplicando solo por texto
-- como antes. Esto obliga a soltar la restriccion de match_text unico, ya
-- que ahora puede repetirse el mismo texto con distintas coordenadas.
-- ============================================================

BEGIN;

ALTER TABLE public.tracker_location_alias
  ADD COLUMN IF NOT EXISTS lat_min NUMERIC,
  ADD COLUMN IF NOT EXISTS lat_max NUMERIC,
  ADD COLUMN IF NOT EXISTS lng_min NUMERIC,
  ADD COLUMN IF NOT EXISTS lng_max NUMERIC;

ALTER TABLE public.tracker_location_alias
  DROP CONSTRAINT IF EXISTS tracker_location_alias_match_text_key;

COMMIT;
