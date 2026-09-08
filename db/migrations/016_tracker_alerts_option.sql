-- ============================================================
-- 016_tracker_alerts_option.sql
-- Separa "Alertas" de "Estado" en el menu del Tracker GPS: sección
-- propia con su permiso (mismo patron que /tracker/map, /tracker/report).
-- ============================================================

BEGIN;

INSERT INTO public.option (name, description) VALUES
  ('/tracker/alerts', 'Tracker GPS - Alertas')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
CROSS JOIN public.option o
WHERE p.name = 'admin' AND o.name = '/tracker/alerts'
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
