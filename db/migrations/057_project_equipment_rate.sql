-- ============================================================
-- 057_project_equipment_rate.sql
-- Tarifa en USD por hora de cada unidad dentro de un proyecto (pedido de
-- Julio, 05/10/2026). Se carga a mano en Control de Horas > Proyectos >
-- "Tarifas por hora", y Reportes de Control de Horas la usa para mostrar
-- cuánto generó cada unidad:
--   generado = horas de cobro completo (ejecutadas + PTO) x rate_usd
--            + horas stand-by x standby_rate_usd
-- standby_rate_usd es la tarifa "SB" del contrato; vacía = el stand-by de
-- esa unidad no genera monto.
-- Una sola tarifa vigente por unidad y proyecto (sin historial): si cambia,
-- el reporte recalcula también los días anteriores.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.project_equipment_rate (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.project(id) ON DELETE CASCADE,
  equipment_id BIGINT NOT NULL REFERENCES public.fleet_unit(id),
  rate_usd NUMERIC(10,2) NOT NULL,
  standby_rate_usd NUMERIC(10,2),
  updated_by BIGINT REFERENCES public."user"(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_equipment_rate UNIQUE (project_id, equipment_id),
  CONSTRAINT ck_project_equipment_rate_positive CHECK (rate_usd >= 0 AND (standby_rate_usd IS NULL OR standby_rate_usd >= 0))
);

-- Tarifas del contrato de Izamiento (tabla de precios por hora, 05/10/2026).
-- Montacargas: el contrato no trae tarifa SB, queda vacía.
-- MT.06 / MT.07 son de 15 t y MT.01 / MT.03 de 2,5 t (política FP-MTTO-PO-01, Anexo A).
INSERT INTO public.project_equipment_rate (project_id, equipment_id, rate_usd, standby_rate_usd)
SELECT p.id, e.id, t.rate, t.sb
FROM (VALUES
  ('FP-GT.02', 197.00, 78.80), ('FP-GT.04', 197.00, 78.80), ('FP-GT.05', 197.00, 78.80), ('FP-GT.06', 197.00, 78.80),
  ('FP-BA-04', 59.99, 24.00), ('FP-CBA-05', 59.99, 24.00), ('FP-CBA-06', 59.99, 24.00),
  ('FP-CC.02', 46.99, 18.80),
  ('FP-CF-01', 36.19, 14.48), ('FP-CF-03', 36.19, 14.48), ('FP-CF-05', 36.19, 14.48),
  ('FP-MT.06', 53.22, NULL), ('FP-MT.07', 53.22, NULL),
  ('FP-MT.01', 12.00, NULL), ('FP-MT.03', 12.00, NULL)
) AS t(code, rate, sb)
JOIN public.fleet_unit e ON e.code = t.code AND e.deleted_at IS NULL
JOIN public.project p ON p.name = 'Izamiento'
ON CONFLICT (project_id, equipment_id) DO NOTHING;

COMMIT;
