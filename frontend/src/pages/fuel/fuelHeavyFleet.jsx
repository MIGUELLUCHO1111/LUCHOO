import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck,
  Plus,
  X,
  Pencil,
  Trash2,
  Eye,
  FileDown,
  Camera,
  Gauge,
  Fuel,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth, useConfirm } from "@/context";
import { fuelService, resolvePhotoUrl } from "@/services";
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
import { exportToExcel, fmtDate, fmtTime, fmtTimeInput } from "@/lib/excel";
import { TankBar } from "@/components/ui/tankBar";

const GALLONS_TO_LITERS = 3.78541;

const emptyForm = {
  transaction_no: "",
  fecha: new Date().toISOString().slice(0, 10),
  hora: "",
  requester: "",
  unidad: "",
  measurement_value: "",
  measurement_type: "km",
  gallons: "",
  notes: "",
};

const FuelHeavyFleet = () => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [heavyVehicles, setHeavyVehicles] = useState([]);
  const [fillUps, setFillUps] = useState([]);
  const [gasoilTank, setGasoilTank] = useState(null);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    unitIds: [],
    requester: "",
  });
  const [showUnitFilter, setShowUnitFilter] = useState(false);

  const [unit, setUnit] = useState("galones"); // galones | litros

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

  useEffect(() => {
    loadVehicles();
    loadFillUps();
    loadGasoilTank();
  }, []);

  const loadVehicles = async () => {
    try {
      const res = await fuelService.getAllVehicles();
      const list = Array.isArray(res) ? res : [];
      setHeavyVehicles(list.filter((v) => v.fleet_type === "pesada"));
    } catch (err) {
      console.warn("Unidades no disponibles:", err);
    }
  };

  const loadGasoilTank = async () => {
    try {
      const res = await fuelService.getAllTanks();
      const list = Array.isArray(res) ? res : [];
      setGasoilTank(list.find((t) => t.fuel_type === "gasoil" && t.is_active) || null);
    } catch (err) {
      console.warn("Tanques no disponibles:", err);
    }
  };

  const loadFillUps = async () => {
    try {
      const res = await fuelService.getAllHeavyRefuels();
      setFillUps(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setPhoto(null);
    setPhotoPreview(null);
    setExistingPhotoId(null);
    setError(null);
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
      transaction_no: r.transaction_no || "",
      fecha: new Date(r.filled_at).toISOString().slice(0, 10),
      hora: fmtTimeInput(r.filled_at),
      requester: r.requester || "",
      unidad: String(r.vehicle_id),
      measurement_value: r.measurement_value ?? "",
      measurement_type: r.measurement_type || "km",
      gallons: String(r.gallons ?? ""),
      notes: r.notes || "",
    });
    setEditingId(r.id);
    setPhoto(null);
    setPhotoPreview(getPhotoUrl(r));
    setExistingPhotoId(r.photos?.at(-1)?.id ?? null);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const filledAtISO = form.hora
        ? new Date(`${form.fecha}T${form.hora}`).toISOString()
        : new Date(form.fecha).toISOString();

      const payload = {
        transaction_no: form.transaction_no || null,
        filled_at: filledAtISO,
        requester: form.requester || null,
        vehicle_id: parseInt(form.unidad),
        fuel_type: "gasoil",
        measurement_value: form.measurement_value ? parseFloat(form.measurement_value) : null,
        measurement_type: form.measurement_type,
        gallons: parseFloat(form.gallons),
        notes: form.notes || null,
        created_by: parseInt(user?.id),
      };

      let recordId = editingId;
      if (editingId) {
        await fuelService.updateHeavyRefuel(editingId, payload);
      } else {
        const res = await fuelService.createHeavyRefuel(payload);
        recordId = res?.id;
      }

      let photoWarning = null;
      if (recordId && photo) {
        try {
          await fuelService.uploadFuelPhoto({ targetType: "pesada", targetId: recordId, file: photo });
        } catch (photoErr) {
          const photoMsg =
            photoErr.response?.data?.message || photoErr.message || "error desconocido";
          photoWarning = `Carga guardada, pero la foto no se pudo subir: ${photoMsg}`;
        }
      }

      resetForm();
      loadFillUps();
      loadGasoilTank();
      if (photoWarning) setError(photoWarning);
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

  const handleDelete = async (r) => {
    const ok = await confirm(
      `¿Eliminar la carga de la unidad ${r.vehicle_code || r.vehicle_id}?`,
      { title: "Eliminar carga" },
    );
    if (!ok) return;
    try {
      await fuelService.deleteHeavyRefuel(r.id);
      loadFillUps();
    } catch (err) {
      console.error("Error eliminando:", err);
    }
  };

  // ---------- Filters ----------
  const filteredFillUps = useMemo(() => {
    return fillUps.filter((r) => {
      const d = new Date(r.filled_at);
      if (filters.from && d < new Date(filters.from)) return false;
      if (filters.to) {
        const to = new Date(filters.to);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      if (filters.unitIds.length && !filters.unitIds.includes(Number(r.vehicle_id)))
        return false;
      if (filters.requester && r.requester !== filters.requester) return false;
      return true;
    });
  }, [fillUps, filters]);

  const totals = useMemo(() => {
    let gallons = 0;
    for (const r of filteredFillUps) gallons += parseFloat(r.gallons) || 0;
    return {
      gallons: +gallons.toFixed(2),
      liters: +(gallons * GALLONS_TO_LITERS).toFixed(2),
    };
  }, [filteredFillUps]);

  const toggleUnitFilter = (id) =>
    setFilters((f) => {
      const set = new Set(f.unitIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, unitIds: [...set] };
    });

  const clearFilters = () =>
    setFilters({ from: "", to: "", unitIds: [], requester: "" });

  const vehicleName = (id) => {
    const v = heavyVehicles.find((x) => String(x.id) === String(id));
    return v ? `${v.code} - ${v.name}` : `Unidad ${id}`;
  };

  const getMeasurement = (r) =>
    `${r.measurement_value ?? "-"} ${r.measurement_type || ""}`;

  const getPhotoUrl = (r) => resolvePhotoUrl(r.photos?.at(-1)?.url);

  // ---------- Excel ----------
  const exportExcel = async () => {
    const headers = [
      "Transaction ID",
      "Fecha",
      "Hora",
      "Solicitante",
      "Unidad",
      "Combustible",
      "Medida (km/h)",
      "Galones",
      "Litros",
      "Nota",
    ];
    try {
      await exportToExcel({
        fileName: `FlotaPesada_${new Date().toISOString().slice(0, 10)}`,
        sheetName: "Flota Pesada",
        headers,
        rows: filteredFillUps.map((r) => {
          const gal = parseFloat(r.gallons) || 0;
          return [
            r.transaction_no || "",
            fmtDate(r.filled_at),
            fmtTime(r.filled_at) || "-",
            r.requester || "",
            vehicleName(r.vehicle_id),
            r.fuel_type || "gasoil",
            getMeasurement(r),
            gal,
            (gal * GALLONS_TO_LITERS).toFixed(2),
            r.notes || "",
          ];
        }),
        totals: [
          "TOTAL",
          "",
          "",
          "",
          "",
          "",
          "",
          totals.gallons,
          totals.liters,
          "",
        ],
      });
    } catch (err) {
      console.error("Error exportando Excel:", err);
      alert("No se pudo exportar el Excel.");
    }
  };

  return (
    <PageLayout
      icon={Truck}
      title="Combustible · Flota Pesada"
      subtitle={`GASOIL • ${new Date().toLocaleDateString()}`}
      accentColor="navy"
    >
      {/* ---------- Aviso de error ---------- */}
      {error && (
        <div className="mb-6 p-3 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm flex items-center justify-between gap-4">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 hover:opacity-70">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ---------- Barra de filtros + switch ---------- */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
              Filtrar
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-1 py-1">
                <button
                  type="button"
                  onClick={() => setUnit("galones")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                    unit === "galones"
                      ? "bg-brand-navy text-white"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Galones
                </button>
                <button
                  type="button"
                  onClick={() => setUnit("litros")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                    unit === "litros"
                      ? "bg-brand-navy text-white"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Litros
                </button>
              </div>
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
                  <span className="transition-transform">▾</span>
                </Button>
                <AnimatePresence>
                  {showUnitFilter && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute z-30 mt-2 w-full max-h-52 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] shadow-xl p-2"
                    >
                      {heavyVehicles.map((v) => (
                        <label
                          key={v.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={filters.unitIds.includes(Number(v.id))}
                            onChange={() => toggleUnitFilter(Number(v.id))}
                            className="accent-brand-navy"
                          />
                          {v.code} - {v.name}
                        </label>
                      ))}
                      {heavyVehicles.length === 0 && (
                        <p className="px-2 py-1 text-xs text-slate-400">
                          Marque vehículos como "pesada" en Unidades.
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">Solicitante</Label>
              <Input
                placeholder="Nombre del solicitante"
                value={filters.requester}
                onChange={(e) =>
                  setFilters({ ...filters, requester: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">Total consumido</Label>
              <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-brand-gold/30 dark:border-brand-gold/20 bg-brand-gold/10 text-sm font-black text-brand-gold-dark dark:text-brand-gold">
                {unit === "galones"
                  ? `${totals.gallons} gal`
                  : `${totals.liters} L`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Estado del tanque de gasoil activo ---------- */}
      <Card className="mb-6">
        <CardContent className="p-5 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Fuel size={26} className="text-brand-navy shrink-0" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {gasoilTank ? gasoilTank.name : "Tanque de gasoil"}
              </p>
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {gasoilTank ? (
                  <>
                    {Math.round(gasoilTank.current_level_liters)} / {Math.round(gasoilTank.capacity_liters)} L
                  </>
                ) : (
                  <span className="text-sm font-semibold text-slate-400">
                    Sin tanque activo configurado
                  </span>
                )}
              </p>
            </div>
          </div>
          {gasoilTank && (
            <div className="flex-1 min-w-[200px]">
              <TankBar
                level={gasoilTank.current_level_liters}
                capacity={gasoilTank.capacity_liters}
              />
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => navigate("/fuel/tank")}
            className="rounded-xl text-sm ml-auto"
          >
            Ver Tanque de Gasoil
          </Button>
        </CardContent>
      </Card>

      {/* ---------- Nueva carga Pesada ---------- */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
          Registro de Cargas · Pesada
        </h3>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-brand-navy hover:bg-brand-navy-light text-white transition-transform hover:scale-105 text-sm"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancelar" : "Nueva Carga"}
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
            <Card className="border-brand-navy/20 dark:border-brand-navy-light/20">
              <CardContent className="p-6">
                <h3 className="font-display text-lg text-slate-900 dark:text-white mb-4">
                  {editingId ? "Editar Carga Pesada" : "Registrar Carga Pesada"}
                </h3>

                <form
                  onSubmit={handleSubmit}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Transaction ID</Label>
                    <Input
                      placeholder="Nomenclatura por definir"
                      value={form.transaction_no}
                      onChange={(e) =>
                        setForm({ ...form, transaction_no: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Fecha *</Label>
                    <Input
                      required
                      type="date"
                      value={form.fecha}
                      onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Hora *</Label>
                    <Input
                      required
                      type="time"
                      value={form.hora}
                      onChange={(e) => setForm({ ...form, hora: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Solicitante *</Label>
                    <Input
                      required
                      placeholder="Quién lo solicitó"
                      value={form.requester}
                      onChange={(e) =>
                        setForm({ ...form, requester: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Unidad *</Label>
                    <select
                      required
                      value={form.unidad}
                      onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                    >
                      <option value="">Seleccionar...</option>
                      {heavyVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.code} - {v.name}
                        </option>
                      ))}
                    </select>
                    {heavyVehicles.length === 0 && (
                      <p className="text-[11px] text-amber-500">
                        Ninguna unidad marcada como pesada. Regístrela en
                        "Unidades".
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Combustible</Label>
                    <Input value="Gasoil" disabled className="bg-slate-100 dark:bg-white/5" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Medida (km / horas)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        placeholder="Ej: 12000"
                        value={form.measurement_value}
                        onChange={(e) =>
                          setForm({ ...form, measurement_value: e.target.value })
                        }
                      />
                      <select
                        value={form.measurement_type}
                        onChange={(e) =>
                          setForm({ ...form, measurement_type: e.target.value })
                        }
                        className="px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                      >
                        <option value="km">km</option>
                        <option value="horas">horas</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Galones *</Label>
                    <Input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ej: 12.5"
                      value={form.gallons}
                      onChange={(e) => setForm({ ...form, gallons: e.target.value })}
                    />
                    {form.gallons && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Gauge size={12} />
                        {(parseFloat(form.gallons) * GALLONS_TO_LITERS).toFixed(2)} L
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label className="text-sm font-bold">Nota</Label>
                    <Input
                      placeholder="Detalle adicional..."
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Foto (opcional)</Label>
                    <label className="relative flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-white/[0.02] cursor-pointer hover:border-brand-navy-light transition-colors overflow-hidden">
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
                            {photo ? photo.name : "Seleccionar imagen (opcional)"}
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
                      className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white"
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

      {/* ---------- Tabla ---------- */}
      <Card className="w-full overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Medida</TableHead>
              <TableHead>Combustible</TableHead>
              <TableHead>Galones</TableHead>
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
            ) : filteredFillUps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-slate-400">
                  No hay cargas pesadas registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredFillUps.map((r, i) => (
                <TableRow
                  key={r.id}
                  className={
                    i % 2 === 0
                      ? "bg-transparent"
                      : "bg-slate-50/60 dark:bg-white/[0.02]"
                  }
                >
                  <TableCell className="text-sm font-mono text-brand-navy dark:text-brand-navy-light">
                    {r.transaction_no || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(r.filled_at)}</TableCell>
                  <TableCell className="text-sm font-mono">
                    {fmtTime(r.filled_at) || "-"}
                  </TableCell>
                  <TableCell className="text-sm">{r.requester || "-"}</TableCell>
                  <TableCell className="text-sm">{vehicleName(r.vehicle_id)}</TableCell>
                  <TableCell className="text-sm">{getMeasurement(r)}</TableCell>
                  <TableCell className="text-sm capitalize">
                    {r.fuel_type || "gasoil"}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-white text-sm">
                    {unit === "galones"
                      ? `${r.gallons} gal`
                      : `${(parseFloat(r.gallons) * GALLONS_TO_LITERS).toFixed(2)} L`}
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
                        onClick={() => handleDelete(r)}
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
        {detail && (
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
                <h3 className="font-display text-lg text-slate-900 dark:text-white">
                  Detalle de carga pesada
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
                <Info label="Transaction ID" value={detail.transaction_no || "-"} mono />
                <Info label="Unidad" value={vehicleName(detail.vehicle_id)} />
                <Info label="Fecha" value={fmtDate(detail.filled_at)} />
                <Info label="Hora" value={fmtTime(detail.filled_at) || "-"} />
                <Info label="Solicitante" value={detail.requester || "-"} />
                <Info label="Combustible" value={detail.fuel_type || "gasoil"} />
                <Info label="Medida" value={getMeasurement(detail)} />
                <Info
                  label="Cantidad"
                  value={`${detail.gallons} gal (${(parseFloat(detail.gallons) * GALLONS_TO_LITERS).toFixed(2)} L)`}
                />
              </div>

              {detail.notes && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  <b>Nota:</b> {detail.notes}
                </p>
              )}

              {getPhotoUrl(detail) ? (
                <a href={getPhotoUrl(detail)} target="_blank" rel="noreferrer" className="mt-4 block">
                  <img
                    src={getPhotoUrl(detail)}
                    alt="Ticket"
                    className="w-full max-h-72 object-contain rounded-2xl border border-slate-200 dark:border-slate-700"
                  />
                </a>
              ) : (
                <p className="mt-4 text-xs text-slate-400">Sin foto adjunta</p>
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
      className={`font-semibold text-slate-900 dark:text-white ${
        mono ? "font-mono text-brand-navy dark:text-brand-navy-light" : ""
      }`}
    >
      {value}
    </p>
  </div>
);

export default FuelHeavyFleet;
