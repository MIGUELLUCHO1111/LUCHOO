-- Suscriptores del bot de Telegram CON APROBACION (pedido de Lguerra,
-- 24/09/2026): antes, cualquiera que le escribiera al bot quedaba suscrito
-- solo y empezaba a recibir ubicaciones, placas y reportes de la flota.
-- Ahora quien escribe queda PENDIENTE (no recibe nada) hasta que alguien lo
-- apruebe en la app (Notificaciones -> Suscriptores de Telegram), y se le
-- puede quitar el acceso (BLOQUEADO) en cualquier momento. is_active se
-- mantiene como el interruptor real que lee TelegramClient (ACTIVO <=> TRUE).
ALTER TABLE public.tracker_telegram_subscriber
  ADD COLUMN IF NOT EXISTS status VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Los que ya estaban activos antes de este cambio siguen activos (idempotente:
-- solo toca filas que siguen en el valor por defecto y estaban activas).
UPDATE public.tracker_telegram_subscriber
  SET status = 'ACTIVO'
  WHERE status = 'PENDIENTE' AND is_active = TRUE;

ALTER TABLE public.tracker_telegram_subscriber ALTER COLUMN is_active SET DEFAULT FALSE;
