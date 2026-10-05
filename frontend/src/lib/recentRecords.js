// Listados de llenados (Flota Liviana / Pesada): sin ningún filtro activo se
// muestran solo los últimos RECENT_LIMIT registros -- con meses de datos,
// pintar todo de golpe es lento y nadie scrollea cientos de filas. En cuanto
// se filtra por fecha, unidad o responsable se muestran todas las
// coincidencias. Asume `records` ya ordenado del más reciente al más antiguo
// (así lo devuelven getAllCargas / getAllPesada).
export const RECENT_LIMIT = 50;

export function limitToRecent(records, filtersActive) {
  if (filtersActive || records.length <= RECENT_LIMIT) {
    return { visible: records, limited: false, total: records.length };
  }
  return { visible: records.slice(0, RECENT_LIMIT), limited: true, total: records.length };
}
