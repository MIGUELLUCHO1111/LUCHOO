import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fuel,
  Plus,
  X,
  Pencil,
  Trash2,
  Eye,
  FileDown,
  Camera,
  FileUp,
  Filter,
} from "lucide-react";
import { useAuth, useConfirm } from "@/context";
import { fuelService, personService, resolvePhotoUrl } from "@/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TankBar } from "@/components/ui/tankBar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PageLayout } from "@/components/layout/PageLayout";
import { exportToExcel, fmtDate, fmtTime, fmtTimeInput } from "@/lib/excel";
import { readJSON } from "@/lib/storage";

const PEOPLE_STORAGE_KEY = "fullpetro_persons_local";

const unwrapList = (res) => {
  const d = res?.data;
  const payload = d?.data !== undefined ? d.data : d;
  return Array.isArray(payload) ? payload : payload?.rows || [];
};

const emptyForm = {
  vehicle_id: "",
  transaction_no: "",
  fecha: new Date().toISOString().slice(0, 10),
  hora: "",
  responsible_id: "",
  fuel_type: "gasolina",
  liters: "",
  tank_full: false,
  station: "",
  odometer: "",
  amount: "",
  notes: "",
};

const FuelLightFleet = () => {
  const { user } = useAuth();
  const confirm = useConfirm();

  const [vehicles, setVehicles] = useState([]);
  const [refuels, setRefuels] = useState([]);
  const [persons, setPersons] = useState([]);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    unitIds: [], // selected ids (multi)
    responsible: "",
  });
  const [showUnitFilter, setShowUnitFilter] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [existingPhotoId, setExistingPhotoId] = useState(null);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    loadData();
    loadPersons();
  }, []);

  const loadData = async () => {
    try {
      const [vehRes, refRes] = await Promise.all([
        fuelService.getAllVehicles(),
        fuelService.getAllRefuels(),
      ]);
      setVehicles(Array.isArray(vehRes) ? vehRes : []);
      setRefuels(Array.isArray(refRes) ? refRes : []);
    } catch (err) {
      console.error("Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPersons = async () => {
    try {
      const res = await personService.getAll();
      setPersons(unwrapList(res));
    } catch (err) {
      console.warn("Personas no disponibles (backend pendiente):", err);
      // Fallback: registros locales creados desde Seguridad → Personas.
      setPersons(readJSON(PEOPLE_STORAGE_KEY));
    }
  };

  const lightVehicles = useMemo(
    () => vehicles.filter((v) => v.fleet_type !== "pesada"),
    [vehicles],
  );

  const personName = (id) => {
    const p = persons.find((x) => String(x.id) === String(id));
    if (!p) return "";
    return `${p.first_name || p.name || ""} ${p.last_name || p.lastname || ""}`.trim();
  };

  const getTime = (r) => fmtTime(r.filled_at);
  const getPhotoUrl = (r) => resolvePhotoUrl(r.photos?.at(-1)?.url);

  // ---------- Filters ----------
  const filteredRefuels = useMemo(() => {
    return refuels.filter((r) => {
      const d = new Date(r.filled_at);
      if (filters.from && d < new Date(filters.from)) return false;
      if (filters.to) {
        const to = new Date(filters.to);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      if (filters.unitIds.length > 0 && !filters.unitIds.includes(Number(r.vehicle_id)))
        return false;
      if (
        filters.responsible &&
        String(r.responsible_id) !== String(filters.responsible)
      )
        return false;
      return true;
    });
  }, [refuels, filters]);

  const totals = useMemo(() => {
    let liters = 0;
    let amount = 0;
    for (const r of filteredRefuels) {
      liters += parseFloat(r.liters) || 0;
      amount += parseFloat(r.amount) || 0;
    }
    return { liters: +liters.toFixed(2), amount: +amount.toFixed(2) };
  }, [filteredRefuels]);

  const toggleUnitFilter = (id) => {
    setFilters((f) => {
      const set = new Set(f.unitIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, unitIds: [...set] };
    });
  };

  const clearFilters = () =>
    setFilters({ from: "", to: "", unitIds: [], responsible: "" });

  // ---------- Form ----------
  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setPhoto(null);
    setPhotoPreview(null);
    setExistingPhotoId(null);
    setError(null);
    setNotice(null);
  };

  const onPhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  // Quita la foto actual: si ya estaba subida al backend, la borra de verdad;
  // si era solo una selección local sin guardar, solo limpia el estado.
  const handleRemovePhoto = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (existingPhotoId) {
      try {
        await fuelService.deleteFuelPhoto(existingPhotoId);
      } catch (err) {
        console.error("Error borrando foto:", err);
      }
      setExistingPhotoId(null);
    }
    if (photoPreview && photo) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
  };

  const handleEdit = (r) => {
    setForm({
      vehicle_id: String(r.vehicle_id),
      transaction_no: r.transaction_no || "",
      fecha: new Date(r.filled_at).toISOString().slice(0, 10),
      hora: fmtTimeInput(r.filled_at),
      responsible_id: String(r.responsible_id || ""),
      fuel_type: r.fuel_type || "gasolina",
      liters: String(r.liters ?? ""),
      tank_full: !!r.tank_full,
      station: r.station || "",
      odometer: r.odometer != null ? String(r.odometer) : "",
      amount: r.amount != null ? String(r.amount) : "",
      notes: r.notes || "",
    });
    setEditingId(r.id);
    setPhoto(null);
    setPhotoPreview(getPhotoUrl(r));
    setExistingPhotoId(r.photos?.at(-1)?.id ?? null);
    setShowForm(true);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    // La foto es OBLIGATORIA al registrar (regla de liviana).
    if (!editingId && !photo) {
      setError("La foto del ticket es obligatoria para registrar un llenado.");
      setSubmitting(false);
      return;
    }

    try {
      const filledAtISO = form.hora
        ? new Date(`${form.fecha}T${form.hora}`).toISOString()
        : new Date(form.fecha).toISOString();

      const payload = {
        vehicle_id: parseInt(form.vehicle_id),
        transaction_no: form.transaction_no || null,
        filled_at: filledAtISO,
        liters: parseFloat(form.liters),
        tank_full: form.tank_full,
        station: form.station || null,
        odometer: form.odometer ? parseFloat(form.odometer) : null,
        amount: form.amount ? parseFloat(form.amount) : null,
        notes: form.notes || null,
        responsible_id: form.responsible_id ? parseInt(form.responsible_id) : null,
        fuel_type: form.fuel_type,
        created_by: parseInt(user?.id),
      };

      let recordId = editingId;
      let noticeMsg;

      if (editingId) {
        await fuelService.updateRefuel(editingId, payload);
        noticeMsg = "Carga actualizada correctamente";
      } else {
        const res = await fuelService.createRefuel(payload);
        recordId = res?.id;
        noticeMsg = "Carga registrada correctamente";
      }

      if (recordId && photo) {
        try {
          await fuelService.uploadFuelPhoto({ targetType: "carga", targetId: recordId, file: photo });
        } catch (photoErr) {
          const photoMsg =
            photoErr.response?.data?.message || photoErr.message || "error desconocido";
          noticeMsg = `Carga guardada, pero la foto no se pudo subir: ${photoMsg}`;
        }
      }

      setNotice(noticeMsg);
      resetForm();
      loadData();
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        err.message ||
        "Error al guardar";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, code) => {
    const ok = await confirm(`¿Eliminar la carga de la unidad ${code}?`, {
      title: "Eliminar carga",
    });
    if (!ok) return;
    try {
      await fuelService.deleteRefuel(id);
      loadData();
    } catch (err) {
      console.error("Error eliminando:", err);
    }
  };

  // ---------- Detail ----------
  const detailRow = detail
    ? refuels.find((r) => r.id === detail.id)
    : null;

  // ---------- Excel ----------
  const exportExcel = async () => {
    const headers = [
      "Transaction ID",
      "Fecha",
      "Hora",
      "Unidad",
      "Responsable",
      "Combustible",
      "Litros",
      "Monto",
      "Tanque lleno",
      "Estación",
      "Odómetro",
      "Observaciones",
    ];
    try {
      await exportToExcel({
        fileName: `FlotaLiviana_${new Date().toISOString().slice(0, 10)}`,
        sheetName: "Flota Liviana",
        headers,
        rows: filteredRefuels.map((r) => [
          r.transaction_no || "",
          fmtDate(r.filled_at),
          getTime(r),
          r.vehicle_code || `${r.vehicle_id}`,
          personName(r.responsible_id),
          r.fuel_type || "gasolina",
          r.liters,
          r.amount ?? "",
          r.tank_full ? "Sí" : "No",
          r.station || "",
          r.odometer ?? "",
          r.notes || "",
        ]),
        totals: [
          "TOTAL",
          "",
          "",
          "",
          "",
          "",
          totals.liters,
          totals.amount,
          "",
          "",
          "",
          "",
        ],
      });
    } catch (err) {
      console.error("Error exportando Excel:", err);
      alert("No se pudo exportar el Excel.");
    }
  };

  const getTankLevel = (vehicleId) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const capacity = parseFloat(vehicle?.tank_capacity_liters || 0);
    const lastRefuel = refuels.find(
      (r) => r.vehicle_id === vehicleId && r.tank_full,
    );
    const liters = lastRefuel ? parseFloat(lastRefuel.liters) : 0;
    return { level: liters, capacity };
  };

  return (
    <PageLayout
      icon={Fuel}
      title="Combustible · Flota Liviana"
      subtitle={`GESTIÓN DE COMBUSTIBLE • ${new Date().toLocaleDateString()}`}
      accentColor="orange"
    >
      {/* ---------- Barra de filtros ---------- */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <Filter size={16} className="text-orange-500" /> Filtrar
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="rounded-xl text-sm"
              >
                Limpiar
              </Button>
              <Button
                onClick={exportExcel}
                className="rounded-xl flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
              >
                <FileDown size={16} /> Exportar Excel
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">Desde</Label>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">Hasta</Label>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">Unidades</Label>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowUnitFilter(!showUnitFilter)}
                  className="w-full justify-between rounded-xl text-sm"
                >
                  <span className="truncate">
                    {filters.unitIds.length === 0
                      ? "Todas"
                      : `${filters.unitIds.length} seleccionada(s)`}
                  </span>
                  <span
                    className={`transition-transform ${showUnitFilter ? "rotate-180" : ""}`}
                  >
                    ▾
                  </span>
                </Button>
                <AnimatePresence>
                  {showUnitFilter && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute z-30 mt-2 w-full max-h-52 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] shadow-xl p-2"
                    >
                      {lightVehicles.map((v) => (
                        <label
                          key={v.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={filters.unitIds.includes(Number(v.id))}
                            onChange={() => toggleUnitFilter(Number(v.id))}
                            className="accent-orange-500"
                          />
                          {v.code} - {v.name}
                        </label>
                      ))}
                      {lightVehicles.length === 0 && (
                        <p className="px-2 py-1 text-xs text-slate-400">
                          Sin unidades
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">Responsable</Label>
              <select
                value={filters.responsible}
                onChange={(e) =>
                  setFilters({ ...filters, responsible: e.target.value })
                }
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
              >
                <option value="">Todos</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name || p.name} {p.last_name || p.lastname}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">Totales</Label>
              <div className="flex items-center gap-3 h-10 px-3 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-500/10 text-sm">
                <span className="text-emerald-700 dark:text-emerald-400 font-black">
                  {totals.liters} L
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-black">
                  $ {totals.amount}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Nueva carga ---------- */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
          Registro de Llenados
        </h3>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-orange-500 hover:bg-orange-600 text-white transition-transform hover:scale-105 text-sm"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancelar" : "Nuevo Llenado"}
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <Card className="border-orange-200 dark:border-orange-500/20">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  {editingId ? "Editar Llenado" : "Registrar Llenado de Combustible"}
                </h3>

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

                <form
                  onSubmit={handleSubmit}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Unidad *</Label>
                    <select
                      required
                      value={form.vehicle_id}
                      onChange={(e) =>
                        setForm({ ...form, vehicle_id: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                    >
                      <option value="">Seleccionar...</option>
                      {lightVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.code} - {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Transaction ID</Label>
                    <Input
                      placeholder="Nomenclatura por definir"
                      value={form.transaction_no}
                      onChange={(e) => setForm({ ...form, transaction_no: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Fecha de llenado *</Label>
                    <Input
                      required
                      type="date"
                      value={form.fecha}
                      onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Hora de llenado *</Label>
                    <Input
                      required
                      type="time"
                      value={form.hora}
                      onChange={(e) => setForm({ ...form, hora: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Responsable</Label>
                    <select
                      value={form.responsible_id}
                      onChange={(e) =>
                        setForm({ ...form, responsible_id: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                    >
                      <option value="">Seleccionar...</option>
                      {persons.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name || p.name} {p.last_name || p.lastname}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Combustible *</Label>
                    <select
                      value={form.fuel_type}
                      onChange={(e) =>
                        setForm({ ...form, fuel_type: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                    >
                      <option value="gasolina">Gasolina</option>
                      <option value="diesel">Diesel</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Litros *</Label>
                    <Input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ej: 40"
                      value={form.liters}
                      onChange={(e) => setForm({ ...form, liters: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Tanque lleno</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={form.tank_full}
                        onCheckedChange={(checked) =>
                          setForm({ ...form, tank_full: checked })
                        }
                      />
                      <span className="text-sm text-slate-500">
                        {form.tank_full ? "Sí" : "No"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Estación</Label>
                    <Input
                      placeholder="Ej: PDV-01"
                      value={form.station}
                      onChange={(e) => setForm({ ...form, station: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Odómetro</Label>
                    <Input
                      type="number"
                      placeholder="Ej: 50000"
                      value={form.odometer}
                      onChange={(e) => setForm({ ...form, odometer: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Monto</Label>
                    <Input
                      type="number"
                      placeholder="Ej: 20"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 lg:col-span-2">
                    <Label className="text-sm font-bold">Observaciones</Label>
                    <Input
                      placeholder="Notas adicionales..."
                      value={form.notes}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">
                      Foto del ticket {editingId ? "" : "*"}
                      {!editingId && (
                        <span className="ml-1 text-[11px] font-normal text-red-500">
                          obligatoria
                        </span>
                      )}
                    </Label>
                    <label
                      className="relative flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-white/[0.02] cursor-pointer hover:border-orange-400 transition-colors overflow-hidden"
                    >
                      {photoPreview ? (
                        <>
                          <img
                            src={photoPreview}
                            alt="Ticket"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            title="Quitar foto"
                            className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <Camera size={22} className="text-slate-400" />
                          <span className="text-xs text-slate-500">
                            {photo ? photo.name : "Seleccionar imagen"}
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onPhotoChange}
                      />
                    </label>
                  </div>

                  <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      className="rounded-xl"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {submitting
                        ? "Guardando..."
                        : editingId
                          ? "Actualizar"
                          : "Guardar Carga"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Nivel de tanques ---------- */}
      <div className="mb-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-3">
          Nivel de Tanques
        </h3>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {lightVehicles.map((v) => {
            const { level, capacity } = getTankLevel(v.id);
            return (
              <Card key={v.id} className="min-w-[100px] shrink-0">
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <TankBar level={level} capacity={capacity} />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 text-center">
                    {v.code}
                  </span>
                </CardContent>
              </Card>
            );
          })}
          {lightVehicles.length === 0 && (
            <p className="text-sm text-slate-400">No hay vehículos registrados</p>
          )}
        </div>
      </div>

      {/* ---------- Tabla ---------- */}
      <Card className="w-full overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Combustible</TableHead>
              <TableHead>Litros</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Foto</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-slate-400">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filteredRefuels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-slate-400">
                  No hay llenados registrados
                </TableCell>
              </TableRow>
            ) : (
              filteredRefuels.map((r, i) => (
                <TableRow
                  key={r.id}
                  className={
                    i % 2 === 0
                      ? "bg-transparent"
                      : "bg-slate-50/60 dark:bg-white/[0.02]"
                  }
                >
                  <TableCell className="text-sm font-mono text-orange-600 dark:text-orange-400">
                    {r.transaction_no || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(r.filled_at)}</TableCell>
                  <TableCell className="text-sm font-mono">{getTime(r)}</TableCell>
                  <TableCell className="text-sm">
                    {r.vehicle_code || `${r.vehicle_id}`}
                  </TableCell>
                  <TableCell className="text-sm">
                    {personName(r.responsible_id) || "-"}
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {r.fuel_type || "gasolina"}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-white text-sm">
                    {r.liters}L
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.amount ? `$${r.amount}` : "-"}
                  </TableCell>
                  <TableCell>
                    {getPhotoUrl(r) ? (
                      <img
                        src={getPhotoUrl(r)}
                        alt="Ticket"
                        className="h-9 w-9 rounded-lg object-cover cursor-pointer"
                        onClick={() => setDetail(r)}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setDetail(r)}
                        className="h-8 w-8 rounded-lg"
                        title="Ver detalle"
                      >
                        <Eye size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(r)}
                        className="h-8 w-8 rounded-lg"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(r.id, r.vehicle_code)}
                        className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ---------- Modal detalle ---------- */}
      <AnimatePresence>
        {detail && detailRow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/5 shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Detalle de llenado
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDetail(null)}
                  className="rounded-xl"
                >
                  <X size={18} />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Transaction ID" value={detailRow.transaction_no || "-"} mono />
                <Info label="Fecha" value={fmtDate(detailRow.filled_at)} />
                <Info label="Hora" value={getTime(detailRow)} />
                <Info
                  label="Unidad"
                  value={
                    detailRow.vehicle_name ||
                    detailRow.vehicle_code ||
                    String(detailRow.vehicle_id)
                  }
                />
                <Info
                  label="Responsable"
                  value={personName(detailRow.responsible_id) || "-"}
                />
                <Info
                  label="Combustible"
                  value={detailRow.fuel_type || "gasolina"}
                />
                <Info label="Litros" value={`${detailRow.liters} L`} />
                <Info
                  label="Monto"
                  value={detailRow.amount ? `$${detailRow.amount}` : "-"}
                />
                <Info
                  label="Tanque lleno"
                  value={detailRow.tank_full ? "Sí" : "No"}
                />
              </div>

              {detailRow.station && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  <b>Estación:</b> {detailRow.station}
                </p>
              )}
              {detailRow.odometer != null && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  <b>Odómetro:</b> {detailRow.odometer}
                </p>
              )}
              {detailRow.notes && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  <b>Observaciones:</b> {detailRow.notes}
                </p>
              )}

              {getPhotoUrl(detailRow) && (
                <a
                  href={getPhotoUrl(detailRow)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block"
                >
                  <img
                    src={getPhotoUrl(detailRow)}
                    alt="Ticket"
                    className="w-full max-h-72 object-contain rounded-2xl border border-slate-200 dark:border-slate-700"
                  />
                </a>
              )}
              {!getPhotoUrl(detailRow) && (
                <p className="mt-4 text-xs text-slate-400 flex items-center gap-1.5">
                  <FileUp size={14} /> Sin foto adjunta
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
};

const Info = ({ label, value, mono }) => (
  <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-3">
    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
      {label}
    </p>
    <p
      className={`font-semibold text-slate-900 dark:text-white capitalize ${
        mono ? "font-mono text-orange-600 dark:text-orange-400" : ""
      }`}
    >
      {value}
    </p>
  </div>
);

export default FuelLightFleet;