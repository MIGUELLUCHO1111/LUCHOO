-- Flota a la que pertenece cada conductor (pedido de Lguerra, 07/10/2026).
-- Se calcula sola con las unidades que maneja (todas livianas -> LIVIANA,
-- todas pesadas -> PESADA, de las dos -> AMBAS) cada vez que se le asigna o
-- quita una unidad, desde la ficha de la unidad o desde la del conductor.
-- Si se queda sin unidades conserva la ultima; el admin tambien la puede
-- poner a mano al registrarlo.
ALTER TABLE public.fleet_driver
  ADD COLUMN IF NOT EXISTS fleet_type VARCHAR(10);

ALTER TABLE public.fleet_driver DROP CONSTRAINT IF EXISTS fleet_driver_fleet_type_check;
ALTER TABLE public.fleet_driver
  ADD CONSTRAINT fleet_driver_fleet_type_check CHECK (fleet_type IS NULL OR fleet_type IN ('LIVIANA', 'PESADA', 'AMBAS'));

-- Los conductores que ya tienen unidades toman su flota de una vez.
UPDATE public.fleet_driver d SET fleet_type = x.tipo
FROM (
  SELECT ud.driver_id, CASE WHEN COUNT(DISTINCT u.fleet_type) > 1 THEN 'AMBAS' ELSE MAX(u.fleet_type) END AS tipo
  FROM public.fleet_unit_driver ud JOIN public.fleet_unit u ON u.id = ud.unit_id AND u.deleted_at IS NULL
  WHERE ud.ended_at IS NULL AND u.fleet_type IN ('LIVIANA', 'PESADA')
  GROUP BY ud.driver_id
) x
WHERE d.id = x.driver_id;
