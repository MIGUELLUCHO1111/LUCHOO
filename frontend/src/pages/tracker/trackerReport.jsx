import { useState, useEffect, useCallback, useRef } from "react";
import { FileSpreadsheet, Download, Archive, BarChart3, Paperclip, Upload, Trash2, ExternalLink, Send } from "lucide-react";
import { trackerService, resolveAttachmentUrl } from "@/services";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BarList } from "@/components/ui/barList";
import { Donut } from "@/components/ui/donut";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PageLayout } from "@/components/layout/PageLayout";
import { CATEGORY_STYLES, formatHora, TURNOS, detectTurnoActual, veTodayISO } from "@/lib/trackerFormat";
import { exportToExcel, fmtDate } from "@/lib/excel";
import { useConfirm } from "@/context";

const TrackerReport = () => {
  const confirm = useConfirm();
  const fileInputRef = useRef(null);

  const [fecha, setFecha] = useState(veTodayISO());
  const [turno, setTurno] = useState(detectTurnoActual() || "MATUTINO");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [archiving, setArchiving] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState(null);

  const [notifying, setNotifying] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState(null);
  const [checkingAnexo, setCheckingAnexo] = useState(false);
  const [anexoMessage, setAnexoMessage] = useState(null);

  const [analisis, setAnalisis] = useState(null);
  const [loadingAnalisis, setLoadingAnalisis] = useState(false);
  const [analisisError, setAnalisisError] = useState(null);

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const isNocturno = turno === "NOCTURNO";

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await trackerService.generarReporte({ fecha, turno });
      setReport(res);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Error al generar el reporte");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [fecha, turno]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const loadAttachments = useCallback(async () => {
    try {
      const res = await trackerService.getAttachments(fecha);
      setAttachments(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando anexos:", err);
    }
  }, [fecha]);

  useEffect(() => {
    setAnalisis(null);
    setAnalisisError(null);
    loadAttachments();
  }, [fecha, loadAttachments]);

  const handleGenerarAnalisis = async () => {
    setLoadingAnalisis(true);
    setAnalisisError(null);
    try {
      const res = await trackerService.getAnalisisDelDia({ fecha });
      setAnalisis(res);
    } catch (err) {
      setAnalisisError(err.response?.data?.message || err.message || "Error al generar el análisis");
    } finally {
      setLoadingAnalisis(false);
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await trackerService.uploadAttachment({ fecha, tipo: "seguridad", file });
      await loadAttachments();
    } catch (err) {
      console.error("Error subiendo anexo:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleNotify = async () => {
    setNotifying(true);
    setNotifyMessage(null);
    try {
      const res = await trackerService.notificarCierreDeTurno({ fecha, turno });
      setNotifyMessage(res.sent ? "Enviado a Telegram ✓" : `No se pudo enviar: ${res.reason || "desconocido"}`);
    } catch (err) {
      setNotifyMessage(err.response?.data?.message || err.message || "Error al notificar");
    } finally {
      setNotifying(false);
    }
  };

  const handleCheckAnexo = async () => {
    setCheckingAnexo(true);
    setAnexoMessage(null);
    try {
      const res = await trackerService.verificarAnexoSeguridad({ fecha });
      setAnexoMessage(res.yaSubido ? "Ya estaba subido, no se envió nada" : res.sent ? "Recordatorio enviado a Telegram ✓" : `No se pudo enviar: ${res.reason || "desconocido"}`);
    } catch (err) {
      setAnexoMessage(err.response?.data?.message || err.message || "Error al verificar");
    } finally {
      setCheckingAnexo(false);
    }
  };

  const handleDeleteAttachment = async (id) => {
    const ok = await confirm("¿Eliminar este anexo?", { title: "Eliminar anexo" });
    if (!ok) return;
    try {
      await trackerService.deleteAttachment(id);
      await loadAttachments();
    } catch (err) {
      console.error("Error eliminando anexo:", err);
    }
  };

  const handleExport = () => {
    if (!report) return;
    const headers = ["Unidad", "Placa", "Conductor", "Ubicación", "Categoría", "Hora", "Estado"];
    const rows = report.unidades.map((u) => [
      u.unit_code || "sin registrar",
      u.plate || "-",
      u.driver_name || "-",
      u.location_text || "-",
      u.location_category || "-",
      formatHora(u.last_report_at),
      u.status,
    ]);
    exportToExcel({
      fileName: `Reporte_Tracker_${report.turno}_${report.fecha}`,
      sheetName: report.turno,
      headers,
      rows,
      totals: ["", "", "", "", "", "Total:", `${report.total} (${report.activas} activas / ${report.estacionadas} estacionadas)`],
    });
  };

  const handleArchive = async () => {
    setArchiving(true);
    setArchiveMessage(null);
    try {
      const res = await trackerService.archivarAhora();
      setArchiveMessage(
        `${res.fechas_procesadas} fecha(s) resumidas · ${res.filas_resumidas} filas de resumen · ${res.filas_crudas_eliminadas} filas crudas eliminadas`
      );
    } catch (err) {
      setArchiveMessage(err.response?.data?.message || err.message || "Error al archivar");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <PageLayout icon={FileSpreadsheet} title="Reporte de Turno" subtitle="TRACKER GPS DE FLOTA" accentColor="orange">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
          />
          <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            {Object.entries(TURNOS).map(([key, def]) => (
              <button
                key={key}
                onClick={() => setTurno(key)}
                className={`px-4 py-2 text-sm font-bold transition-colors ${
                  turno === key
                    ? "bg-orange-500 text-white"
                    : "bg-white dark:bg-[#0f1115] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                }`}
              >
                {def.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleExport}
          disabled={!report || report.unidades.length === 0}
          className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-orange-500 hover:bg-orange-600 text-white text-sm disabled:opacity-40"
        >
          <Download size={16} />
          Exportar a Excel
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Generando reporte...</div>
      ) : report ? (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              🚚 TRACKER DE FLOTA — REPORTE {report.turno}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              FECHA: {fmtDate(report.fecha)} · CORTE: TURNO {report.turno} ({TURNOS[report.turno]?.ventana})
            </p>
          </div>

          <div className="flex gap-4 mb-6">
            <Card className="px-5 py-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Total unidades</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{report.total}</div>
            </Card>
            <Card className="px-5 py-3 border-emerald-200 dark:border-emerald-500/20">
              <div className="text-[11px] font-bold text-emerald-600 uppercase">Activas</div>
              <div className="text-2xl font-black text-emerald-600">{report.activas}</div>
            </Card>
            <Card className="px-5 py-3 border-red-200 dark:border-red-500/20">
              <div className="text-[11px] font-bold text-red-600 uppercase">Estacionadas</div>
              <div className="text-2xl font-black text-red-600">{report.estacionadas}</div>
            </Card>
          </div>

          <Card className="w-full overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.unidades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                      Sin lecturas registradas todavía en esta ventana de turno
                    </TableCell>
                  </TableRow>
                ) : (
                  report.unidades.map((u, i) => (
                    <TableRow key={u.id} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                      <TableCell className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        {u.unit_code || <span className="italic text-slate-400 font-normal">sin registrar</span>}
                      </TableCell>
                      <TableCell className="text-sm">{u.plate || "-"}</TableCell>
                      <TableCell className="text-sm">{u.driver_name || "-"}</TableCell>
                      <TableCell className="text-sm max-w-xs">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${CATEGORY_STYLES[u.location_category] || CATEGORY_STYLES.OTRAS}`}>
                            {u.location_category}
                          </span>
                          <span className="truncate">{u.location_text || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatHora(u.last_report_at)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${u.status === "ACTIVO" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                          {u.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : null}

      {isNocturno && (
        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
              <BarChart3 size={16} className="text-orange-500" />
              Análisis Operativo y Comportamiento de Conductores
            </h3>
            <Button
              onClick={handleGenerarAnalisis}
              disabled={loadingAnalisis}
              variant="outline"
              className="rounded-xl font-bold text-sm h-9 px-4"
            >
              {loadingAnalisis ? "Consultando la API (puede tardar 1-2 min)..." : analisis ? "Actualizar análisis" : "Generar análisis del día"}
            </Button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 max-w-2xl">
            Se anexa al cierre del día: reemplaza el flujo manual de descargar el Excel de viajes y subirlo a
            Colab -- consulta la API de Foresight unidad por unidad y calcula lo mismo automáticamente.
          </p>

          {analisisError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
              {analisisError}
            </div>
          )}

          {analisis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-5">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-4">Top 10 — Mayor Distancia Recorrida</h4>
                <BarList items={analisis.top_distancia} valueKey="km" labelKey="unidad" unit=" km" color="#3b82f6" emptyLabel="Sin viajes registrados" />
              </Card>

              <Card className="p-5">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-4">Top Unidades — Excesos de Velocidad</h4>
                <BarList
                  items={analisis.top_excesos_velocidad}
                  valueKey="cantidad"
                  labelKey="unidad"
                  unit=" ev"
                  color="#ef4444"
                  emptyLabel={
                    analisis.eventos_totales === 0
                      ? "La API no devolvió eventos para esta fecha (ver nota de acceso pendiente con el proveedor)"
                      : "Sin excesos de velocidad registrados"
                  }
                />
              </Card>

              <Card className="p-5">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-4">Top 10 — Mayor Tiempo en Ralentí</h4>
                <BarList items={analisis.top_ralenti} valueKey="ralenti" labelKey="unidad" unit=" h" color="#d65a47" emptyLabel="Sin datos de ralentí" />
              </Card>

              <Card className="p-5 flex flex-col items-center justify-center">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 self-start">
                  Distribución de Viajes ({analisis.total_viajes} total)
                </h4>
                <Donut
                  segments={[
                    { label: "Diurnos", value: analisis.viajes_diurnos, color: "#f39c12" },
                    { label: "Nocturnos", value: analisis.viajes_nocturnos, color: "#34495e" },
                    { label: "Mixtos", value: analisis.viajes_mixtos, color: "#2ecc71" },
                  ].filter((s) => s.value > 0)}
                  centerLabel="Viajes"
                  centerValue={analisis.total_viajes}
                />
              </Card>
            </div>
          )}
        </div>
      )}

      {isNocturno && (
        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-white/10">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2">
            <Paperclip size={16} className="text-orange-500" />
            Anexos del día
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 max-w-2xl">
            El Dashboard de Seguridad de la plataforma (excesos de velocidad, frenadas/giros bruscos) solo se
            puede exportar como PDF/imagen, no como datos -- súbelo aquí para que quede junto al reporte del día.
          </p>

          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileSelected} />

          <div className="flex items-center gap-3 mb-4">
            <Button
              onClick={handleUploadClick}
              disabled={uploading}
              className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-orange-500 hover:bg-orange-600 text-white text-sm"
            >
              <Upload size={16} />
              {uploading ? "Subiendo..." : "Subir Dashboard de Seguridad (PDF)"}
            </Button>
          </div>

          {attachments.length > 0 && (
            <Card className="w-full overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Subido</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attachments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{a.filename}</TableCell>
                      <TableCell className="text-sm capitalize">{a.tipo}</TableCell>
                      <TableCell className="text-sm">{formatHora(a.uploaded_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a href={resolveAttachmentUrl(a.url)} target="_blank" rel="noreferrer">
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg">
                              <ExternalLink size={14} />
                            </Button>
                          </a>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDeleteAttachment(a.id)}
                            className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-slate-200 dark:border-white/10">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Mantenimiento</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 max-w-2xl">
          El detalle de cada 10 minutos se conserva {" "}
          <span className="font-bold">unos meses</span> y luego se resume automáticamente (una fila por
          unidad, por turno y por día) para que el Reporte de Turno siga funcionando hacia atrás sin límite
          de tiempo. Esto corre solo, todas las madrugadas. Este botón es solo para probarlo ahora mismo.
        </p>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleArchive}
            disabled={archiving}
            variant="outline"
            className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 text-sm"
          >
            <Archive size={16} className={archiving ? "animate-pulse" : ""} />
            {archiving ? "Archivando..." : "Archivar historial antiguo ahora"}
          </Button>
          {archiveMessage && <p className="text-xs text-slate-500 dark:text-slate-400">{archiveMessage}</p>}
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 mt-6 mb-3 max-w-2xl">
          Al cierre de cada turno (10:05am, 3:05pm, 10:05pm) se envía solo un resumen a Telegram, y a las
          10:15pm un recordatorio si falta subir el PDF de seguridad. Estos botones son solo para probarlo ahora mismo.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleNotify}
            disabled={notifying}
            variant="outline"
            className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 text-sm"
          >
            <Send size={16} className={notifying ? "animate-pulse" : ""} />
            {notifying ? "Enviando..." : `Notificar cierre de ${turno.toLowerCase()} ahora`}
          </Button>
          {notifyMessage && <p className="text-xs text-slate-500 dark:text-slate-400">{notifyMessage}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Button
            onClick={handleCheckAnexo}
            disabled={checkingAnexo}
            variant="outline"
            className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 text-sm"
          >
            <Send size={16} className={checkingAnexo ? "animate-pulse" : ""} />
            {checkingAnexo ? "Verificando..." : "Verificar anexo de seguridad ahora"}
          </Button>
          {anexoMessage && <p className="text-xs text-slate-500 dark:text-slate-400">{anexoMessage}</p>}
        </div>
      </div>
    </PageLayout>
  );
};

export default TrackerReport;
