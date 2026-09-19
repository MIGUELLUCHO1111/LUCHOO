-- ============================================================
-- 023_tracker_location_alias.sql
-- Algunas direcciones que devuelve el proveedor de GPS (texto largo y
-- generico, ej. "Kilometro 40, Parroquia Andres Bello, Municipio La
-- Canada, Zulia, Venezuela~Zulia") en realidad corresponden a un lugar
-- interno conocido (ej. "BASE FULLPETRO BOSCAN"). Esta tabla guarda ese
-- reemplazo: match_text es un fragmento que debe aparecer dentro del
-- location_text real (no una igualdad exacta), porque el mismo lugar
-- puede llegar con pequenas variaciones de prefijo/sufijo segun la
-- unidad y el momento (visto en la practica: mismo cruce con "~Zulia",
-- "=Zulia", o un prefijo de carretera distinto).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tracker_location_alias (
  id BIGSERIAL PRIMARY KEY,
  match_text TEXT NOT NULL UNIQUE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
