-- ============================================================
-- 062_maintenance.sql
-- Sección Mantenimiento, primera entrega (Julio, 07/10/2026). Basada en la
-- política FP-MTTO-PO-01 (ver ROADMAP_MANTENIMIENTO.md):
--   * mnt_incident         -> problema reportado en una unidad (incidencia).
--   * mnt_work_order       -> Orden de Trabajo (Anexo B): preventiva,
--                             correctiva (menor/mayor) o emergencia, con su
--                             ciclo de estados.
--   * mnt_work_order_approval -> firmas según los niveles de §9.4.
--   * mnt_work_order_task / _part / _file / _event -> tareas, repuestos,
--                             evidencias e historial de cada OT.
--   * mnt_unit_criticality -> criticidad por unidad (base por categoría, §5.2).
--   * mnt_setting          -> umbral USD menor/mayor (sin valor hasta que lo
--                             fije Gerencia + Finanzas), horas para
--                             regularizar emergencias, días para "estancada".
-- Decisiones de Julio (07/10/2026): toda la flota entra; niveles de
-- aprobación de la política desde ya; perfiles mantenimiento,
-- supervisor_mantenimiento y gerencia (la correctiva mayor necesita la
-- firma de Gerencia de Mantenimiento y la de Gerencia de Operaciones, dos
-- usuarios distintos); las OT reemplazan el "historial de servicios" de la
-- ficha de Flota (fleet_unit_service, vacío al 07/10/2026).
-- Rango reservado: transacciones 250-299.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.mnt_setting (
  key VARCHAR(60) PRIMARY KEY,
  value VARCHAR(200),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.mnt_setting (key, value) VALUES
  ('CORRECTIVA_MAYOR_UMBRAL_USD', NULL),
  ('EMERGENCIA_REGULARIZAR_HORAS', '48'),
  ('OT_ESTANCADA_DIAS', '15')
ON CONFLICT (key) DO NOTHING;

-- ---------- Criticidad (§5) ----------
CREATE TABLE IF NOT EXISTS public.mnt_unit_criticality (
  unit_id BIGINT PRIMARY KEY REFERENCES public.fleet_unit(id) ON DELETE CASCADE,
  level VARCHAR(15) NOT NULL,
  source VARCHAR(10) NOT NULL DEFAULT 'CATEGORIA',
  note TEXT,
  updated_by VARCHAR(150),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_mnt_crit_level CHECK (level IN ('CRITICO', 'SEMICRITICO', 'NO_CRITICO')),
  CONSTRAINT ck_mnt_crit_source CHECK (source IN ('CATEGORIA', 'MANUAL'))
);

-- Base por categoría (§5.2 y Anexo A): GT, BA/CBA, CC y montacargas de
-- 15 t (MT.06, MT.07) críticos; montacargas de 2,5-3 t y cargadores
-- semi-críticos; el resto no crítico. Se puede ajustar por unidad.
INSERT INTO public.mnt_unit_criticality (unit_id, level, source)
SELECT u.id,
  CASE
    WHEN fam IN ('GT', 'BA', 'CBA', 'CC') THEN 'CRITICO'
    WHEN fam = 'MT' AND regexp_replace(upper(u.code), '[^0-9]', '', 'g') IN ('06', '07') THEN 'CRITICO'
    WHEN fam IN ('MT', 'CF') THEN 'SEMICRITICO'
    ELSE 'NO_CRITICO'
  END,
  'CATEGORIA'
FROM (
  SELECT id, code, substring(regexp_replace(upper(code), '^FP[-.]?', '') FROM '^[A-Z]+') AS fam
  FROM public.fleet_unit
  WHERE deleted_at IS NULL
) u
ON CONFLICT (unit_id) DO NOTHING;

-- ---------- Órdenes de Trabajo (Anexo B) ----------
CREATE TABLE IF NOT EXISTS public.mnt_counter (
  year INT PRIMARY KEY,
  last_seq INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.mnt_work_order (
  id BIGSERIAL PRIMARY KEY,
  number VARCHAR(20) NOT NULL UNIQUE,
  unit_id BIGINT NOT NULL REFERENCES public.fleet_unit(id),
  kind VARCHAR(12) NOT NULL,
  level VARCHAR(10),
  status VARCHAR(16) NOT NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'MEDIA',
  title VARCHAR(200) NOT NULL,
  description TEXT,
  criticality_at_open VARCHAR(15),
  estimated_cost_usd NUMERIC(12,2),
  special_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  out_of_service BOOLEAN NOT NULL DEFAULT FALSE,
  prev_operational_status VARCHAR(20),
  prev_status_cause VARCHAR(200),
  meter VARCHAR(5),
  open_meter_value NUMERIC(12,1),
  close_meter_value NUMERIC(12,1),
  failure_system VARCHAR(15),
  technician VARCHAR(150),
  provider VARCHAR(150),
  labor_hours NUMERIC(8,2),
  functional_test BOOLEAN,
  result TEXT,
  regularize_due_at TIMESTAMPTZ,
  regularized_at TIMESTAMPTZ,
  reject_reason TEXT,
  void_reason TEXT,
  opened_by VARCHAR(150),
  opened_by_user_id BIGINT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  closed_by VARCHAR(150),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_mnt_wo_kind CHECK (kind IN ('PREVENTIVA', 'CORRECTIVA', 'EMERGENCIA')),
  CONSTRAINT ck_mnt_wo_level CHECK (level IS NULL OR level IN ('MENOR', 'MAYOR')),
  CONSTRAINT ck_mnt_wo_status CHECK (status IN ('SOLICITADA', 'APROBADA', 'EN_EJECUCION', 'ESPERA_REPUESTO', 'EJECUTADA', 'CERRADA', 'RECHAZADA', 'ANULADA')),
  CONSTRAINT ck_mnt_wo_priority CHECK (priority IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA')),
  CONSTRAINT ck_mnt_wo_meter CHECK (meter IS NULL OR meter IN ('KM', 'HORAS')),
  CONSTRAINT ck_mnt_wo_failure CHECK (failure_system IS NULL OR failure_system IN ('MECANICO', 'HIDRAULICO', 'ELECTRICO', 'ESTRUCTURAL', 'OPERADOR', 'OTRO')),
  CONSTRAINT ck_mnt_wo_amounts CHECK ((estimated_cost_usd IS NULL OR estimated_cost_usd >= 0) AND (labor_hours IS NULL OR labor_hours >= 0))
);
CREATE INDEX IF NOT EXISTS idx_mnt_wo_unit ON public.mnt_work_order(unit_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_mnt_wo_status ON public.mnt_work_order(status);

CREATE TABLE IF NOT EXISTS public.mnt_work_order_approval (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES public.mnt_work_order(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL,
  decision VARCHAR(10) NOT NULL,
  note TEXT,
  user_id BIGINT,
  user_name VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_mnt_appr_role CHECK (role IN ('SUPERVISOR', 'GERENCIA_MTTO', 'GERENCIA_OPS')),
  CONSTRAINT ck_mnt_appr_decision CHECK (decision IN ('APROBADA', 'RECHAZADA')),
  CONSTRAINT uq_mnt_appr_role UNIQUE (work_order_id, role)
);

CREATE TABLE IF NOT EXISTS public.mnt_work_order_task (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES public.mnt_work_order(id) ON DELETE CASCADE,
  description VARCHAR(300) NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  done_at TIMESTAMPTZ,
  done_by VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mnt_work_order_part (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES public.mnt_work_order(id) ON DELETE CASCADE,
  part_number VARCHAR(80),
  description VARCHAR(200) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_cost_usd NUMERIC(12,2),
  provider VARCHAR(150),
  reason VARCHAR(200),
  created_by VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_mnt_part_amounts CHECK (quantity > 0 AND (unit_cost_usd IS NULL OR unit_cost_usd >= 0))
);

CREATE TABLE IF NOT EXISTS public.mnt_work_order_file (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES public.mnt_work_order(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  original_name VARCHAR(200),
  mime_type VARCHAR(80),
  size_bytes INT,
  uploaded_by VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mnt_work_order_event (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES public.mnt_work_order(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  detail TEXT,
  created_by VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Incidencias ----------
CREATE TABLE IF NOT EXISTS public.mnt_incident (
  id BIGSERIAL PRIMARY KEY,
  unit_id BIGINT NOT NULL REFERENCES public.fleet_unit(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  priority VARCHAR(10) NOT NULL DEFAULT 'MEDIA',
  failure_system VARCHAR(15),
  status VARCHAR(12) NOT NULL DEFAULT 'ABIERTA',
  source VARCHAR(12) NOT NULL DEFAULT 'MANUAL',
  work_order_id BIGINT REFERENCES public.mnt_work_order(id) ON DELETE SET NULL,
  close_note TEXT,
  reported_by VARCHAR(150),
  reported_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_mnt_inc_priority CHECK (priority IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA')),
  CONSTRAINT ck_mnt_inc_status CHECK (status IN ('ABIERTA', 'EN_OT', 'RESUELTA', 'DESCARTADA')),
  CONSTRAINT ck_mnt_inc_source CHECK (source IN ('MANUAL', 'INSPECCION')),
  CONSTRAINT ck_mnt_inc_failure CHECK (failure_system IS NULL OR failure_system IN ('MECANICO', 'HIDRAULICO', 'ELECTRICO', 'ESTRUCTURAL', 'OPERADOR', 'OTRO'))
);
CREATE INDEX IF NOT EXISTS idx_mnt_inc_unit ON public.mnt_incident(unit_id, created_at DESC);

-- ---------- Secciones y perfiles ----------
INSERT INTO public.option (name, description) VALUES
  ('/maintenance', 'Mantenimiento - Órdenes de Trabajo'),
  ('/maintenance/incidents', 'Mantenimiento - Incidencias'),
  ('/maintenance/criticality', 'Mantenimiento - Criticidad y ajustes')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.profile (name)
SELECT v.name FROM (VALUES ('mantenimiento'), ('supervisor_mantenimiento'), ('gerencia')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM public.profile p WHERE p.name = v.name);

-- admin ve todo; los tres perfiles nuevos ven OT e Incidencias; Criticidad
-- y ajustes solo admin y gerencia.
INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id
FROM public.profile p
JOIN public.option o ON o.name IN ('/maintenance', '/maintenance/incidents', '/maintenance/criticality')
WHERE p.name IN ('admin', 'gerencia')
   OR (p.name IN ('mantenimiento', 'supervisor_mantenimiento') AND o.name <> '/maintenance/criticality')
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
