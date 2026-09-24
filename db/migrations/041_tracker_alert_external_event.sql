-- Alertas de entrada/salida de geocerca tomadas de GEvolution (pedido de
-- Lguerra, 22/09/2026): reemplazan a la alerta propia de "fuera de geocerca"
-- (perimetro global). GEvolution ya detecta cada entrada y salida en tiempo
-- real; aqui solo se guarda el id de su evento (EventNotificationID) para no
-- notificar el mismo evento dos veces entre una revision y la siguiente.
ALTER TABLE public.tracker_alert ADD COLUMN IF NOT EXISTS external_event_id VARCHAR(30);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracker_alert_external_event
  ON public.tracker_alert(external_event_id)
  WHERE external_event_id IS NOT NULL;
