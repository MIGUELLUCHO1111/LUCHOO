import { useState, useEffect } from "react";
import { Radio, RefreshCw, Plus, X, Pencil, Trash2 } from "lucide-react";
import { trackerService } from "@/services";
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
import { useConfirm } from "@/context";
import { CATEGORY_STYLES, formatHora, statusBadgeClass, statusLabel } from "@/lib/trackerFormat";

const Tracker = () => {
  const confirm = useConfirm();

  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  const [unidades, setUnidades] = useState([]);
  const [showUnidades, setShowUnidades] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ code: "", plate: "", driver_name: "" });

  useEffect(() => {
    loadSnapshots();
    loadUnidades();
  }, []);

  const loadSnapshots = async () => {
    try {
      const res = await trackerService.getLatestSnapshots();
      setSnapshots(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando estado de la flota:", err);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const loadUnidades = async () => {
    try {
      const res = await trackerService.getAllUnidades();
      setUnidades(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando unidades:", err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await trackerService.syncNow();
      setSyncMessage(
        `${res?.total_recibidas ?? 0} unidades recibidas de la API · ${res?.cruzadas_con_tabla_interna ?? 0} cruzadas con la tabla interna`
      );
      await loadSnapshots();
    } catch (err) {
      setSyncMessage(err.response?.data?.message || err.message || "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const resetForm = () => {
    setForm({ code: "", plate: "", driver_name: "" });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (unidad) => {
    setForm({
      code: unidad.code,
      plate: unidad.plate || "",
      driver_name: unidad.driver_name || "",
    });
    setEditingId(unidad.id);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        await trackerService.updateUnidad(editingId, {
          plate: form.plate || null,
          driver_name: form.driver_name || null,
          is_active: true,
        });
      } else {
        await trackerService.createUnidad({
          code: form.code,
          plate: form.plate || null,
          driver_name: form.driver_name || null,
        });
      }
      resetForm();
      loadUnidades();
      loadSnapshots();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, code) => {
    const ok = await confirm(`¿Eliminar la unidad ${code} del registro interno?`, {
      title: "Eliminar unidad",
    });
    if (!ok) return;
    try {
      await trackerService.deleteUnidad(id);
      loadUnidades();
    } catch (err) {
      console.error("Error eliminando:", err);
    }
  };

  const total = snapshots.length;
  const activas = snapshots.filter((s) => s.status === "ACTIVO" && !s.is_stale).length;
  const estacionadas = snapshots.filter((s) => s.status === "ESTACIONADO" && !s.is_stale).length;
  const sinSenal = snapshots.filter((s) => s.is_stale).length;

  return (
    <PageLayout
      icon={Radio}
      title="Estado de Flota"
      subtitle={`TRACKER GPS • ÚLTIMA LECTURA GUARDADA • ${new Date().toLocaleDateString()}`}
      accentColor="orange"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex gap-4">
          <Card className="px-5 py-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Total unidades</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{total}</div>
          </Card>
          <Card className="px-5 py-3 border-emerald-200 dark:border-emerald-500/20">
            <div className="text-[11px] font-bold text-emerald-600 uppercase">Activas</div>
            <div className="text-2xl font-black text-emerald-600">{activas}</div>
          </Card>
          <Card className="px-5 py-3 border-red-200 dark:border-red-500/20">
            <div className="text-[11px] font-bold text-red-600 uppercase">Estacionadas</div>
            <div className="text-2xl font-black text-red-600">{estacionadas}</div>
          </Card>
          <Card className="px-5 py-3 border-slate-200 dark:border-slate-500/20">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Sin señal reciente</div>
            <div className="text-2xl font-black text-slate-500">{sinSenal}</div>
          </Card>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-orange-500 hover:bg-orange-600 text-white text-sm"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
          </Button>
          {syncMessage && <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs text-right">{syncMessage}</p>}
        </div>
      </div>

      <Card className="w-full overflow-hidden mb-8">
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
            {loadingSnapshots ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">Cargando...</TableCell>
              </TableRow>
            ) : snapshots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  Sin lecturas todavía — presiona "Sincronizar ahora"
                </TableCell>
              </TableRow>
            ) : (
              snapshots.map((s, i) => (
                <TableRow key={s.unit_id ?? `p-${s.plate}` ?? i} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                  <TableCell className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {s.unit_code || <span className="italic text-slate-400 font-normal">sin registrar</span>}
                  </TableCell>
                  <TableCell className="text-sm">{s.plate || "-"}</TableCell>
                  <TableCell className="text-sm">{s.driver_name || "-"}</TableCell>
                  <TableCell className="text-sm max-w-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${CATEGORY_STYLES[s.location_category] || CATEGORY_STYLES.OTRAS}`}>
                        {s.location_category}
                      </span>
                      <span className="truncate">{s.location_text || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatHora(s.last_report_at)}
                    {s.is_stale && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500">
                        SIN SEÑAL RECIENTE
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${statusBadgeClass(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Unidades registradas (tabla interna placa-unidad-conductor)
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowUnidades(!showUnidades)} className="rounded-xl text-sm">
            {showUnidades ? "Ocultar" : `Ver (${unidades.length})`}
          </Button>
          {showUnidades && (
            <Button
              onClick={() => { resetForm(); setShowForm(!showForm); }}
              className="rounded-xl font-bold flex items-center gap-2 px-4 h-9 bg-orange-500 hover:bg-orange-600 text-white text-sm"
            >
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? "Cancelar" : "Nueva Unidad"}
            </Button>
          )}
        </div>
      </div>

      {showUnidades && (
        <>
          {showForm && (
            <Card className="mb-6 border-orange-200 dark:border-orange-500/20">
              <CardContent className="p-6">
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Código *</Label>
                    <Input
                      required
                      placeholder="Ej: FP-CBA-09"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      disabled={!!editingId}
                      className={editingId ? "opacity-50" : ""}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Placa</Label>
                    <Input
                      placeholder="Ej: A33AU3D"
                      value={form.plate}
                      onChange={(e) => setForm({ ...form, plate: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Conductor</Label>
                    <Input
                      placeholder="Ej: ROTATIVO"
                      value={form.driver_name}
                      onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-3 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl">Cancelar</Button>
                    <Button type="submit" disabled={submitting} className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white">
                      {submitting ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className="w-full overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unidades.map((u, i) => (
                  <TableRow key={u.id} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                    <TableCell className="font-mono font-bold text-sm">{u.code}</TableCell>
                    <TableCell className="text-sm">{u.plate || "-"}</TableCell>
                    <TableCell className="text-sm">{u.driver_name || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleEdit(u)} className="h-8 w-8 rounded-lg">
                          <Pencil size={14} />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleDelete(u.id, u.code)} className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </PageLayout>
  );
};

export default Tracker;
