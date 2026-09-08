-- ============================================================
-- 012_tracker_report_option.sql
-- Siembra la sección "Reporte de Turno" del Tracker GPS en `option`
-- (mismo patron que 008/011) y se la asigna al perfil `admin`.
-- ============================================================

BEGIN;

INSERT INTO public.option (name, description) VALUES
  ('/tracker/report', 'Tracker GPS - Reporte de Turno')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
CROSS JOIN public.option o
WHERE p.name = 'admin' AND o.name = '/tracker/report'
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
