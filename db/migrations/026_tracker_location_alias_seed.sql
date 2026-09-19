-- ============================================================
-- 026_tracker_location_alias_seed.sql
-- Deja en el codigo (no solo en la base de datos en vivo) los alias de
-- ubicacion que gerencia fue confirmando el 14/09/2026, para que sigan
-- ahi si la base de datos se reconstruye. Solo siembra si la tabla esta
-- vacia, para no duplicar si esto corre en un ambiente que ya los tiene
-- (por ejemplo, el mismo servidor donde se fueron cargando a mano).
-- ============================================================

BEGIN;

INSERT INTO public.tracker_location_alias (match_text, alias, lat_min, lat_max, lng_min, lng_max)
SELECT * FROM (VALUES
  ('Kilómetro 40, Parroquia Andrés Bello, Municipio La Cañada, Zulia, Venezuela', 'BASE FULLPETRO - CAMPO BOSCAN', NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC),
  ('R-91, Parroquia Andrés Bello, Municipio La Cañada, Zulia, Venezuela', 'CAMPO BOSCAN CONVECA BASE', NULL, NULL, NULL, NULL),
  ('Parroquia Domitila Flores, Municipio San Francisco, Zulia, 4004, Venezuela', 'AV 48 CARRETERA VIA LA CAÑADA - CERCA DE ENDEFCA', NULL, NULL, NULL, NULL),
  ('Avenida Circunvalación 4, Parroquia Francisco Eugenio Bustamante, Municipio Maracaibo, Zulia, 4003, Venezuela', 'PARQUE INDUSTRIAL CONVECA', NULL, NULL, NULL, NULL),
  ('Distribuidor CAVIM, Palma Sola, Morón, Parroquia Morón, Municipio Mora, Carabobo, 2051, Venezuela', 'MORON, AV CARABOBO TEXXSA CONTRUCCIONES', NULL, NULL, NULL, NULL),
  ('Via Morón-El Palito, Refinería El Palito, Taborda, Parroquia Juan José Flores, Municipio Puerto Cabello, Carabobo, 2050, Venezuela', 'REFINERIA EL PALITO - PUERTO CABELLO', NULL, NULL, NULL, NULL),
  ('R-90, Santo Domingo, Parroquia Andrés Bello, Municipio La Cañada, Zulia, Venezuela', 'BOMBA DE INYECCION G5', NULL, NULL, NULL, NULL),
  ('Parroquia El Bajo, Municipio San Francisco, Zulia, Venezuela', 'EL BAJO - SAN FRANCISCO', NULL, NULL, NULL, NULL),
  ('Parroquia Andrés Bello, Municipio La Cañada, Zulia, Venezuela', 'CAMPO BOSCAN', NULL, NULL, NULL, NULL),
  ('Clínica PDVSA lago medio, Avenida 5, San Francisco, Parroquia San Francisco, Municipio San Francisco, Zulia, 4004, Venezuela', 'LAGO MEDIO PDVSA', NULL, NULL, NULL, NULL),
  ('Calle 71, Parroquia Chiquinquirá, Municipio Maracaibo, Zulia, 4002, Venezuela', 'OFICINA ADMINISTRATIVA FULL PETRO', NULL, NULL, NULL, NULL),
  ('Parroquia Chiquinquirá, Municipio Maracaibo, Zulia, 4002, Venezuela', 'OFICINA ADMINISTRATIVA FULL PETRO', NULL, NULL, NULL, NULL),
  ('Lago Mar, Avenida 3G, Parroquia Olegario Villalobos, Municipio Maracaibo, Zulia, 4002, Venezuela', 'CERCA DE TOYOCCIDENTE - LAGO MAR AV 3G', NULL, NULL, NULL, NULL),
  ('Terminal de Pasajeros de Morón, Avenida Principal de Palma Sola, Palma Sola, Morón, Parroquia Morón, Municipio Mora, Carabobo, 2051, Venezuela', 'MORON, AV CARABOBO TEXXSA CONTRUCCIONES', NULL, NULL, NULL, NULL),
  ('La Coromoto, San Francisco, Parroquia San Francisco, Municipio San Francisco, Zulia, 4004, Venezuela', 'CIUDAD DEL SOL - SAN FRANCISCO, CALLE 179', 10.5490, 10.5505, -71.6420, -71.6408),
  ('La Coromoto, San Francisco, Parroquia San Francisco, Municipio San Francisco, Zulia, 4004, Venezuela', 'TALLER FULL PETRO - SAN FRANCISCO, CALLE 22', 10.5520, 10.5545, -71.6395, -71.6325),
  ('Parroquia Luis Hurtado Higuera, Municipio Maracaibo, Zulia, 4004, Venezuela', 'AVENIDA 61. ENTRE MUSEPECA Y RESIDENCIAS LAS PIEDRAS', NULL, NULL, NULL, NULL)
) AS seed(match_text, alias, lat_min, lat_max, lng_min, lng_max)
WHERE NOT EXISTS (SELECT 1 FROM public.tracker_location_alias);

COMMIT;
