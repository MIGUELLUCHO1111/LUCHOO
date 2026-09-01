-- ============================================================
-- 008_fuel_tank_option.sql
-- Siembra la sección "Tanque de Gasoil" en `option` (mismo patrón que
-- 005_options_seed.sql) y se la asigna al perfil `admin` por defecto.
-- ============================================================

BEGIN;

INSERT INTO public.option (name, description) VALUES
  ('/fuel/tank', 'Tanque de Gasoil')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
CROSS JOIN public.option o
WHERE p.name = 'admin' AND o.name = '/fuel/tank'
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
