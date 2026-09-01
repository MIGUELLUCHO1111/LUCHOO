-- ============================================================
-- 006_username_unique.sql
-- El username ahora se puede editar a mano en el panel de Usuarios
-- (antes solo se autogeneraba); agrega la restricción de unicidad
-- que faltaba para evitar logins ambiguos.
-- ============================================================

BEGIN;

ALTER TABLE "user" ADD CONSTRAINT uq_user_name UNIQUE (name);

COMMIT;
