-- ============================================================
-- 022_tracker_daily_analysis.sql
-- El Análisis Operativo y Comportamiento de Conductores (viajes, ralentí,
-- excesos de velocidad) se calculaba al momento y se perdía apenas se
-- cerraba la pantalla. Esta tabla lo deja guardado por fecha, para poder
-- generarlo solo de madrugada y que quede disponible para verlo después,
-- sin tener que volver a consultar la API unidad por unidad cada vez.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tracker_daily_analysis (
  id BIGSERIAL PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  unidades_consultadas INTEGER,
  total_viajes INTEGER,
  viajes_diurnos INTEGER,
  viajes_nocturnos INTEGER,
  viajes_mixtos INTEGER,
  top_distancia JSONB,
  top_ralenti JSONB,
  eventos_totales INTEGER,
  top_excesos_velocidad JSONB,
  eventos_por_tipo JSONB,
  errores JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
