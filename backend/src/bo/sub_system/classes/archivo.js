import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import { TURNOS } from './reporte.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

const RETENTION_MONTHS = Number(process.env.TRACKER_RETENTION_MONTHS || 6);

const pad = (n) => String(n).padStart(2, '0');
const buildWindow = (fecha, turnoDef) => ({
  start: new Date(`${fecha}T${pad(turnoDef.startHour)}:00:00-04:00`),
  end: new Date(`${fecha}T${pad(turnoDef.endHour)}:00:00-04:00`),
});

// Política de retención (Fase 2 ampliada): el detalle crudo de
// tracker_snapshot (una fila por unidad cada 10 min) es útil para
// depuración/análisis reciente, pero crece indefinidamente. Antes de
// borrarlo, se resume a tracker_snapshot_summary (una fila por unidad, por
// fecha y por turno -- exactamente lo que consume el Reporte de Turno), así
// el historial de reportes queda disponible para siempre sin conservar el
// detalle de alta frecuencia para siempre.
class Archivo {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  archivarAhora = async () => {
    await this.dbmsReady;

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
    const cutoffISO = cutoff.toISOString();

    const datesResult = await this.dbms.executeNamedQuery({
      nameQuery: 'getDistinctOldSnapshotDates',
      params: { cutoff: cutoffISO },
    });
    const fechas = (datesResult?.rows || []).map((r) => {
      const d = r.fecha instanceof Date ? r.fecha : new Date(r.fecha);
      return d.toISOString().slice(0, 10);
    });

    let resumidas = 0;
    for (const fecha of fechas) {
      for (const [turno, turnoDef] of Object.entries(TURNOS)) {
        const { start, end } = buildWindow(fecha, turnoDef);

        const rowsResult = await this.dbms.executeNamedQuery({
          nameQuery: 'getSnapshotsInWindow',
          params: { window_start: start.toISOString(), window_end: end.toISOString() },
        });

        for (const row of rowsResult?.rows || []) {
          await this.dbms.executeNamedQuery({
            nameQuery: 'upsertSnapshotSummary',
            params: {
              fecha,
              turno,
              unit_id: row.unit_id ?? null,
              plate: row.plate ?? null,
              gps_name: row.gps_name ?? null,
              location_text: row.location_text ?? null,
              location_category: row.location_category ?? null,
              latitude: row.latitude != null ? Number(row.latitude) : null,
              longitude: row.longitude != null ? Number(row.longitude) : null,
              speed: row.speed != null ? Number(row.speed) : null,
              ignition: row.ignition ?? null,
              status: row.status ?? null,
              is_stale: row.is_stale ?? null,
              last_report_at: row.last_report_at ? new Date(row.last_report_at).toISOString() : null,
            },
          });
          resumidas += 1;
        }
      }
    }

    const deleteResult = await this.dbms.executeNamedQuery({
      nameQuery: 'deleteOldSnapshots',
      params: { cutoff: cutoffISO },
    });

    return {
      statusCode: STATUS_CODES.OK,
      data: {
        fechas_procesadas: fechas.length,
        filas_resumidas: resumidas,
        filas_crudas_eliminadas: deleteResult?.rowCount ?? 0,
        limite_retencion: cutoffISO,
      },
      message: `Archivado completo: ${fechas.length} fecha(s) resumidas, ${deleteResult?.rowCount ?? 0} filas crudas mayores a ${RETENTION_MONTHS} mes(es) eliminadas`,
    };
  };
}

export default Archivo;
