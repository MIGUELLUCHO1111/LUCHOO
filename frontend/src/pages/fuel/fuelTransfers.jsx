import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, ArrowRight, Plus, X, Pencil, Trash2, Camera, Search } from "lucide-react";
import { fuelService, personService, resolvePhotoUrl } from "@/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchableSelect";
import { PageLayout } from "@/components/layout/PageLayout";
import { useConfirm } from "@/context";
import { unitLabel } from "@/lib/unitLabel";

// Combustible > Transferencias (064_fuel_transfer.sql, 07/10/2026). Una
// unidad le pasa gasolina a otra que no puede ir a la estación (ej. los
// montacargas a gasolina). Origen y destino: cualquier unidad. En Reportes
// los litros y el costo se restan del origen y se suman al destino.

const TZ = "America/Caracas";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const nowTime = () => new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const usd = (n) => `$${(Number(n) || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const lit = (n) => `${(Number(n) || 0).toLocaleString("es-VE", { maximumFractionDigits: 2 })} L`;
const fmtDT = (d) => new Date(d).toLocaleString("es-VE", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const selectCls = "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm h-10";

const EMPTY = { from_vehicle_id: null, to_vehicle_id: null, date: "", time: "", liters: "", unit_price_usd: "", measurement_value: "", measurement_type: "horas", responsible_id: "", notes: "" };

export default function FuelTransfers() {
  const confirm = useConfirm();
  const [rows, setRows] = useState([]);
  const [units, setUnits] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [suggested, setSuggested] = useState(null);
  const [filters, setFilters] = useState({ from: "", to: "", unit: null, q: "" });

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(() => fuelService.getAllTransfers().then((d) => setRows(Array.isArray(d) ? d : [])).catch((e) => setError(e.message)).finally(() => setLoading(false)), []);
  useEffect(() => {
    load();
    fuelService.getAllVehicles().then((d) => setUnits(Array.isArray(d) ? d : [])).catch(() => {});
    personService.getAll().then((d) => setPersons(Array.isArray(d) ? d : [])).catch(() => {});
  }, [load]);

  // Precio por litro sugerido: el de la última carga con monto del origen.
  useEffect(() => {
    if (!f.from_vehicle_id || editingId) return;
    fuelService.getTransferPrice(f.from_vehicle_id).then((d) => {
      const p = d?.unit_price;
      setSuggested(p ?? null);
      setF((prev) => ({ ...prev, unit_price_usd: p != null ? String(p) : "" }));
    }).catch(() => setSuggested(null));
  }, [f.from_vehicle_id, editingId]);

  // Lectura del destino: horas para flota pesada (montacargas), km para liviana.
  const toUnit = units.find((u) => Number(u.id) === Number(f.to_vehicle_id));
  useEffect(() => {
    if (toUnit && !editingId) set("measurement_type", String(toUnit.fleet_type).toUpperCase() === "LIVIANA" ? "km" : "horas");
  }, [toUnit, editingId]);

  const cost = f.liters !== "" && f.unit_price_usd !== "" ? Math.round(Number(f.liters) * Number(f.unit_price_usd) * 100) / 100 : null;

  const reset = () => { setF(EMPTY); setPhoto(null); setEditingId(null); setShowForm(false); setSuggested(null); setError(null); };
  const openNew = () => { setF({ ...EMPTY, date: today(), time: nowTime() }); setEditingId(null); setPhoto(null); setShowForm(true); setError(null); };
  const openEdit = (r) => {
    setF({
      from_vehicle_id: Number(r.from_vehicle_id), to_vehicle_id: Number(r.to_vehicle_id), date: "", time: "",
      liters: String(Number(r.liters)), unit_price_usd: r.unit_price_usd != null ? String(Number(r.unit_price_usd)) : "",
      measurement_value: r.measurement_value != null ? String(Number(r.measurement_value)) : "", measurement_type: r.measurement_type || "horas",
      responsible_id: r.responsible_id ? String(r.responsible_id) : "", notes: r.notes || "",
    });
    setEditingId(Number(r.id));
    setPhoto(null);
    setShowForm(true);
    setError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const data = {
      from_vehicle_id: f.from_vehicle_id, to_vehicle_id: f.to_vehicle_id, liters: f.liters,
      unit_price_usd: f.unit_price_usd === "" ? null : f.unit_price_usd,
      measurement_value: f.measurement_value === "" ? null : f.measurement_value, measurement_type: f.measurement_value === "" ? null : f.measurement_type,
      responsible_id: f.responsible_id ? Number(f.responsible_id) : null, notes: f.notes || null,
    };
    try {
      const saved = editingId
        ? await fuelService.updateTransfer(editingId, data)
        : await fuelService.createTransfer({ ...data, filled_at: new Date(`${f.date}T${f.time || "00:00"}`).toISOString() });
      if (photo && saved?.id) {
        try { await fuelService.uploadFuelPhoto({ targetType: "transfer", targetId: saved.id, file: photo }); }
        catch (pe) { setError(`La transferencia se guardó, pero la foto no: ${pe.response?.data?.message || pe.message}`); }
      }
      await load();
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    const ok = await confirm(`¿Eliminar la transferencia ${r.transaction_no} (${lit(r.liters)} de ${r.from_code} a ${r.to_code})?`, { title: "Eliminar transferencia" });
    if (!ok) return;
    try { await fuelService.deleteTransfer(Number(r.id)); await load(); } catch (e) { setError(e.message); }
  };

  const shown = useMemo(() => {
    const term = filters.q.trim().toLowerCase();
    return rows.filter((r) => {
      const d = new Date(r.filled_at).toLocaleDateString("en-CA", { timeZone: TZ });
      if (filters.from && d < filters.from) return false;
      if (filters.to && d > filters.to) return false;
      if (filters.unit && Number(r.from_vehicle_id) !== filters.unit && Number(r.to_vehicle_id) !== filters.unit) return false;
      return !term || [r.transaction_no, r.from_code, r.to_code, r.responsible_name, r.notes].some((v) => String(v || "").toLowerCase().includes(term));
    });
  }, [rows, filters]);
  const totalL = shown.reduce((s, r) => s + Number(r.liters || 0), 0);
  const totalUsd = shown.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <PageLayout icon={ArrowLeftRight} title="Transferencias de combustible" subtitle={`COMBUSTIBLE • ${new Date().toLocaleDateString()}`} accentColor="navy">
      <div className="w-full flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            Para las unidades que no pueden ir a la estación: otra unidad les pasa de su gasolina. Los litros y el costo se
            <b> descuentan del origen y se suman al destino</b> en los reportes.
          </p>
          <Button data-write onClick={() => (showForm ? reset() : openNew())} className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-brand-navy hover:bg-brand-navy-light text-white">
            {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Cancelar" : "Nueva transferencia"}
          </Button>
        </div>

        {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">{error}</div>}

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <Card className="border-brand-navy/20">
                <CardContent className="p-6">
                  <h3 className="font-display text-lg text-slate-900 dark:text-white mb-4">{editingId ? "Editar transferencia" : "Nueva transferencia"}</h3>
                  <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <div className="md:col-span-3 flex flex-col gap-1.5">
                      <Label className="text-sm font-bold">Entrega (origen) *</Label>
                      <SearchableSelect items={units} getValue={(u) => Number(u.id)} getLabel={unitLabel} value={f.from_vehicle_id} onChange={(id) => set("from_vehicle_id", id)} placeholder="Unidad que da la gasolina..." />
                    </div>
                    <div className="md:col-span-3 flex flex-col gap-1.5">
                      <Label className="text-sm font-bold">Recibe (destino) *</Label>
                      <SearchableSelect items={units.filter((u) => Number(u.id) !== Number(f.from_vehicle_id))} getValue={(u) => Number(u.id)} getLabel={unitLabel} value={f.to_vehicle_id} onChange={(id) => set("to_vehicle_id", id)} placeholder="Unidad que la recibe (ej. montacargas)..." />
                    </div>
                    {!editingId && (
                      <>
                        <div className="md:col-span-2 flex flex-col gap-1.5"><Label className="text-sm font-bold">Fecha *</Label><Input type="date" max={today()} value={f.date} onChange={(e) => set("date", e.target.value)} required /></div>
                        <div className="md:col-span-1 flex flex-col gap-1.5"><Label className="text-sm font-bold">Hora</Label><Input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} /></div>
                      </>
                    )}
                    <div className="md:col-span-1 flex flex-col gap-1.5"><Label className="text-sm font-bold">Litros *</Label><Input type="number" min="0.01" step="0.01" value={f.liters} onChange={(e) => set("liters", e.target.value)} required /></div>
                    <div className="md:col-span-1 flex flex-col gap-1.5">
                      <Label className="text-sm font-bold">$ por litro</Label>
                      <Input type="number" min="0" step="0.0001" value={f.unit_price_usd} onChange={(e) => set("unit_price_usd", e.target.value)} placeholder="Sin costo" />
                    </div>
                    <div className={`${editingId ? "md:col-span-4" : "md:col-span-1"} flex flex-col gap-1.5`}>
                      <Label className="text-sm font-bold">Costo transferido</Label>
                      <div className="h-10 flex items-center px-3 rounded-xl bg-slate-50 dark:bg-white/5 font-bold text-slate-900 dark:text-white">{cost != null ? usd(cost) : "—"}</div>
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <Label className="text-sm font-bold">Lectura del destino</Label>
                      <div className="flex gap-2">
                        <Input type="number" min="0" step="0.1" value={f.measurement_value} onChange={(e) => set("measurement_value", e.target.value)} placeholder="Opcional" />
                        <select className={`${selectCls} w-28`} value={f.measurement_type} onChange={(e) => set("measurement_type", e.target.value)}><option value="horas">horas</option><option value="km">km</option></select>
                      </div>
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <Label className="text-sm font-bold">Responsable</Label>
                      <select className={selectCls} value={f.responsible_id} onChange={(e) => set("responsible_id", e.target.value)}>
                        <option value="">Seleccionar...</option>
                        {persons.map((p) => <option key={p.id} value={p.id}>{`${p.first_name || ""} ${p.last_name || ""}`.trim()}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <Label className="text-sm font-bold">Foto (opcional)</Label>
                      <label className="h-10 flex items-center gap-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                        <Camera size={15} /> <span className="truncate">{photo ? photo.name : "Elegir imagen (jpg, png, webp)"}</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                    <div className="md:col-span-6 flex flex-col gap-1.5"><Label className="text-sm font-bold">Notas</Label><Input value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Opcional" /></div>
                    <p className="md:col-span-4 text-xs text-slate-500">
                      {suggested != null && !editingId ? <>Precio sugerido: {usd(suggested)}/L (última carga del origen). </> : null}
                      El N.º de transacción se genera solo: <span className="font-mono">FP-AATR MM DD ###</span>.
                    </p>
                    <div className="md:col-span-2 flex justify-end">
                      <Button type="submit" disabled={saving || !f.from_vehicle_id || !f.to_vehicle_id || !f.liters} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white px-6">{saving ? "Guardando..." : editingId ? "Guardar cambios" : "Registrar transferencia"}</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Card>
          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="flex flex-col gap-1.5"><Label className="text-sm font-bold">Desde</Label><Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-sm font-bold">Hasta</Label><Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-sm font-bold">Unidad (origen o destino)</Label>
              <SearchableSelect items={[{ id: "", code: "Todas" }, ...units]} getValue={(u) => (u.id === "" ? null : Number(u.id))} getLabel={(u) => (u.id === "" ? u.code : unitLabel(u))} value={filters.unit} onChange={(id) => setFilters({ ...filters, unit: id || null })} placeholder="Todas" />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={15} /></span>
              <Input className="pl-9" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="N.º, unidad, responsable..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-6 text-sm text-slate-700 dark:text-slate-200">
          <span><b>{shown.length}</b> transferencia(s)</span>
          <span>Total: <b>{lit(totalL)}</b></span>
          <span>Costo transferido: <b>{usd(totalUsd)}</b></span>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0f1115]/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                  <th className="px-4 py-3">N.º</th><th className="px-2">Fecha</th><th className="px-2">Origen → Destino</th><th className="px-2 text-right">Litros</th><th className="px-2 text-right">$/L</th><th className="px-2 text-right">Costo</th><th className="px-2">Lectura</th><th className="px-2">Responsable</th><th className="px-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={9} className="text-center py-12 text-slate-400">Cargando...</td></tr>
                  : shown.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-slate-400">{rows.length ? "No hay transferencias con ese filtro." : "Todavía no hay transferencias registradas."}</td></tr>
                    : shown.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-white/5">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">{r.transaction_no}</td>
                        <td className="px-2 whitespace-nowrap text-slate-600 dark:text-slate-300">{fmtDT(r.filled_at)}</td>
                        <td className="px-2 whitespace-nowrap"><b>{r.from_code}</b> <ArrowRight size={13} className="inline mx-1 text-slate-400" /> <b>{r.to_code}</b></td>
                        <td className="px-2 text-right tabular-nums font-bold">{lit(r.liters)}</td>
                        <td className="px-2 text-right tabular-nums">{r.unit_price_usd != null ? usd(r.unit_price_usd) : "—"}</td>
                        <td className="px-2 text-right tabular-nums">{r.amount != null ? usd(r.amount) : "—"}</td>
                        <td className="px-2 whitespace-nowrap">{r.measurement_value != null ? `${Number(r.measurement_value).toLocaleString("es-VE")} ${r.measurement_type === "horas" ? "h" : "km"}` : "—"}</td>
                        <td className="px-2">{r.responsible_name || "—"}{r.notes && <span className="block text-xs text-slate-400">{r.notes}</span>}</td>
                        <td className="px-2 pr-4 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            {(r.photos || []).map((ph) => <a key={ph.id} href={resolvePhotoUrl(ph.url)} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-navy hover:bg-brand-navy/10" aria-label="Ver foto"><Camera size={14} /></a>)}
                            <Button data-write variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(r)} aria-label="Editar"><Pencil size={14} /></Button>
                            <Button data-write variant="outline" size="icon" className="h-8 w-8 rounded-lg text-red-600" onClick={() => remove(r)} aria-label="Eliminar"><Trash2 size={14} /></Button>
                          </span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
