-- ============================================================
-- 031_tracker_geofence_state.sql
-- Ajuste de la alerta de geocerca (pedido de Lguerra, 16/09/2026):
-- con las 8 geocercas actuales, ~35 unidades registradas (oficina,
-- refineria, taller...) nunca han estado dentro de ninguna -- avisar
-- que estan "fuera" desde el primer momento no tiene sentido para
-- ellas. En vez de exigir que TODA unidad este siempre dentro, solo
-- se vigila a la unidad una vez que se la vio adentro al menos una
-- vez (ever_inside) -- asi que la alerta real es "se alejo de la
-- geocerca", no "nunca ha estado cerca de una geocerca conocida". A
-- medida que se agreguen mas geocercas en GEvolution, mas unidades
-- entraran a este seguimiento solas.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tracker_geofence_state (
  unit_id BIGINT PRIMARY KEY REFERENCES public.tracker_unit(id),
  ever_inside BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
