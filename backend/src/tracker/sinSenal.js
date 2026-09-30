// Motivo probable de una unidad "sin señal reciente", para el reporte de
// turno de la app (Excel/PDF/imagen) -- misma logica que motivoSinSenal en
// frontend/src/lib/trackerFormat.js (Estado de Flota), para que el reporte y
// la pantalla digan lo mismo. Pedido de Lguerra, 30/09/2026.

export const horasSinConexion = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / (1000 * 60 * 60);
};

export const formatHoras = (horas) => {
  if (horas == null) return 'sin datos';
  if (horas < 48) return `${horas.toFixed(1)} h`;
  return `${(horas / 24).toFixed(1)} días`;
};

const num = (v) => (v != null && v !== '' ? Number(v) : null);

export function motivoSinSenal(s) {
  const evento = String(s.gps_status_name || '').toLowerCase();
  const vVehiculo = num(s.vehicle_battery);
  const bEquipo = num(s.battery_level);
  const sat = num(s.num_satellite);
  const horas = horasSinConexion(s.last_report_at);
  if (evento.includes('desconex')) return { texto: 'Alimentación del GPS desconectada', detalle: `Último evento del equipo${vVehiculo != null ? ` · batería del vehículo ${vVehiculo} V` : ''}`, tono: 'red' };
  if (vVehiculo === 0) return { texto: 'Sin alimentación del vehículo (0 V)', detalle: 'Batería desconectada o descargada', tono: 'red' };
  if (vVehiculo != null && vVehiculo < 10) return { texto: `Batería del vehículo baja (${vVehiculo} V)`, detalle: 'Revisar batería y conexión del equipo', tono: 'red' };
  if (bEquipo != null && bEquipo <= 15) return { texto: `Batería del equipo GPS agotada (${bEquipo}%)`, detalle: 'El equipo se apaga al quedarse sin su batería interna', tono: 'red' };
  if (s.valid_gps === 'false' || (sat != null && sat < 4)) return { texto: 'Sin cobertura de satélites', detalle: sat != null ? `${sat} satélite(s) en la última lectura` : 'Última posición no válida', tono: 'amber' };
  if (horas != null && horas > 7 * 24) return { texto: 'Equipo apagado o retirado', detalle: 'Más de 7 días sin reportar con batería normal', tono: 'amber' };
  return { texto: 'Posible zona sin cobertura', detalle: 'La última señal fue normal', tono: 'slate' };
}

export const ultimoEstado = (u) => (u.status === 'ACTIVO' ? 'Activa' : 'Estacionada');
