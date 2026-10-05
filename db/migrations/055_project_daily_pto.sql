-- ============================================================
-- 055_project_daily_pto.sql
-- "HORAS PTO" por proyecto y por día: la fila fija de la hoja "Gráfico"
-- del Excel de referencia (164 h/día en Izamiento), que no depende de un
-- equipo sino del plan del proyecto. Un solo renglón por proyecto+día; se
-- captura en Control de Horas > Registro Diario y alimenta el gráfico día
-- por día de Reportes.
--
-- OJO: no confundir con hours_daily_entry.pto_hours, que es "DISPONIBLE
-- SEGÚN PTO" por equipo (en pantalla: "Horas Disponibles").
-- (Julio, 25/09/2026)
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.project_daily_pto (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.project(id),
  fecha DATE NOT NULL,
  horas_pto NUMERIC(7,2) NOT NULL,
  created_by BIGINT REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_daily_pto_project_fecha_key UNIQUE (project_id, fecha),
  CONSTRAINT ck_project_daily_pto_horas_nonneg CHECK (horas_pto >= 0)
);

COMMIT;
