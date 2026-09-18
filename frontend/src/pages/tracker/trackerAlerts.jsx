import { useState, useEffect, useCallback, Fragment } from "react";
import { BellRing, RefreshCw, MapPin, Route } from "lucide-react";
import { trackerService, resolveReportFileUrl } from "@/services";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PageLayout } from "@/components/layout/PageLayout";
import RecorridosPanel from "@/components/TrackerMap/RecorridosPanel";
import { formatHora, formatFechaISO, TURNOS, fleetTypeLabel, fleetTypeBadgeClass } from "@/lib/trackerFormat";

// Dos apartados de la misma pantalla de Notificaciones: lo que se generó
// como Alarma y lo que se generó como Reporte de Turno enviado a Telegram
// -- cada uno con su propio historial, para poder comparar contra lo que
// realmente llegó al chat.
const SEGMENTS = [
  { key: "alarmas", label: "Alarmas" },
  { key: "reportes", label: "Reporte enviado a Telegram" },
];

const TrackerAlerts = () => {
  const [segment, setSegment] = useState("alarmas");

  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  // Recorridos (pedido de Lguerra, 18/09/2026): ver los viajes del día de
  // la unidad de una alerta, sin tener que ir a buscarla aparte en Mapa en
  // Vivo -- ayuda a entender qué hizo la unidad ese día. Sin mapa en esta
  // pantalla, así que RecorridosPanel no recibe onVerRuta (oculta esa
  // columna sola). Se despliega justo debajo de la fila de esa alerta (no
  // uno solo compartido al final de la tabla) -- pedido explicito, 18/09/2026.
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const toggleRecorridos = (id) => setExpandedAlertId((prev) => (prev === id ? null : id));

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const res = await trackerService.getRecentAlerts();
      setAlerts(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando alertas:", err);
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const [reportFiles, setReportFiles] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const loadReportFiles = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await trackerService.listarReportesGenerados({ limit: 90 });
      setReportFiles(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando reportes enviados a Telegram:", err);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    loadReportFiles();
  }, [loadReportFiles]);

  const activas = alerts.filter((a) => !a.resolved_at).length;
  const enviadosATelegram = reportFiles.filter((f) => f.telegram_sent).length;
  const isAlarmas = segment === "alarmas";

  return (
    <PageLayout icon={BellRing} title="Notificaciones" subtitle="TRACKER GPS DE FLOTA" accentColor="orange">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSegment(s.key)}
              className={`px-4 py-2 text-sm font-bold transition-colors ${
                segment === s.key
                  ? "bg-orange-500 text-white"
                  : "bg-white dark:bg-[#0f1115] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button
          onClick={isAlarmas ? loadAlerts : loadReportFiles}
          variant="outline"
          className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 text-sm self-start md:self-auto"
        >
          <RefreshCw size={16} />
          Actualizar
        </Button>
      </div>

      {isAlarmas ? (
        <>
          <div className="flex gap-4 mb-6">
            <Card className="px-5 py-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Total alertas</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{alerts.length}</div>
            </Card>
            <Card className="px-5 py-3 border-red-200 dark:border-red-500/20">
              <div className="text-[11px] font-bold text-red-600 uppercase">Activas ahora</div>
              <div className="text-2xl font-black text-red-600">{activas}</div>
            </Card>
          </div>

          <Card className="w-full overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Flota</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mensaje</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Notificada</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Recorridos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAlerts ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-400">Cargando...</TableCell>
                  </TableRow>
                ) : alerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                      Sin alertas registradas todavía
                    </TableCell>
                  </TableRow>
                ) : (
                  alerts.map((a, i) => (
                    <Fragment key={a.id}>
                    <TableRow className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                      <TableCell className="text-sm whitespace-nowrap">{formatHora(a.triggered_at)}</TableCell>
                      <TableCell className="text-sm">{a.unit_code || a.plate || "-"}</TableCell>
                      <TableCell className="text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${fleetTypeBadgeClass(a.fleet_type)}`}>
                          {fleetTypeLabel(a.fleet_type)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-orange-500/10 text-orange-600">
                          {a.alert_type === "fuera_de_horario" ? "Fuera de horario" : "Fuera de zona"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs max-w-md whitespace-pre-line text-slate-500 dark:text-slate-400">
                        {a.message}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {a.latitude != null && a.longitude != null ? (
                          <a
                            href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-orange-600 hover:underline"
                          >
                            <MapPin size={13} />
                            Ver ubicación
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${a.notified ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                          {a.notified ? "Sí" : "No"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${a.resolved_at ? "bg-slate-500/10 text-slate-500" : "bg-red-500/10 text-red-600"}`}>
                          {a.resolved_at ? "Resuelta" : "Activa"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {a.gps_unit_id != null ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className={`h-8 w-8 rounded-lg ${expandedAlertId === a.id ? "bg-blue-500 text-white hover:bg-blue-600" : ""}`}
                            onClick={() => toggleRecorridos(a.id)}
                          >
                            <Route size={14} />
                          </Button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedAlertId === a.id && (
                      <TableRow>
                        <TableCell colSpan={9} className="p-0 border-0">
                          <div className="p-4 bg-slate-50/60 dark:bg-white/[0.02]">
                            <RecorridosPanel
                              unit={{ gps_unit_id: a.gps_unit_id, unit_code: a.unit_code, plate: a.plate }}
                              onClose={() => setExpandedAlertId(null)}
                              desde={a.triggered_at}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        <>
          <div className="flex gap-4 mb-6">
            <Card className="px-5 py-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Reportes generados</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{reportFiles.length}</div>
            </Card>
            <Card className="px-5 py-3 border-emerald-200 dark:border-emerald-500/20">
              <div className="text-[11px] font-bold text-emerald-600 uppercase">Enviados a Telegram</div>
              <div className="text-2xl font-black text-emerald-600">{enviadosATelegram}</div>
            </Card>
          </div>

          <Card className="w-full overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Generado</TableHead>
                  <TableHead>Enviado a Telegram</TableHead>
                  <TableHead className="text-right">PDF enviado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingReports ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400">Cargando...</TableCell>
                  </TableRow>
                ) : reportFiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                      Todavía no se ha generado ningún reporte de turno
                    </TableCell>
                  </TableRow>
                ) : (
                  reportFiles.map((f, i) => (
                    <TableRow key={f.id} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                      <TableCell className="text-sm font-mono">{formatFechaISO(f.fecha)}</TableCell>
                      <TableCell className="text-sm font-bold">{TURNOS[f.turno]?.label || f.turno}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatHora(f.generated_at)}</TableCell>
                      <TableCell className="text-sm">
                        <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${f.telegram_sent ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-500"}`}>
                          {f.telegram_sent ? "Sí" : "No"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {f.url_pdf ? (
                          <a href={resolveReportFileUrl(f.url_pdf)} target="_blank" rel="noreferrer">
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg text-[9px] font-bold">
                              PDF
                            </Button>
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 max-w-2xl">
            Este es el mismo PDF que llega al chat de Telegram en cada cierre de turno — sirve para
            comprobar que lo que llegó ahí es exactamente lo que quedó registrado aquí. El historial
            completo, con Excel e imagen también, está en Reportes de Turno Generados.
          </p>
        </>
      )}
    </PageLayout>
  );
};

export default TrackerAlerts;
