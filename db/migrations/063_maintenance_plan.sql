-- ============================================================
-- 063_maintenance_plan.sql
-- Mantenimiento, segunda entrega (Julio, 07/10/2026):
--   * mnt_service   -> catálogo de servicios (tarea tipo, sistema, duración).
--   * mnt_provider  -> catálogo de proveedores / talleres externos con tipo.
--   * mnt_plan      -> plan preventivo: "cada X horas/km o cada N días, lo
--                      que ocurra primero" por familia de equipo (§7 de la
--                      política FP-MTTO-PO-01; flota liviana cada 5.000 km
--                      como MAINT_INTERVAL_LIVIANA de Flota).
--   * mnt_unit_plan -> último servicio hecho de cada plan en cada unidad
--                      (lo actualiza el cierre de la OT preventiva o se
--                      registra a mano como base).
--   * mnt_work_order: plan_id, provider_id, paused_at y wait_parts_minutes
--                      (tiempo en espera de repuesto, §10.3).
--   * Ajustes: generar OT preventivas solas (apagado por defecto) y qué se
--     considera "próximo" (porcentaje del intervalo y días).
-- Rango de transacciones: 277-288 (dentro de 250-299).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.mnt_service (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  system VARCHAR(15),
  kind VARCHAR(12) NOT NULL DEFAULT 'PREVENTIVO',
  est_minutes INT,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_mnt_service_kind CHECK (kind IN ('PREVENTIVO', 'CORRECTIVO', 'INSPECCION')),
  CONSTRAINT ck_mnt_service_system CHECK (system IS NULL OR system IN ('MECANICO', 'HIDRAULICO', 'ELECTRICO', 'ESTRUCTURAL', 'OPERADOR', 'OTRO')),
  CONSTRAINT ck_mnt_service_minutes CHECK (est_minutes IS NULL OR est_minutes > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mnt_service_name ON public.mnt_service (lower(name)) WHERE active;

CREATE TABLE IF NOT EXISTS public.mnt_provider (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(40),
  rif VARCHAR(30),
  contact VARCHAR(150),
  phone VARCHAR(40),
  email VARCHAR(150),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mnt_provider_name ON public.mnt_provider (lower(name)) WHERE active;

CREATE TABLE IF NOT EXISTS public.mnt_plan (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  families VARCHAR(100),
  fleet_type VARCHAR(10),
  meter VARCHAR(5),
  every_meter NUMERIC(10,1),
  every_days INT,
  tasks TEXT,
  reference VARCHAR(150),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_mnt_plan_fleet CHECK (fleet_type IS NULL OR fleet_type IN ('LIVIANA', 'PESADA')),
  CONSTRAINT ck_mnt_plan_meter CHECK (meter IS NULL OR meter IN ('KM', 'HORAS')),
  CONSTRAINT ck_mnt_plan_interval CHECK ((meter IS NOT NULL AND every_meter > 0) OR every_days > 0),
  CONSTRAINT ck_mnt_plan_meter_pair CHECK ((meter IS NULL) = (every_meter IS NULL))
);

CREATE TABLE IF NOT EXISTS public.mnt_unit_plan (
  unit_id BIGINT NOT NULL REFERENCES public.fleet_unit(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES public.mnt_plan(id) ON DELETE CASCADE,
  last_done_at DATE NOT NULL,
  last_done_meter NUMERIC(12,1),
  source VARCHAR(10) NOT NULL DEFAULT 'MANUAL',
  work_order_id BIGINT REFERENCES public.mnt_work_order(id) ON DELETE SET NULL,
  updated_by VARCHAR(150),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (unit_id, plan_id),
  CONSTRAINT ck_mnt_unit_plan_source CHECK (source IN ('MANUAL', 'OT'))
);

ALTER TABLE public.mnt_work_order
  ADD COLUMN IF NOT EXISTS plan_id BIGINT REFERENCES public.mnt_plan(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_id BIGINT REFERENCES public.mnt_provider(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wait_parts_minutes INT NOT NULL DEFAULT 0;

INSERT INTO public.mnt_setting (key, value) VALUES
  ('MNT_AUTO_PREVENTIVA', 'off'),
  ('PROXIMO_PORCENTAJE', '10'),
  ('PROXIMO_DIAS', '7')
ON CONFLICT (key) DO NOTHING;

-- ---------- Catálogo de servicios (tareas de §7) ----------
INSERT INTO public.mnt_service (name, system, kind, est_minutes) VALUES
  ('Cambio de aceite de motor y filtros', 'MECANICO', 'PREVENTIVO', 120),
  ('Cambio de aceite hidráulico y filtros', 'HIDRAULICO', 'PREVENTIVO', 180),
  ('Inspección y lubricación de cable de acero', 'ESTRUCTURAL', 'INSPECCION', 90),
  ('Prueba de dispositivos de seguridad (LMI, anti-two-block)', 'ELECTRICO', 'INSPECCION', 60),
  ('Inspección de sistema hidráulico y mangueras', 'HIDRAULICO', 'INSPECCION', 60),
  ('Inspección de horquillas (grietas, desgaste, deformación)', 'ESTRUCTURAL', 'INSPECCION', 45),
  ('Prueba de frenos y sistema de elevación', 'MECANICO', 'INSPECCION', 45),
  ('Servicio de transmisión', 'MECANICO', 'PREVENTIVO', 240),
  ('Servicio de frenos', 'MECANICO', 'PREVENTIVO', 180),
  ('Ajuste de sistema de refrigeración', 'MECANICO', 'PREVENTIVO', 120),
  ('Diagnóstico de sistema eléctrico', 'ELECTRICO', 'CORRECTIVO', 120),
  ('Revisión de cauchos y rotación', 'MECANICO', 'PREVENTIVO', 60),
  ('Prueba dieléctrica de la pluma aislada', 'ELECTRICO', 'INSPECCION', 120),
  ('Inspección de estabilizadores', 'ESTRUCTURAL', 'INSPECCION', 60),
  ('Inspección periódica / anual completa', 'OTRO', 'INSPECCION', 480)
ON CONFLICT DO NOTHING;

-- ---------- Plan preventivo base (§7). families = prefijos del código. ----------
INSERT INTO public.mnt_plan (name, families, fleet_type, meter, every_meter, every_days, tasks, reference) VALUES
  ('Inspección frecuente documentada', 'GT', NULL, NULL, NULL, 30, 'Inspección visual y funcional documentada', 'ASME B30.5'),
  ('Inspección periódica / anual completa', 'GT', NULL, 'HORAS', 1000, 365, 'Inspección periódica completa', 'ASME B30.5 / OSHA 1926.1412(e)'),
  ('Cambio de aceite de motor y filtros', 'GT', NULL, 'HORAS', 250, 90, E'Cambiar aceite de motor\nCambiar filtros de aceite, aire y combustible', 'Manual del fabricante'),
  ('Cambio de aceite hidráulico y filtros', 'GT', NULL, 'HORAS', 500, NULL, E'Cambiar aceite hidráulico\nCambiar filtros hidráulicos', 'Manual del fabricante'),
  ('Inspección y lubricación de cable de acero', 'GT', NULL, NULL, NULL, 30, 'Inspeccionar y lubricar cable de acero', 'ASME B30.5 / B30.9'),
  ('Prueba de dispositivos de seguridad (LMI, anti-two-block)', 'GT', NULL, NULL, NULL, 30, 'Probar limitador de carga y anti-two-block', 'ASME B30.5'),
  ('Inspección frecuente documentada', 'BA,CBA', NULL, NULL, NULL, 30, 'Inspección visual y funcional documentada', 'ASME B30.22'),
  ('Inspección periódica / anual completa', 'BA,CBA', NULL, 'HORAS', 1000, 365, 'Inspección periódica completa', 'ASME B30.22 / OSHA 1926.1412'),
  ('Servicio de motor, filtros y fluidos', 'BA,CBA', NULL, 'HORAS', 250, 90, E'Cambiar aceite de motor\nCambiar filtros\nRevisar niveles de fluidos', 'Manual del fabricante'),
  ('Inspección de sistema hidráulico y mangueras', 'BA,CBA', NULL, NULL, NULL, 30, 'Inspeccionar sistema hidráulico y mangueras', 'Manual del fabricante'),
  ('Servicio menor (aceite de motor y filtros)', 'MT', NULL, 'HORAS', 250, 30, E'Cambiar aceite de motor\nCambiar filtros', 'Manual del fabricante'),
  ('Servicio mayor (transmisión, hidráulico y frenos)', 'MT', NULL, 'HORAS', 1000, 180, E'Servicio de transmisión\nServicio del sistema hidráulico\nServicio de frenos', 'Manual del fabricante'),
  ('Inspección anual comprehensiva', 'MT', NULL, NULL, NULL, 365, 'Inspección anual comprehensiva', 'ANSI/ITSDF B56.1'),
  ('Inspección de horquillas', 'MT', NULL, NULL, NULL, 90, 'Inspeccionar horquillas (grietas, desgaste, deformación)', 'ANSI/ITSDF B56.1'),
  ('Prueba de frenos y sistema de elevación', 'MT', NULL, NULL, NULL, 30, 'Probar frenos y sistema de elevación', 'ANSI/ITSDF B56.1'),
  ('Servicio 250 h', 'CF', NULL, 'HORAS', 250, NULL, E'Cambiar aceite de motor\nCambiar filtros', 'Manual del fabricante'),
  ('Servicio 500 h', 'CF', NULL, 'HORAS', 500, NULL, E'Servicio 500 h según manual', 'Manual del fabricante'),
  ('Servicio mayor 1.000 h', 'CF', NULL, 'HORAS', 1000, NULL, E'Servicio mayor según manual', 'Manual del fabricante'),
  ('Overhaul / reconstrucción de componentes', 'CF', NULL, 'HORAS', 2000, NULL, 'Overhaul según manual', 'Manual del fabricante'),
  ('Inspección mensual documentada', 'CC', NULL, NULL, NULL, 30, 'Inspección mensual documentada', 'ANSI A92.2 / A92.22'),
  ('Inspección anual comprehensiva', 'CC', NULL, NULL, NULL, 365, 'Inspección anual: estructura, hidráulico y controles', 'ANSI A92.2 / A92.22 / A92.24'),
  ('Prueba dieléctrica de la pluma aislada', 'CC', NULL, 'HORAS', 500, 365, 'Prueba dieléctrica de la pluma aislada', 'ASTM F711'),
  ('Inspección de sistema hidráulico y válvulas', 'CC', NULL, NULL, NULL, 90, 'Inspeccionar sistema hidráulico y válvulas de control', 'Manual del fabricante'),
  ('Cambio de aceite y filtros', NULL, 'LIVIANA', 'KM', 5000, 180, E'Cambiar aceite de motor\nCambiar filtro de aceite\nRevisar niveles', 'MAINT_INTERVAL_LIVIANA (Flota)'),
  ('Revisión general y cauchos', NULL, 'LIVIANA', 'KM', 10000, 365, E'Revisión de frenos\nRevisión y rotación de cauchos\nRevisión de luces y suspensión', 'Práctica de flota liviana')
;

-- ---------- Secciones nuevas ----------
INSERT INTO public.option (name, description) VALUES
  ('/maintenance/plan', 'Mantenimiento - Plan preventivo'),
  ('/maintenance/catalogs', 'Mantenimiento - Servicios y proveedores')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id FROM public.profile p
JOIN public.option o ON o.name IN ('/maintenance/plan', '/maintenance/catalogs')
WHERE p.name IN ('admin', 'gerencia', 'supervisor_mantenimiento', 'mantenimiento')
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
