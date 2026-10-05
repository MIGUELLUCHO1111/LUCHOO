-- ============================================================
-- 056_reports_split.sql
-- Reportes se divide en dos páginas (pedido de Julio, 05/10/2026):
--   /reports/fuel  -> Reportes de Combustible
--   /reports/hours -> Reportes de Control de Horas
-- Cada perfil que tenía la sección /reports recibe las dos nuevas, y la
-- sección vieja se elimina (ya no existe esa ruta en el frontend).
-- Los permisos de las funciones (method_profile) no cambian: las páginas
-- usan las mismas transacciones que antes.
-- ============================================================

BEGIN;

INSERT INTO public.option (name, description) VALUES
  ('/reports/fuel', 'Reportes - Combustible'),
  ('/reports/hours', 'Reportes - Control de Horas')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT op.profile_id, nueva.id
FROM public.option_profile op
JOIN public.option vieja ON vieja.id = op.option_id AND vieja.name = '/reports'
CROSS JOIN public.option nueva
WHERE nueva.name IN ('/reports/fuel', '/reports/hours')
ON CONFLICT (profile_id, option_id) DO NOTHING;

-- admin siempre tiene todas las secciones, aunque no tuviera /reports.
INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
CROSS JOIN public.option o
WHERE p.name = 'admin'
  AND o.name IN ('/reports/fuel', '/reports/hours')
ON CONFLICT (profile_id, option_id) DO NOTHING;

DELETE FROM public.option_menu WHERE option_id IN (SELECT id FROM public.option WHERE name = '/reports');
DELETE FROM public.option_profile WHERE option_id IN (SELECT id FROM public.option WHERE name = '/reports');
DELETE FROM public.option WHERE name = '/reports';

COMMIT;
