-- ============================================================
-- 005_options_seed.sql
-- Siembra las secciones de la app en `option` (para permisos por
-- perfil) y le da acceso a las 7 al perfil `admin` por defecto.
-- ============================================================

BEGIN;

INSERT INTO public.option (name, description) VALUES
  ('/security/persons', 'Personas'),
  ('/security/users', 'Usuarios'),
  ('/security/profiles', 'Perfiles'),
  ('/fuel', 'Combustible Liviana'),
  ('/fuel/heavy', 'Combustible Pesada'),
  ('/fuel/vehicles', 'Vehículos'),
  ('/reports', 'Reportes')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
CROSS JOIN public.option o
WHERE p.name = 'admin'
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
