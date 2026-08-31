-- ============================================================
-- 004_security_completion.sql
-- Completa el modelo de Security (Person/User/Profile) para que
-- el backend pueda implementar el CRUD completo de esas 3 clases.
-- Independiente de 003_fuel_english.sql (esa sigue pospuesta).
-- ============================================================

BEGIN;

ALTER TABLE person ADD COLUMN IF NOT EXISTS department VARCHAR(150);

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

ALTER TABLE "user" ADD CONSTRAINT uq_user_email UNIQUE (email);

COMMIT;
