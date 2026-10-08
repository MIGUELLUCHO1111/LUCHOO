-- ============================================================
-- 065_option_profile_read_only.sql
-- Acceso de SOLO LECTURA por sección (pedido de Julio, 08/10/2026).
-- Un perfil puede tener una sección asignada en modo "solo ver": el menú se
-- la muestra y puede consultar todo, pero no crear, editar ni eliminar.
--
-- No es solo visual: con read_only = true el perfil recibe únicamente las
-- funciones de LECTURA de esa sección (Option.isReadMethod en option.js:
-- get*, listar*, obtener*, ...). Cualquier intento de guardar lo rechaza el
-- dispatcher por falta de permiso, aunque alguien se salte la pantalla.
-- ============================================================

BEGIN;

ALTER TABLE public.option_profile
  ADD COLUMN IF NOT EXISTS read_only BOOLEAN NOT NULL DEFAULT false;

COMMIT;
