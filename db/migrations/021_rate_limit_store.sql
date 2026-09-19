-- ============================================================
-- 021_rate_limit_store.sql
-- El rate limiter de las rutas de auth (login/registro/forgot/reset) usaba
-- el MemoryStore por defecto de express-rate-limit: cada proceso PM2 lleva
-- su propio contador. Bajo cluster (8 procesos) el límite real de intentos
-- se vuelve ~8x más débil de lo configurado, y no sobrevive un reinicio.
-- Se mueve el conteo a Postgres (ya es la fuente de verdad compartida por
-- todos los procesos, igual que la sesión desde 31/08) para que el límite
-- sea el mismo sin importar qué proceso atienda la petición.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS rate_limit (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_time TIMESTAMPTZ NOT NULL
);

COMMIT;
