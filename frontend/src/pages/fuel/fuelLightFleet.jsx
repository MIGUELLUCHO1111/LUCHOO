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
import { useAuth } from "@/context";
import { fuelService, personService } from "@/services";
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
import { exportToExcel, fmtDate, fmtTime } from "@/lib/excel";
import { readJSON } from "@/lib/storage";

const PEOPLE_STORAGE_KEY = "fullpetro_persons_local";

const unwrapList = (res) => {
  const d = res?.data;
  const payload = d?.data !== undefined ? d.data : d;
  return Array.isArray(payload) ? payload : payload?.rows || [];
};

const emptyForm = {
  vehicle_id: "",
  fecha: new Date().toISOString().slice(0, 10),
  hora: "",
  responsable_id: "",
  combustible: "gasolina",
  litros: "",
  tanque_lleno: false,
  estacion: "",
  odometro: "",
  monto: "",
  observaciones: "",
};

const FuelLightFleet = () => {
  const { user } = useAuth();

  const [vehicles, setVehicles] = useState([]);
  const [refuels, setRefuels] = useState([]);
  const [persons, setPersons] = useState([]);

  // Data the backend does not persist yet (photo/requester/fuel type/time):
  // pending on the backend phase — kept in the local session.
  const [extraData, setExtraData] = useState({});

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
    () => vehicles.filter((v) => v.tipo_flota !== "pesada"),
    [vehicles],
  );

  const personName = (id) => {
    const p = persons.find((x) => String(x.id) === String(id));
    if (!p) return extraData[id]?.responsable_name || "";
    return `${p.first_name || p.name || ""} ${p.last_name || p.lastname || ""}`.trim();
  };

  const getTime = (r) => extraData[r.id]?.hora || fmtTime(r.fecha);
  const getFuelType = (r) => extraData[r.id]?.combustible || r.combustible || "gasolina";
  const getResponsibleId = (r) => extraData[r.id]?.responsable_id || r.responsable_id;
  const getPhotoUrl = (r) => extraData[r.id]?.fotoUrl;

  // ---------- Filters ----------
  const filteredRefuels = useMemo(() => {
    return refuels.filter((r) => {
      const d = new Date(r.fecha);
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
        String(getResponsibleId(r)) !== String(filters.responsible)
      )
        return false;
      return true;
    });
  }, [refuels, filters, extraData]);

  const totals = useMemo(() => {
    let liters = 0;
    let amount = 0;
    for (const r of filteredRefuels) {
      liters += parseFloat(r.litros) || 0;
      amount += parseFloat(r.monto) || 0;
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
    setError(null);
    setNotice(null);
  };

  const onPhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleEdit = (r) => {
    const ext = extraData[r.id] || {};
    setForm({
      vehicle_id: String(r.vehicle_id),
      fecha: new Date(r.fecha).toISOString().slice(0, 10),
      hora: ext.hora || fmtTime(r.fecha),
      responsable_id: String(getResponsibleId(r) || ""),
      combustible: getFuelType(r),
      litros: String(r.litros ?? ""),
      tanque_lleno: !!r.tanque_lleno,
      estacion: r.estacion || "",
      odometro: r.odometro != null ? String(r.odometro) : "",
      monto: r.monto != null ? String(r.monto) : "",
      observaciones: r.observaciones || "",
    });
    setEditingId(r.id);
    setPhoto(null);
    setPhotoPreview(ext.fotoUrl || null);
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
      const fechaISO = form.hora
        ? new Date(`${form.fecha}T${form.hora}`).toISOString()
        : new Date(form.fecha).toISOString();

      const payload = {
        litros: parseFloat(form.litros),
        tanque_lleno: form.tanque_lleno,
        estacion: form.estacion || null,
        odometro: form.odometro ? parseFloat(form.odometro) : null,
        monto: form.monto ? parseFloat(form.monto) : null,
        observaciones: form.observaciones || null,
        created_by: parseInt(user?.id),
        // Pendientes de persistencia en backend (fase posterior):
        fecha: fechaISO,
        hora: form.hora,
        responsable_id: form.responsable_id ? parseInt(form.responsable_id) : null,
        combustible: form.combustible,
      };

      let recordId = editingId;

      if (editingId) {
        await fuelService.updateRefuel(editingId, payload);
        setNotice("Carga actualizada correctamente");
      } else {
        const res = await fuelService.createRefuel(payload);
        recordId = res?.id;
        setNotice("Carga registrada correctamente");
      }

      if (recordId) {
        setExtraData((prev) => ({
          ...prev,
          [recordId]: {
            hora: form.hora,
            responsable_id: form.responsable_id
              ? parseInt(form.responsable_id)
              : null,
            responsable_name: personName(form.responsable_id),
            combustible: form.combustible,
            fotoUrl: photoPreview || prev[recordId]?.fotoUrl,
          },
        }));
      }

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

  const handleDelete = async (id, codigo) => {
    if (!confirm(`¿Eliminar la carga de la unidad ${codigo}?`)) return;
    try {
      await fuelService.deleteRefuel(id);
      setExtraData((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
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
          fmtDate(r.fecha),
          getTime(r),
          r.vehiculo_codigo || `${r.vehicle_id}`,
          personName(getResponsibleId(r)),
          getFuelType(r),
          r.litros,
          r.monto ?? "",
          r.tanque_lleno ? "Sí" : "No",
          r.estacion || "",
          r.odometro ?? "",
          r.observaciones || "",
        ]),
        totals: [
          "TOTAL",
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
    const capacity = parseFloat(vehicle?.tanque_capacidad_litros || 0);
    const lastRefuel = refuels.find(
      (r) => r.vehicle_id === vehicleId && r.tanque_lleno,
    );
    const liters = lastRefuel ? parseFloat(lastRefuel.litros) : 0;
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
                          {v.codigo} - {v.nombre}
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
                          {v.codigo} - {v.nombre}
                        </option>
                      ))}
                    </select>
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
                      value={form.responsable_id}
                      onChange={(e) =>
                        setForm({ ...form, responsable_id: e.target.value })
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
                      value={form.combustible}
                      onChange={(e) =>
                        setForm({ ...form, combustible: e.target.value })
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
                      value={form.litros}
                      onChange={(e) => setForm({ ...form, litros: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Tanque lleno</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={form.tanque_lleno}
                        onCheckedChange={(checked) =>
                          setForm({ ...form, tanque_lleno: checked })
                        }
                      />
                      <span className="text-sm text-slate-500">
                        {form.tanque_lleno ? "Sí" : "No"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Estación</Label>
                    <Input
                      placeholder="Ej: PDV-01"
                      value={form.estacion}
                      onChange={(e) => setForm({ ...form, estacion: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Odómetro</Label>
                    <Input
                      type="number"
                      placeholder="Ej: 50000"
                      value={form.odometro}
                      onChange={(e) => setForm({ ...form, odometro: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Monto</Label>
                    <Input
                      type="number"
                      placeholder="Ej: 20"
                      value={form.monto}
                      onChange={(e) => setForm({ ...form, monto: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 lg:col-span-2">
                    <Label className="text-sm font-bold">Observaciones</Label>
                    <Input
                      placeholder="Notas adicionales..."
                      value={form.observaciones}
                      onChange={(e) =>
                        setForm({ ...form, observaciones: e.target.value })
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
                      className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-white/[0.02] cursor-pointer hover:border-orange-400 transition-colors overflow-hidden"
                    >
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Ticket"
                          className="h-full w-full object-cover"
                        />
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
                    {v.codigo}
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
                <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filteredRefuels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-400">
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
                  <TableCell className="text-sm">{fmtDate(r.fecha)}</TableCell>
                  <TableCell className="text-sm font-mono">{getTime(r)}</TableCell>
                  <TableCell className="text-sm">
                    {r.vehiculo_codigo || `${r.vehicle_id}`}
                  </TableCell>
                  <TableCell className="text-sm">
                    {personName(getResponsibleId(r)) || "-"}
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {getFuelType(r)}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-white text-sm">
                    {r.litros}L
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.monto ? `$${r.monto}` : "-"}
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
                        onClick={() => handleDelete(r.id, r.vehiculo_codigo)}
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
                <Info label="Fecha" value={fmtDate(detailRow.fecha)} />
                <Info label="Hora" value={getTime(detailRow)} />
                <Info
                  label="Unidad"
                  value={
                    detailRow.vehiculo_nombre ||
                    detailRow.vehiculo_codigo ||
                    String(detailRow.vehicle_id)
                  }
                />
                <Info
                  label="Responsable"
                  value={personName(getResponsibleId(detailRow)) || "-"}
                />
                <Info
                  label="Combustible"
                  value={getFuelType(detailRow)}
                />
                <Info label="Litros" value={`${detailRow.litros} L`} />
                <Info
                  label="Monto"
                  value={detailRow.monto ? `$${detailRow.monto}` : "-"}
                />
                <Info
                  label="Tanque lleno"
                  value={detailRow.tanque_lleno ? "Sí" : "No"}
                />
              </div>

              {detailRow.estacion && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  <b>Estación:</b> {detailRow.estacion}
                </p>
              )}
              {detailRow.odometro != null && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  <b>Odómetro:</b> {detailRow.odometro}
                </p>
              )}
              {detailRow.observaciones && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  <b>Observaciones:</b> {detailRow.observaciones}
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
                  <FileUp size={14} /> Sin foto adjunta (foto pendiente de
                  persistencia cuando se active la fase backend)
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
};

const Info = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-3">
    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
      {label}
    </p>
    <p className="font-semibold text-slate-900 dark:text-white capitalize">
      {value}
    </p>
  </div>
);

export default FuelLightFleet;