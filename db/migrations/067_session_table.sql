-- ============================================================
-- 067_session_table.sql
-- Tabla de sesiones web (connect-pg-simple), ahora creada por migración
-- (seguridad, 08/10/2026). Antes la creaba la propia librería al arrancar
-- (createTableIfMissing), lo que obligaba a que el usuario de la base que usa
-- la app tuviera permiso para crear tablas. Con esta migración la app puede
-- conectarse con un usuario que SOLO lee y escribe datos (ver DEPLOY_AZURE.md,
-- "Usuario de base de datos con permisos limitados").
-- Idempotente: en las bases que ya tenían la tabla no cambia nada.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public."session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey') THEN
    ALTER TABLE public."session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON public."session" ("expire");

COMMIT;
