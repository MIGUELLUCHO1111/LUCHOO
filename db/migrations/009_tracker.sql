-- ============================================================
-- 009_tracker.sql
-- Seccion Tracker GPS: motor de datos (Fase 1).
-- Tablas: tracker_unit (tabla interna placa-unidad-conductor),
-- tracker_location_category (catalogo de ubicaciones -> categoria,
-- migrado del Excel de reportes manuales) y tracker_snapshot
-- (historial de lecturas de la API GetCurrentUnitsStatus).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tracker_unit (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  plate VARCHAR(20),
  driver_name VARCHAR(150),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tracker_unit_plate ON public.tracker_unit(plate);

CREATE TABLE IF NOT EXISTS public.tracker_location_category (
  id BIGSERIAL PRIMARY KEY,
  location_text VARCHAR(250) UNIQUE NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('BASE','CAMPO','OFICINA','OTRAS')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tracker_snapshot (
  id BIGSERIAL PRIMARY KEY,
  unit_id BIGINT REFERENCES public.tracker_unit(id),
  plate VARCHAR(20),
  gps_name VARCHAR(150),
  location_text VARCHAR(300),
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  speed NUMERIC(6,2),
  ignition BOOLEAN,
  status VARCHAR(20) NOT NULL,
  is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  last_report_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_response JSONB
);
CREATE INDEX IF NOT EXISTS idx_tracker_snapshot_unit_fetched ON public.tracker_snapshot(unit_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_snapshot_plate_fetched ON public.tracker_snapshot(plate, fetched_at DESC);

-- ---------- Datos reales: tabla interna unidad-placa-conductor ----------
-- Migrados desde el reporte manual (Excel) vigente al 07/09/2026.
INSERT INTO public.tracker_unit (code, plate, driver_name) VALUES
  ('FP-CBA-01', 'A41EU5P', 'ROTATIVO'),
  ('FP-CBA-04', 'A65CW5K', 'ROTATIVO'),
  ('FP-CBA-05', 'A68EP9P', 'ROTATIVO'),
  ('FP-CBA-06', NULL, 'ROTATIVO'),
  ('FP-CC.01', 'A58BF3R', 'ROTATIVO'),
  ('FP-CC.02', NULL, 'ROTATIVO'),
  ('FP-CF-05', 'KOMATSU', 'ROTATIVO'),
  ('FP-CF-06', 'FPCG03', 'ROTATIVO'),
  ('FP-CH.01', NULL, 'ROTATIVO'),
  ('FP-CPS.01', NULL, 'ROTATIVO'),
  ('FP-CPS.02', NULL, 'ROTATIVO'),
  ('FP-CSL.01', 'A28EE2P', 'ROTATIVO'),
  ('FP-CSL.02', 'A48BN1F', 'ROTATIVO'),
  ('FP-CSL.03', 'A26DB5J', 'ROTATIVO'),
  ('FP-CSL.04', 'A72AY8L', 'ROTATIVO'),
  ('FP-CSL.05', NULL, 'ROTATIVO'),
  ('FP-GT.02', 'A31EW6P', 'ROTATIVO'),
  ('FP-GT.04', NULL, 'ROTATIVO'),
  ('FP-GT.05', 'A42CZ7K', 'ROTATIVO'),
  ('FP-GT.06', 'A00A68W', 'ROTATIVO'),
  ('FP-GT.07', 'A00A66W', 'ROTATIVO'),
  ('FP-GT.08', 'A01A13C', 'ROTATIVO'),
  ('FPMDS01', NULL, 'ROTATIVO'),
  ('FPMDS02', NULL, 'ROTATIVO'),
  ('FPMDS03', NULL, 'ROTATIVO'),
  ('FP-MT.01', 'GQ003', 'ROTATIVO'),
  ('FP-MT.02', 'FPMT02', 'ROTATIVO'),
  ('FP-MT.03', 'FPMT03', 'ROTATIVO'),
  ('FP-MT.04', 'FPMT04', 'ROTATIVO'),
  ('FP-MT.05', 'FPMT05', 'ROTATIVO'),
  ('FP-MT.06', 'FPMT06', 'ROTATIVO'),
  ('FP-MT.07', 'FPMT07', 'ROTATIVO'),
  ('FPRE01', NULL, 'ROTATIVO'),
  ('FP-TP.04-01', 'AB994PI', 'CONDUCTORES VAN'),
  ('FP-TP.04-02', 'AG629RK', 'CONDUCTORES VAN'),
  ('FP-TP.04-03', 'AB278RI', 'CONDUCTORES VAN'),
  ('FP-TP.04-04', 'AO069AY', 'CONDUCTORES VAN'),
  ('FP-TP.04-05', NULL, 'CONDUCTORES VAN'),
  ('FP-TP.04-06', NULL, 'CONDUCTORES VAN'),
  ('FP-VA.01', NULL, NULL),
  ('FP-VA.02', NULL, NULL),
  ('FP-VEH.01-01', 'AH246TD', 'AMDRYS HERNANDEZ'),
  ('FP-VEH.01-02', 'AO881OB', 'CAROLINA GUTIERREZ'),
  ('FP-VEH.02-08', 'A92BB8R', 'WILFRAN ALVAREZ'),
  ('FP-VEH.02-09', 'A64AV1R', 'OPERACIONES'),
  ('FP-VEH.02-10', 'A12EJ7P', 'KENNY ARRIETA'),
  ('FP-VEH.02-11', 'A99EZ0P', 'GERARDO VILLALOBOS'),
  ('FP-VEH.02-12', 'A96AX5R', 'OPERACIONES'),
  ('FP-VEH.02-13', 'A40BD3R', 'MIGUEL MORILLO'),
  ('FP-VEH.02-14', 'A41BD9R', 'LEIWIS DIAZ'),
  ('FP-VEH.02-15', 'A77DS8M', 'CAMPO'),
  ('FP-VEH.02-16', 'A63AV6R', 'BAJO GRANDE'),
  ('FP-VEH.02-18', 'A68BD4R', 'MTTO. MECANICO'),
  ('FP-VEH.02-19', 'A45AX8R', 'TOMAS RODRIGUEZ'),
  ('FP-VEH.02-20', 'A45AX7R', 'CAMPO'),
  ('FP-VEH.02-21', 'A45AX6R', 'CAMPO'),
  ('FP-VEH.02-23', 'FPVEH23', 'JAIME MORALES'),
  ('FP-VEH.02-24', 'FPVEH24', 'JUAN BERMUDEZ'),
  ('FP-VEH.02-25', 'A33BM4F', 'PCP BOSCAN'),
  ('FP-VEH.02-26', 'A51BF7R', 'JOSE PALMA'),
  ('FP-VEH.02-27', 'A51BF8R', 'PEDRO OCANDO'),
  ('FP-VEH.02-28', 'A51BF9R', 'CONTRATO PALITO'),
  ('FP-VEH.02-29', 'A57CW9J', 'OPERACIONES'),
  ('FP-VEH.03-01', 'A57EK9P', 'ROTATIVO'),
  ('FP-VEH.03-02', 'A09EN5P', 'ROTATIVO'),
  ('FP-VEH.03-03', 'A67ET7P', 'ROTATIVO'),
  ('FP-VEH.03-04', 'A08EN8P', 'ROTATIVO'),
  ('FP-VEH.03-05', NULL, 'ROTATIVO')
ON CONFLICT (code) DO NOTHING;

-- ---------- Catalogo de ubicaciones -> categoria (migrado de la hoja 'Listas') ----------
INSERT INTO public.tracker_location_category (location_text, category) VALUES
  ('BASE FP-BOSCAN', 'BASE'),
  ('CAMPO BOSCAN', 'CAMPO'),
  ('CAMPO BOSCAN CONVECA BASE', 'CAMPO'),
  ('CAMPO BOSCAN ESTACION DE FLUJO', 'CAMPO'),
  ('ESTACION 2', 'CAMPO'),
  ('ESTACION FLUJO 10', 'CAMPO'),
  ('BAJO GRANDE', 'OTRAS'),
  ('CARRETERA VIA EL AEROPUERTO IKINAWA', 'OTRAS'),
  ('MORON, AV CARABOBO TEXXSA CONTRUCCIONES', 'OTRAS'),
  ('PARQUE INDUTRIAL CONVECA', 'OTRAS'),
  ('PDVSA PUNTA DE PALMA', 'OTRAS'),
  ('PUERTO CABELLO, REFINERIA EL PALITO', 'OTRAS'),
  ('SAN FRANCISCO AV. 68 CON CALLE 148', 'OTRAS'),
  ('SAN FRANCISCO, AVENIDA 11A INSTALME', 'OTRAS'),
  ('SAN FRANCISCO, AVENIDA 61', 'OTRAS'),
  ('SAN FRANCISCO, CALLE 179. CIUDAD DEL SOL', 'OTRAS'),
  ('URB. LA PAZ CALLE 98', 'OTRAS'),
  ('OFICINA CALLE 71 CON AV 17', 'OFICINA'),
  ('SAN FRANCISCO, CALLE 22 TALLER FP', 'OFICINA'),
  ('CALLE 96F CON AVENIDA 48', 'OTRAS'),
  ('TRONCAL 1', 'OTRAS'),
  ('CALLE 99H CON AVENIDA 75', 'OTRAS'),
  ('CALLE 96H CON AVENIDA 52', 'OTRAS'),
  ('CARRETERA LOS BUCARES, CON CALLE 99U 2', 'OTRAS'),
  ('CALLE 102', 'OTRAS'),
  ('CALLE 85 CN AVENIDA 9B', 'OTRAS'),
  ('AVENIDA 51 RESIDENCIA', 'OTRAS'),
  ('CALLE 91 CON AVENIDA 70B', 'OTRAS'),
  ('RESIDENCIAS VIVIANA', 'OTRAS'),
  ('AVENIDA BLANDIN, LOS CHAGUARAMOS CARACAS', 'OTRAS'),
  ('CALLE 82C CON AVENIDA 70B', 'OTRAS'),
  ('CIRCUNVALACION 2 CERCA DE CORPOLAB LABORATORIOS', 'OTRAS'),
  ('AVENIDA 28 LA LIMPIA CON AVENIDA 67, ENTRE CALLES 79B Y 79C', 'OTRAS'),
  ('CALLE RECREACIONAL CON VIA EL PATIO, VALENCIA', 'OTRAS'),
  ('AUTOPISTA VARIANTE NTE. CORO', 'OTRAS'),
  ('ESTACION DE FLUJO 18', 'OTRAS'),
  ('CALLE 94 CON AVENIDA 57', 'OTRAS'),
  ('CALLE 148 CERCA DE LA IGLESIA RIOS DE AGUA VIVA', 'OTRAS'),
  ('AVENIDA 2A CERCA DE RESIDENCIAS DEL LAGO', 'OTRAS'),
  ('AVENIDA LOS CORTIJOS RESIDENCIAS PREMIER', 'OTRAS'),
  ('CERCA DE LH DECORACIONES CIRCUNVALACION 3', 'OTRAS'),
  ('AV 47E CERCA DE PIZZERIA EL GALLO', 'OTRAS'),
  ('CERCA DEL CONJUNTO RESIDENCIAL EL CUJI', 'OTRAS'),
  ('AVENIDA 9B CON CALLE 85', 'OTRAS'),
  ('AV 20 CERCA DE GINATA HELADOS', 'OTRAS'),
  ('TRONCAL 6 - MARACAIBO', 'OTRAS'),
  ('AVENIDA 4 BELLA VISTA - ROBERTO TUDARES', 'OTRAS'),
  ('PUNTA DE PALMA PDVSA', 'OTRAS'),
  ('VIA AEROPUERTO DE CARACAS - AEROPUERTO', 'OTRAS'),
  ('AVENIDA PRIMERO DE MAYO', 'OTRAS'),
  ('AV 48 CARRETERA VIA LA CAÑANA - CERCA DE EDEFCA', 'OTRAS'),
  ('ENTRE CALLE 77 Y CALLE 78 DR. PORTILLO', 'OTRAS'),
  ('AV PRINCIPAL LOS NARANJOS - CARACAS, EL HATILLO', 'OTRAS'),
  ('AV 11 CON CALLE 72 GILBERTO CORREA', 'OTRAS'),
  ('CERCA DEL COMPLEJO DEPORTIVO ALTOS DEL SOL AMADO', 'OTRAS')
ON CONFLICT (location_text) DO NOTHING;

-- ---------- Seccion de menu / permisos ----------
INSERT INTO public.option (name, description) VALUES
  ('/tracker', 'Tracker GPS de Flota')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
CROSS JOIN public.option o
WHERE p.name = 'admin' AND o.name = '/tracker'
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
