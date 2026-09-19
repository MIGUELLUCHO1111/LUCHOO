-- ============================================================
-- 017_tracker_telegram_subscribers.sql
-- Suscriptores del bot de Telegram del Tracker GPS: cualquiera que le
-- escriba al bot queda registrado automáticamente (ver
-- telegramSubscriberSync.js) y recibe las alertas/avisos, sin necesidad
-- de editar el .env a mano cada vez que se suma una persona nueva.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tracker_telegram_subscriber (
  id BIGSERIAL PRIMARY KEY,
  chat_id VARCHAR(30) UNIQUE NOT NULL,
  username VARCHAR(100),
  first_name VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Los dos que ya le habían escrito al bot antes de que existiera este
-- registro automático.
INSERT INTO public.tracker_telegram_subscriber (chat_id, username, first_name) VALUES
  ('7845395603', 'lg100991', 'LUCHO'),
  ('8058092682', 'miguellucho1111', 'LG')
ON CONFLICT (chat_id) DO NOTHING;

COMMIT;
