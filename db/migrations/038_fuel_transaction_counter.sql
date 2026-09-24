-- ============================================================
-- 038_fuel_transaction_counter.sql
-- Transaction ID de Combustible pasa a generarse solo (Julio, 21/09/2026):
-- FP-AAMMDD### donde AA/MM/DD son del dia del llenado (filled_at) y ### es
-- el consecutivo de esa flota ese dia, empezando en 001. Formato exacto:
--   Liviana (gasolina): FP-{AA}GL{MM}{DD}{###}
--   Pesada  (gasoil):   FP-{AA}DS{MM}{DD}{###}
-- Una fila por (fecha, flota) que se incrementa atomicamente -- evita que
-- dos llenados casi simultaneos del mismo dia terminen con el mismo
-- consecutivo (INSERT ... ON CONFLICT DO UPDATE, mismo patron ya usado en
-- rate_limit para el mismo problema de concurrencia bajo PM2 cluster).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fuel_transaction_counter (
  fecha DATE NOT NULL,
  fleet_code VARCHAR(2) NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (fecha, fleet_code)
);

COMMIT;
