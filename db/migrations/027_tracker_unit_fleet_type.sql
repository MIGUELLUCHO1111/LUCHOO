-- ============================================================
-- 027_tracker_unit_fleet_type.sql
-- Clasifica cada unidad como LIVIANA o PESADA (Lguerra, 15/09/2026):
-- la flota pesada esta casi siempre en campo, y si aparece activa fuera
-- de horario suele ser autorizado -- por eso deja de enviarse por
-- Telegram (ver alerta.js), mientras que la liviana si dispara alerta.
-- Sembrado a partir de la lista que dio gerencia, cruzada contra los
-- codigos reales de tracker_unit (6 unidades usan guion en vez de punto
-- en el codigo real, ej. FP-CBA-01 en vez de FP-CBA.01 de la lista).
-- ============================================================

BEGIN;

ALTER TABLE public.tracker_unit
  ADD COLUMN IF NOT EXISTS fleet_type VARCHAR(10)
    CHECK (fleet_type IS NULL OR fleet_type IN ('LIVIANA', 'PESADA'));

UPDATE public.tracker_unit AS t
SET fleet_type = seed.fleet_type
FROM (VALUES
  ('FP-VA.01', 'PESADA'), ('FP-VA.02', 'PESADA'),
  ('FP-VEH.03-01', 'PESADA'), ('FP-VEH.03-02', 'PESADA'), ('FP-VEH.03-03', 'PESADA'),
  ('FP-VEH.03-04', 'PESADA'), ('FP-VEH.03-05', 'PESADA'),
  ('FP-CBA-01', 'PESADA'), ('FP-CBA-04', 'PESADA'), ('FP-CBA-05', 'PESADA'), ('FP-CBA-06', 'PESADA'),
  ('FP-CC.01', 'PESADA'), ('FP-CC.02', 'PESADA'),
  ('FP-CF-05', 'PESADA'), ('FP-CF-06', 'PESADA'),
  ('FP-CH.01', 'PESADA'),
  ('FP-CPS.01', 'PESADA'), ('FP-CPS.02', 'PESADA'),
  ('FP-CSL.01', 'PESADA'), ('FP-CSL.02', 'PESADA'), ('FP-CSL.03', 'PESADA'),
  ('FP-CSL.04', 'PESADA'), ('FP-CSL.05', 'PESADA'), ('FP-CSL.06', 'PESADA'),
  ('FP-GT.02', 'PESADA'), ('FP-GT.04', 'PESADA'), ('FP-GT.05', 'PESADA'),
  ('FP-GT.06', 'PESADA'), ('FP-GT.07', 'PESADA'), ('FP-GT.08', 'PESADA'),
  ('FPMDS01', 'PESADA'), ('FPMDS02', 'PESADA'), ('FPMDS03', 'PESADA'),
  ('FP-MT.01', 'PESADA'), ('FP-MT.02', 'PESADA'), ('FP-MT.03', 'PESADA'),
  ('FP-MT.04', 'PESADA'), ('FP-MT.05', 'PESADA'), ('FP-MT.06', 'PESADA'), ('FP-MT.07', 'PESADA'),
  ('FPRE01', 'PESADA'),
  ('FP-VEH.01-01', 'LIVIANA'), ('FP-VEH.01-02', 'LIVIANA'), ('FP-VEH.01-04', 'LIVIANA'),
  ('FP-VEH.02-08', 'LIVIANA'), ('FP-VEH.02-09', 'LIVIANA'), ('FP-VEH.02-10', 'LIVIANA'),
  ('FP-VEH.02-11', 'LIVIANA'), ('FP-VEH.02-12', 'LIVIANA'), ('FP-VEH.02-13', 'LIVIANA'),
  ('FP-VEH.02-14', 'LIVIANA'), ('FP-VEH.02-15', 'LIVIANA'), ('FP-VEH.02-16', 'LIVIANA'),
  ('FP-VEH.02-18', 'LIVIANA'), ('FP-VEH.02-19', 'LIVIANA'), ('FP-VEH.02-20', 'LIVIANA'),
  ('FP-VEH.02-21', 'LIVIANA'), ('FP-VEH.02-23', 'LIVIANA'), ('FP-VEH.02-24', 'LIVIANA'),
  ('FP-VEH.02-25', 'LIVIANA'), ('FP-VEH.02-26', 'LIVIANA'), ('FP-VEH.02-27', 'LIVIANA'),
  ('FP-VEH.02-28', 'LIVIANA'), ('FP-VEH.02-29', 'LIVIANA'),
  ('FP-TP.04-01', 'LIVIANA'), ('FP-TP.04-02', 'LIVIANA'), ('FP-TP.04-03', 'LIVIANA'),
  ('FP-TP.04-04', 'LIVIANA'), ('FP-TP.04-05', 'LIVIANA'), ('FP-TP.04-06', 'LIVIANA')
) AS seed(code, fleet_type)
WHERE t.code = seed.code AND t.fleet_type IS NULL;

COMMIT;
