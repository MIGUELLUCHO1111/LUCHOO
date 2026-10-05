// Umbral de aviso de tanque bajo: al llegar a este porcentaje de su
// capacidad (o menos) el tanque se considera "por llenar" y se notifica.
export const LOW_TANK_PERCENT = 25;

// Evento que emite fuelService tras cualquier operación que mueva litros del
// tanque (llenados, movimientos, edición de tanque), para que la alerta
// global se refresque sin esperar al siguiente sondeo.
export const TANKS_CHANGED_EVENT = "fuel:tanks-changed";

export function tankPercent(tank) {
  const capacity = Number(tank?.capacity_liters) || 0;
  if (capacity <= 0) return 0;
  const level = Number(tank?.current_level_liters) || 0;
  return Math.min(100, Math.max(0, (level / capacity) * 100));
}

export function isTankLow(tank) {
  return Number(tank?.capacity_liters) > 0 && tankPercent(tank) <= LOW_TANK_PERCENT;
}

export function notifyTanksChanged() {
  window.dispatchEvent(new Event(TANKS_CHANGED_EVENT));
}
