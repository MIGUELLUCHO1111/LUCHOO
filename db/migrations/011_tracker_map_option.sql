-- ============================================================
-- 011_tracker_map_option.sql
-- Siembra la sección "Mapa en vivo" del Tracker GPS (Fase 3) en
-- `option` (mismo patron que 008_fuel_tank_option.sql) y se la
-- asigna al perfil `admin` por defecto.
-- ============================================================

BEGIN;

INSERT INTO public.option (name, description) VALUES
  ('/tracker/map', 'Tracker GPS - Mapa en vivo')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
CROSS JOIN public.option o
WHERE p.name = 'admin' AND o.name = '/tracker/map'
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
