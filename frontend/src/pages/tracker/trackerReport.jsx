import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FileSpreadsheet, Download, Archive, BarChart3, Paperclip, Upload, Trash2, ExternalLink, Send, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { trackerService, resolveAttachmentUrl, resolveReportFileUrl } from "@/services";
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
import { formatHora, formatFechaISO, TURNOS, detectTurnoActual, veTodayISO } from "@/lib/trackerFormat";
import { useConfirm } from "@/context";

// Los DATE de Postgres llegan como ISO con hora (medianoche UTC) -- esto se
// queda solo con "YYYY-MM-DD" para comparar/usar como parámetro de fecha.
const fechaSlice = (value) => String(value || "").slice(0, 10);

const TrackerReport = () => {
  const confirm = useConfirm();
  const fileInputRef = useRef(null);

  const [turno, setTurno] = useState(detectTurnoActual() || "MATUTINO");
  const [fechaFiltro, setFechaFiltro] = useState("");

  const [reportFiles, setReportFiles] = useState([]);
  const [loadingReportFiles, setLoadingReportFiles] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState(null);

  const [expandedId, setExpandedId] = useState(null);

  const [analisis, setAnalisis] = useState(null);
  const [loadingAnalisis, setLoadingAnalisis] = useState(false);
  const [analisisError, setAnalisisError] = useState(null);

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [archiving, setArchiving] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState(null);

  const [checkingAnexo, setCheckingAnexo] = useState(false);
  const [anexoMessage, setAnexoMessage] = useState(null);

  const isNocturno = turno === "NOCTURNO";

  const loadReportFiles = useCallback(async () => {
    setLoadingReportFiles(true);
    try {
      const res = await trackerService.listarReportesGenerados({ limit: 90 });
      setReportFiles(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando el historial de reportes:", err);
    } finally {
      setLoadingReportFiles(false);
    }
  }, []);

  useEffect(() => {
    loadReportFiles();
  }, [loadReportFiles]);

  // El historial completo se trae una sola vez; la pestaña de turno y el
  // filtro de fecha son solo un recorte en memoria -- así cambiar de pestaña
  // no dispara otra consulta.
  const filteredReportFiles = useMemo(
    () =>
      reportFiles.filter(
        (f) => f.turno === turno && (!fechaFiltro || fechaSlice(f.fecha) === fechaFiltro)
      ),
    [reportFiles, turno, fechaFiltro]
  );

  const expandedFecha = useMemo(() => {
    const row = reportFiles.find((f) => f.id === expandedId);
    return row ? fechaSlice(row.fecha) : null;
  }, [reportFiles, expandedId]);

  const loadAttachments = useCallback(async (fecha) => {
    if (!fecha) return;
    try {
      const res = await trackerService.getAttachments(fecha);
      setAttachments(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando anexos:", err);
    }
  }, []);

  // Análisis y anexos son del reporte que esté expandido (Nocturno) -- al
  // cambiar de fila expandida, se limpia lo anterior y se recarga lo de esta.
  useEffect(() => {
    setAnalisis(null);
    setAnalisisError(null);
    setAttachments([]);
    if (expandedFecha) loadAttachments(expandedFecha);
  }, [expandedFecha, loadAttachments]);

  const handleToggleExpand = (fileId) => {
    setExpandedId((prev) => (prev === fileId ? null : fileId));
  };

  const handleTurnoChange = (key) => {
    setTurno(key);
    setExpandedId(null);
  };

  const handleGenerarAnalisis = async () => {
    if (!expandedFecha) return;
    setLoadingAnalisis(true);
    setAnalisisError(null);
    try {
      const res = await trackerService.getAnalisisDelDia({ fecha: expandedFecha });
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
    if (!file || !expandedFecha) return;
    setUploading(true);
    try {
      await trackerService.uploadAttachment({ fecha: expandedFecha, tipo: "seguridad", file });
      await loadAttachments(expandedFecha);
    } catch (err) {
      console.error("Error subiendo anexo:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (id) => {
    const ok = await confirm("¿Eliminar este anexo?", { title: "Eliminar anexo" });
    if (!ok) return;
    try {
      await trackerService.deleteAttachment(id);
      await loadAttachments(expandedFecha);
    } catch (err) {
      console.error("Error eliminando anexo:", err);
    }
  };

  // Respaldo manual: genera (o regenera) el reporte del turno/fecha elegidos
  // sin esperar a la hora programada -- mismo camino que corre solo al
  // cerrarse el turno (guarda el Excel, lo deja en el historial y lo manda
  // por Telegram).
  const handleGenerarAhora = async () => {
    setGenerating(true);
    setGenerateMessage(null);
    try {
      const fecha = fechaFiltro || veTodayISO();
      const res = await trackerService.notificarCierreDeTurno({ fecha, turno });
      setGenerateMessage(
        res.sent
          ? "Generado y enviado a Telegram ✓"
          : `Generado, pero no se pudo enviar a Telegram: ${res.reason || "desconocido"}`
      );
      await loadReportFiles();
    } catch (err) {
      setGenerateMessage(err.response?.data?.message || err.message || "Error al generar el reporte");
    } finally {
      setGenerating(false);
    }
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

  const handleCheckAnexo = async () => {
    setCheckingAnexo(true);
    setAnexoMessage(null);
    try {
      const res = await trackerService.verificarAnexoSeguridad({});
      setAnexoMessage(res.yaSubido ? "Ya estaba subido, no se envió nada" : res.sent ? "Recordatorio enviado a Telegram ✓" : `No se pudo enviar: ${res.reason || "desconocido"}`);
    } catch (err) {
      setAnexoMessage(err.response?.data?.message || err.message || "Error al verificar");
    } finally {
      setCheckingAnexo(false);
    }
  };

  const colSpan = isNocturno ? 6 : 5;

  return (
    <PageLayout icon={FileSpreadsheet} title="Reportes de Turno Generados" subtitle="TRACKER GPS DE FLOTA" accentColor="orange">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
            title="Filtrar por fecha"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
          />
          <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            {Object.entries(TURNOS).map(([key, def]) => (
              <button
                key={key}
                onClick={() => handleTurnoChange(key)}
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

        <div className="flex flex-col items-end gap-2">
          <Button
            onClick={handleGenerarAhora}
            disabled={generating}
            variant="outline"
            className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 text-sm"
          >
            <Send size={16} className={generating ? "animate-pulse" : ""} />
            {generating ? "Generando..." : "Generar ahora"}
          </Button>
          {generateMessage && <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs text-right">{generateMessage}</p>}
        </div>
      </div>

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            🚚 REPORTES GENERADOS — {TURNOS[turno]?.label?.toUpperCase() || turno}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            CORTE: TURNO {turno} ({TURNOS[turno]?.ventana}) · {filteredReportFiles.length} reporte(s) guardado(s)
            {fechaFiltro ? ` en ${formatFechaISO(fechaFiltro)}` : ""}
          </p>
        </div>
        <Button onClick={loadReportFiles} variant="outline" className="rounded-xl font-bold flex items-center gap-2 px-4 h-9 text-sm self-start md:self-auto">
          <RefreshCw size={14} />
          Actualizar
        </Button>
      </div>

      <Card className="w-full overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Total / Activas / Estac.</TableHead>
              <TableHead>Generado</TableHead>
              <TableHead>Telegram</TableHead>
              <TableHead className="text-right">Descargar</TableHead>
              {isNocturno && <TableHead className="text-right">Detalle</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingReportFiles ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-8 text-slate-400">Cargando...</TableCell>
              </TableRow>
            ) : filteredReportFiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-8 text-slate-400">
                  Todavía no hay reportes de este turno{fechaFiltro ? " en esa fecha" : ""} — aparecerán aquí en cuanto cierre, o usa "Generar ahora"
                </TableCell>
              </TableRow>
            ) : (
              filteredReportFiles.map((f, i) => {
                const expanded = expandedId === f.id;
                return (
                  <Fragment key={f.id}>
                    <TableRow className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                      <TableCell className="text-sm font-mono">{formatFechaISO(f.fecha)}</TableCell>
                      <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                        {f.total} / {f.activas} / {f.estacionadas}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatHora(f.generated_at)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${f.telegram_sent ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-500"}`}>
                          {f.telegram_sent ? "Enviado" : "No enviado"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <a href={resolveReportFileUrl(f.url)} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg">
                            <Download size={14} />
                          </Button>
                        </a>
                      </TableCell>
                      {isNocturno && (
                        <TableCell className="text-right">
                          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleToggleExpand(f.id)}>
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>

                    {isNocturno && expanded && (
                      <TableRow>
                        <TableCell colSpan={colSpan} className="bg-slate-50/60 dark:bg-white/[0.02] p-0">
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                                <BarChart3 size={16} className="text-orange-500" />
                                Análisis Operativo y Comportamiento de Conductores — {formatFechaISO(f.fecha)}
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
                              Reemplaza el flujo manual de descargar el Excel de viajes y subirlo a Colab -- consulta
                              la API de Foresight unidad por unidad y calcula lo mismo automáticamente.
                            </p>

                            {analisisError && (
                              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                                {analisisError}
                              </div>
                            )}

                            {analisis && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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

                            <div className="pt-6 border-t border-slate-200 dark:border-white/10">
                              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2">
                                <Paperclip size={16} className="text-orange-500" />
                                Anexos del día
                              </h3>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 max-w-2xl">
                                El Dashboard de Seguridad de la plataforma (excesos de velocidad, frenadas/giros bruscos)
                                solo se puede exportar como PDF/imagen, no como datos -- súbelo aquí para que quede
                                junto al reporte de este día.
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
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-10 pt-6 border-t border-slate-200 dark:border-white/10">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Mantenimiento</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 max-w-2xl">
          El detalle de cada 10 minutos se conserva <span className="font-bold">unos meses</span> y luego se
          resume automáticamente (una fila por unidad, por turno y por día) para que estos reportes sigan
          funcionando hacia atrás sin límite de tiempo. Esto corre solo, todas las madrugadas.
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
          Al cierre de cada turno (9:05am, 2:05pm, 9:05pm) el reporte se genera solo, queda en el historial de
          arriba y se envía a Telegram con el archivo adjunto -- si hace falta uno antes de la hora programada,
          usa "Generar ahora". A las 10:15pm se envía un recordatorio por Telegram si falta subir el PDF de
          seguridad del día.
        </p>
        <div className="flex flex-wrap items-center gap-3">
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
