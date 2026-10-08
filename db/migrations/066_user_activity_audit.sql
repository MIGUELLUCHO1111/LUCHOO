-- ============================================================
-- 066_user_activity_audit.sql
-- Seguridad > Actividad de usuarios (pedido de Julio, 08/10/2026): cuándo
-- entró cada usuario por última vez y una auditoría pequeña de uso, para
-- saber quién está usando el sistema y cómo.
--
-- Se registra (backend/src/security/activityTracker.js):
--   * user.last_login_at / last_seen_at / last_ip: último inicio de sesión,
--     última actividad (cualquier petición con sesión) y desde qué IP.
--   * user_session_event: inicios de sesión correctos y fallidos (con el
--     nombre de usuario que se intentó), cierres de sesión (a mano o por
--     inactividad) y entradas bloqueadas de usuarios desactivados.
--   * user_activity_daily: por usuario y día, primera y última actividad,
--     cuántas acciones hizo, cuántas fueron de escritura (crear, editar,
--     eliminar) y en qué módulos.
-- Se guarda por lotes (una vez por minuto), no en cada clic, y se borra lo
-- de más de 180 días (USER_AUDIT_RETENTION_DAYS).
-- ============================================================

BEGIN;

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_ip VARCHAR(64);

CREATE TABLE IF NOT EXISTS public.user_session_event (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES public."user"(id) ON DELETE SET NULL,
  username VARCHAR(150),
  event VARCHAR(20) NOT NULL,
  ip VARCHAR(64),
  user_agent VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_user_session_event_type CHECK (event IN ('LOGIN_OK', 'LOGIN_FAIL', 'LOGIN_BLOCKED', 'LOGOUT', 'LOGOUT_IDLE'))
);
CREATE INDEX IF NOT EXISTS idx_user_session_event_user ON public.user_session_event(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_session_event_created ON public.user_session_event(created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_activity_daily (
  user_id BIGINT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  actions INTEGER NOT NULL DEFAULT 0,
  writes INTEGER NOT NULL DEFAULT 0,
  modules TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, fecha)
);
CREATE INDEX IF NOT EXISTS idx_user_activity_daily_fecha ON public.user_activity_daily(fecha);

INSERT INTO public.option (name, description) VALUES ('/security/activity', 'Seguridad - Actividad de usuarios')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.option_profile (profile_id, option_id)
SELECT p.id, o.id FROM public.profile p JOIN public.option o ON o.name = '/security/activity'
WHERE p.name = 'admin'
ON CONFLICT (profile_id, option_id) DO NOTHING;

COMMIT;
