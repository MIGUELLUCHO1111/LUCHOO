import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { hoursService } from "@/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PageLayout } from "@/components/layout/PageLayout";
import { useAuth, useConfirm } from "@/context";
import { veTodayISO } from "@/lib/trackerFormat";

const emptyRow = () => ({
  registro_id: null,
  executed_hours: "0",
  pto_hours: "0",
  standby_hours: "0",
  contracted_hours: "0",
  notes: "",
});

const shiftDate = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const DailyEntry = () => {
  const { user } = useAuth();
  const confirm = useConfirm();

  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [fecha, setFecha] = useState(veTodayISO());

  const [assignedEquipos, setAssignedEquipos] = useState([]);
  const [includedIds, setIncludedIds] = useState(new Set());
  const [rowData, setRowData] = useState({});
  // Acumulado del mes POR EQUIPO hasta el día ANTERIOR al seleccionado (no
  // incluye el propio día) -- se le suma en vivo el borrador de hoy para
  // mostrar el acumulado "con hoy", igual que las columnas ACUMULADO MES
  // del Excel de referencia.
  const [acumuladoPrevio, setAcumuladoPrevio] = useState({});

  const [showPicker, setShowPicker] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    hoursService.getAllEmpresas().then((res) => setCompanies(Array.isArray(res) ? res : []));
  }, []);

  useEffect(() => {
    if (!companyId) {
      setProjects([]);
      setProjectId("");
      return;
    }
    hoursService.getProyectosByEmpresa(Number(companyId)).then((res) => {
      setProjects(Array.isArray(res) ? res : []);
    });
  }, [companyId]);

  useEffect(() => {
    if (!projectId || !fecha) {
      setAssignedEquipos([]);
      setIncludedIds(new Set());
      setRowData({});
      setAcumuladoPrevio({});
      return;
    }
    loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, fecha]);

  const loadDay = async () => {
    setLoadingDay(true);
    setError(null);
    setNotice(null);
    try {
      const [asignados, registros, acumulado] = await Promise.all([
        hoursService.getEquiposAsignados({ project_id: Number(projectId), fecha }),
        hoursService.getRegistrosDelDia({ project_id: Number(projectId), fecha }),
        hoursService.getAcumuladoMes({ project_id: Number(projectId), fecha }),
      ]);
      setAssignedEquipos(Array.isArray(asignados) ? asignados : []);

      const nextAcumulado = {};
      for (const a of Array.isArray(acumulado) ? acumulado : []) {
        nextAcumulado[a.equipment_id] = {
          cobroCompleto: parseFloat(a.acumulado_cobro_completo) || 0,
          standby: parseFloat(a.acumulado_standby) || 0,
        };
      }
      setAcumuladoPrevio(nextAcumulado);

      const included = new Set();
      const nextRowData = {};
      for (const r of Array.isArray(registros) ? registros : []) {
        included.add(r.equipment_id);
        nextRowData[r.equipment_id] = {
          registro_id: r.id,
          executed_hours: String(r.executed_hours),
          pto_hours: String(r.pto_hours),
          standby_hours: String(r.standby_hours),
          contracted_hours: String(r.contracted_hours),
          notes: r.notes || "",
        };
      }
      setIncludedIds(included);
      setRowData(nextRowData);
    } catch (err) {
      console.error("Error cargando el día:", err);
      setError(err.response?.data?.message || err.message || "Error al cargar el día");
    } finally {
      setLoadingDay(false);
    }
  };

  const toggleEquipo = async (equipo) => {
    if (includedIds.has(equipo.id)) {
      const existing = rowData[equipo.id];
      if (existing?.registro_id) {
        const ok = await confirm(
          `${equipo.code} ya tiene un registro guardado este día -- quitarlo también borra ese registro. ¿Continuar?`,
          { title: "Quitar equipo del día" },
        );
        if (!ok) return;
        try {
          await hoursService.eliminarRegistro(existing.registro_id);
        } catch (err) {
          console.error("Error eliminando registro:", err);
          return;
        }
      }
      setIncludedIds((prev) => {
        const next = new Set(prev);
        next.delete(equipo.id);
        return next;
      });
      setRowData((prev) => {
        const next = { ...prev };
        delete next[equipo.id];
        return next;
      });
    } else {
      setIncludedIds((prev) => new Set(prev).add(equipo.id));
      setRowData((prev) => ({ ...prev, [equipo.id]: emptyRow() }));
    }
  };

  const updateRow = (equipoId, field, value) => {
    setRowData((prev) => ({ ...prev, [equipoId]: { ...prev[equipoId], [field]: value } }));
  };

  const displayedEquipos = useMemo(
    () => assignedEquipos.filter((e) => includedIds.has(e.id)),
    [assignedEquipos, includedIds],
  );

  const computeTotals = (row) => {
    const executed = parseFloat(row.executed_hours) || 0;
    const pto = parseFloat(row.pto_hours) || 0;
    const standby = parseFloat(row.standby_hours) || 0;
    const contracted = parseFloat(row.contracted_hours) || 0;
    const total = executed + pto;
    const pct = contracted > 0 ? Math.round((standby * 100 / contracted) * 100) / 100 : null;
    // Complemento de %Stand-By -- en el Excel de referencia TOTAL+STAND-BY
    // siempre suma HRS.TOTALES, así que esto siempre da 100 - pct.
    const pctEjecPto = contracted > 0 ? Math.round((total * 100 / contracted) * 100) / 100 : null;
    return { total, pct, pctEjecPto };
  };

  // Una fila por equipo mostrado, con todos los valores ya calculados --
  // se reutiliza tanto para pintar la tabla como para el resumen del día.
  const enrichedRows = useMemo(
    () =>
      displayedEquipos.map((eq) => {
        const row = rowData[eq.id] || emptyRow();
        const { total, pct, pctEjecPto } = computeTotals(row);
        const previo = acumuladoPrevio[eq.id] || { cobroCompleto: 0, standby: 0 };
        const acumuladoCobroCompleto = +(previo.cobroCompleto + total).toFixed(2);
        const acumuladoStandby = +(previo.standby + (parseFloat(row.standby_hours) || 0)).toFixed(2);
        return { eq, row, total, pct, pctEjecPto, acumuladoCobroCompleto, acumuladoStandby };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayedEquipos, rowData, acumuladoPrevio],
  );

  // Resumen del día -- equivalente a las filas de totales al pie de cada
  // hoja del Excel de referencia (TOTAL ACUMULADO MES ..., TOTAL HRS. ... x
  // DÍA), sumando todos los equipos mostrados.
  const resumenDia = useMemo(() => {
    let hrsTotales = 0;
    let acumuladoCobroCompleto = 0;
    let acumuladoStandby = 0;
    let standbyHoy = 0;
    let cobroCompletoHoy = 0;
    for (const r of enrichedRows) {
      hrsTotales += parseFloat(r.row.contracted_hours) || 0;
      acumuladoCobroCompleto += r.acumuladoCobroCompleto;
      acumuladoStandby += r.acumuladoStandby;
      standbyHoy += parseFloat(r.row.standby_hours) || 0;
      cobroCompletoHoy += r.total;
    }
    return {
      hrsTotales: +hrsTotales.toFixed(2),
      acumuladoCobroCompleto: +acumuladoCobroCompleto.toFixed(2),
      acumuladoStandby: +acumuladoStandby.toFixed(2),
      standbyHoy: +standbyHoy.toFixed(2),
      cobroCompletoHoy: +cobroCompletoHoy.toFixed(2),
    };
  }, [enrichedRows]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      for (const equipo of displayedEquipos) {
        const row = rowData[equipo.id];
        await hoursService.guardarRegistro({
          project_id: Number(projectId),
          equipment_id: equipo.id,
          fecha,
          executed_hours: parseFloat(row.executed_hours) || 0,
          pto_hours: parseFloat(row.pto_hours) || 0,
          standby_hours: parseFloat(row.standby_hours) || 0,
          contracted_hours: parseFloat(row.contracted_hours) || 0,
          notes: row.notes || null,
          created_by: user?.id || null,
        });
      }
      setNotice("Día guardado");
      loadDay();
    } catch (err) {
      console.error("Error guardando el día:", err);
      setError(err.response?.data?.message || err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout
      icon={CalendarClock}
      title="Control de Horas"
      subtitle={`REGISTRO DIARIO • ${new Date().toLocaleDateString()}`}
      accentColor="orange"
    >
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">Empresa</Label>
              <select
                value={companyId}
                onChange={(e) => { setCompanyId(e.target.value); setProjectId(""); }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
              >
                <option value="">Seleccionar...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">Proyecto</Label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={!companyId}
                className={`px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm ${!companyId ? "opacity-50" : ""}`}
              >
                <option value="">Seleccionar...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">Fecha</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setFecha((f) => shiftDate(f, -1))}
                  className="h-10 w-10 rounded-xl shrink-0"
                >
                  <ChevronLeft size={16} />
                </Button>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-center" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setFecha((f) => shiftDate(f, 1))}
                  className="h-10 w-10 rounded-xl shrink-0"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </div>

          {projectId && (
            <div className="flex flex-col gap-1.5 max-w-md">
              <Label className="text-sm font-bold">Unidades del día</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPicker(!showPicker)}
                className="w-full justify-between rounded-xl text-sm"
              >
                <span className="truncate">
                  {includedIds.size === 0 ? "Seleccionar equipos..." : `${includedIds.size} equipo(s) trabajando hoy`}
                </span>
                <span className={`transition-transform ${showPicker ? "rotate-180" : ""}`}>▾</span>
              </Button>
              <AnimatePresence>
                {showPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] p-2">
                      {assignedEquipos.map((eq) => (
                        <label
                          key={eq.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={includedIds.has(eq.id)}
                            onChange={() => toggleEquipo(eq)}
                            className="accent-orange-500"
                          />
                          {eq.code} {eq.name ? `- ${eq.name}` : ""}
                        </label>
                      ))}
                      {assignedEquipos.length === 0 && (
                        <p className="px-2 py-1 text-xs text-slate-400">
                          Ningún equipo asignado a este proyecto en esta fecha
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
          {notice}
        </div>
      )}

      {!projectId ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-400 text-sm">
            Selecciona una empresa y un proyecto para empezar a registrar horas.
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipo</TableHead>
                <TableHead>Ejecutadas</TableHead>
                <TableHead>PTO</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Acum. Mes (Cobro Completo)</TableHead>
                <TableHead>Stand-By</TableHead>
                <TableHead>Acum. Mes (Stand-By)</TableHead>
                <TableHead>Hrs. Totales</TableHead>
                <TableHead>% Stand-By</TableHead>
                <TableHead>% Ejec.+PTO</TableHead>
                <TableHead>Nota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingDay ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-slate-400">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : displayedEquipos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-slate-400">
                    Selecciona arriba las unidades que trabajaron este día
                  </TableCell>
                </TableRow>
              ) : (
                enrichedRows.map(({ eq, row, total, pct, pctEjecPto, acumuladoCobroCompleto, acumuladoStandby }, i) => {
                  return (
                    <TableRow key={eq.id} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                      <TableCell className="font-mono font-bold text-slate-900 dark:text-white text-sm">{eq.code}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.executed_hours}
                          onChange={(e) => updateRow(eq.id, "executed_hours", e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.pto_hours}
                          onChange={(e) => updateRow(eq.id, "pto_hours", e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="text-sm font-bold text-slate-900 dark:text-white">{total}</TableCell>
                      <TableCell className="text-sm">{acumuladoCobroCompleto}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.standby_hours}
                          onChange={(e) => updateRow(eq.id, "standby_hours", e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="text-sm">{acumuladoStandby}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.contracted_hours}
                          onChange={(e) => updateRow(eq.id, "contracted_hours", e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="text-sm">{pct === null ? "-" : `${pct}%`}</TableCell>
                      <TableCell className="text-sm">{pctEjecPto === null ? "-" : `${pctEjecPto}%`}</TableCell>
                      <TableCell>
                        <Input
                          placeholder="Opcional"
                          value={row.notes}
                          onChange={(e) => updateRow(eq.id, "notes", e.target.value)}
                          className="w-40"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {projectId && displayedEquipos.length > 0 && (
        <Card className="mt-4">
          <CardContent className="p-6 grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Total Acumulado Mes — Hrs. Cobro Completo
              </span>
              <span className="text-lg font-black text-slate-900 dark:text-white">{resumenDia.acumuladoCobroCompleto}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Total Acumulado Mes — Hrs. Stand-By
              </span>
              <span className="text-lg font-black text-slate-900 dark:text-white">{resumenDia.acumuladoStandby}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Hrs. Totales</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">{resumenDia.hrsTotales}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total Hrs. Stand-By x Día</span>
              <span className="text-lg font-black text-red-500">{resumenDia.standbyHoy}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total Hrs. Cobro Completo x Día</span>
              <span className="text-lg font-black text-emerald-500">{resumenDia.cobroCompletoHoy}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {projectId && displayedEquipos.length > 0 && (
        <div className="flex justify-end mt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl font-bold flex items-center gap-2 px-6 h-11 bg-orange-500 hover:bg-orange-600 text-white text-sm"
          >
            <Save size={16} />
            {saving ? "Guardando..." : "Guardar día"}
          </Button>
        </div>
      )}
    </PageLayout>
  );
};

export default DailyEntry;
