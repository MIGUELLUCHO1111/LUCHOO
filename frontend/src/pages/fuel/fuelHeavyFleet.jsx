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
import { useAuth, useConfirm } from "@/context";
import { fuelService } from "@/services";
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
import { exportToExcel, fmtDate, fmtTime } from "@/lib/excel";
import { TankBar } from "@/components/ui/tankBar";
import { readJSON, writeJSON, isPendingTransaction } from "@/lib/storage";

const GALLONS_TO_LITERS = 3.78541;
const FILL_UPS_STORAGE_KEY = "fullpetro_fuel_heavy_local";
const FLEET_STORAGE_KEY = "fullpetro_vehicle_fleet";

const readFleet = () => readJSON(FLEET_STORAGE_KEY, {});

const emptyForm = {
  transaction_no: "",
  fecha: new Date().toISOString().slice(0, 10),
  hora: "",
  solicitante: "",
  unidad: "",
  medida_valor: "",
  medida_tipo: "km",
  galones: "",
  nota: "",
};

const readLocal = () => readJSON(FILL_UPS_STORAGE_KEY, []);

const writeLocal = (rows) => writeJSON(FILL_UPS_STORAGE_KEY, rows);

const FuelHeavyFleet = () => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [heavyVehicles, setHeavyVehicles] = useState([]);
  const [fillUps, setFillUps] = useState([]);
  const [localMode, setLocalMode] = useState(false);

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

  const [detail, setDetail] = useState(null);
  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadVehicles();
    loadFillUps();
  }, []);

  const loadVehicles = async () => {
    try {
      const res = await fuelService.getAllVehicles();
      const list = Array.isArray(res) ? res : [];
      const fleet = readFleet();
      // La columna tipo_flota está pendiente de backend: se recuerda en sesión.
      setHeavyVehicles(
        list.filter((v) => v.tipo_flota === "pesada" || fleet[v.id] === "pesada"),
      );
    } catch (err) {
      console.warn("Unidades no disponibles:", err);
    }
  };

  const loadFillUps = async () => {
    try {
      const res = await fuelService.getAllHeavyRefuels();
      setFillUps(Array.isArray(res) ? res : []);
      setLocalMode(false);
    } catch (err) {
      if (isPendingTransaction(err)) {
        setFillUps(readLocal());
        setLocalMode(true);
        setBanner(
          "Modo local: las transacciones 96-100 (Flota Pesada) aún no existen en el backend. Los datos se guardan temporalmente en el navegador.",
        );
      } else {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearBanner = () => setBanner(null);

  const persistLocal = (rows, err) => {
    if (isPendingTransaction(err)) {
      writeLocal(rows);
      setFillUps(rows);
      setLocalMode(true);
      setBanner(
        "Operación guardada en modo local (backend de pesada pendiente, tx 96-100).",
      );
      return true;
    }
    return false;
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setPhoto(null);
    setPhotoPreview(null);
  };

  const onPhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleEdit = (r) => {
    setForm({
      transaction_no: r.transaction_no || "",
      fecha: new Date(r.fecha).toISOString().slice(0, 10),
      hora: r.hora || fmtTime(r.fecha),
      solicitante: r.solicitante || "",
      unidad: String(r.vehicle_id),
      medida_valor: r.medida_valor ?? "",
      medida_tipo: r.medida_tipo || "km",
      galones: String(r.galones ?? ""),
      nota: r.nota || "",
    });
    setEditingId(r.id);
    setPhoto(null);
    setPhotoPreview(r.fotoUrl || null);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        fecha: form.hora
          ? new Date(`${form.fecha}T${form.hora}`).toISOString()
          : new Date(form.fecha).toISOString(),
        hora: form.hora,
        solicitante: form.solicitante || null,
        vehicle_id: parseInt(form.unidad),
        combustible: "gasoil",
        medida_valor: form.medida_valor ? parseFloat(form.medida_valor) : null,
        medida_tipo: form.medida_tipo,
        galones: parseFloat(form.galones),
        nota: form.nota || null,
        created_by: parseInt(user?.id),
      };

      if (editingId) {
        await fuelService.updateHeavyRefuel(editingId, payload);
        setBanner(null);
      } else {
        const res = await fuelService.createHeavyRefuel(payload);
        if (res?.id) payload.id = res.id;
      }

      resetForm();
      loadFillUps();
    } catch (err) {
      if (isPendingTransaction(err)) {
        const row = {
          id: editingId || Date.now(),
          transaction_no: form.transaction_no || "",
          fecha: new Date(`${form.fecha}T${form.hora || "00:00"}`).toISOString(),
          hora: form.hora,
          solicitante: form.solicitante,
          vehicle_id: parseInt(form.unidad),
          galones: parseFloat(form.galones),
          medida_valor: form.medida_valor ? parseFloat(form.medida_valor) : null,
          medida_tipo: form.medida_tipo,
          nota: form.nota,
          combustible: "gasoil",
          fotoUrl: photoPreview || null,
          created_by: parseInt(user?.id),
        };
        let rows = readLocal();
        if (editingId) rows = rows.map((r) => (r.id === editingId ? row : r));
        else rows.push(row);
        persistLocal(rows, err);
        resetForm();
      } else {
        console.error("Error al guardar:", err);
        alert("No se pudo guardar. Revise la consola.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (r) => {
    const ok = await confirm(
      `¿Eliminar la carga de la unidad ${r.vehiculo_codigo || r.vehicle_id}?`,
      { title: "Eliminar carga" },
    );
    if (!ok) return;
    try {
      await fuelService.deleteHeavyRefuel(r.id);
      setBanner(null);
    } catch (err) {
      if (isPendingTransaction(err)) {
        writeLocal(readLocal().filter((x) => x.id !== r.id));
        setFillUps(readLocal());
      }
    }
  };

  // ---------- Filters ----------
  const filteredFillUps = useMemo(() => {
    return fillUps.filter((r) => {
      const d = new Date(r.fecha);
      if (filters.from && d < new Date(filters.from)) return false;
      if (filters.to) {
        const to = new Date(filters.to);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
      if (filters.unitIds.length && !filters.unitIds.includes(Number(r.vehicle_id)))
        return false;
      if (filters.requester && r.solicitante !== filters.requester) return false;
      return true;
    });
  }, [fillUps, filters]);

  const totals = useMemo(() => {
    let gallons = 0;
    for (const r of filteredFillUps) gallons += parseFloat(r.galones) || 0;
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
    return v ? `${v.codigo} - ${v.nombre}` : `Unidad ${id}`;
  };

  const getMeasurement = (r) =>
    `${r.medida_valor ?? "-"} ${r.medida_tipo || ""}`;

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
          const gal = parseFloat(r.galones) || 0;
          return [
            r.transaction_no || "",
            fmtDate(r.fecha),
            r.hora || fmtTime(r.fecha),
            r.solicitante || "",
            vehicleName(r.vehicle_id),
            r.combustible || "gasoil",
            getMeasurement(r),
            gal,
            (gal * GALLONS_TO_LITERS).toFixed(2),
            r.nota || "",
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

  // ---------- Tanque gasoil (fase 2) ----------
  const totalGasoil = fillUps.reduce(
    (acc, r) => acc + (parseFloat(r.galones) || 0),
    0,
  );

  return (
    <PageLayout
      icon={Truck}
      title="Combustible · Flota Pesada"
      subtitle={`GASOIL • ${new Date().toLocaleDateString()}`}
      accentColor="amber"
    >
      {/* ---------- Banner modo local / aviso backend ---------- */}
      {banner && (
        <div className="mb-6 p-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm flex items-center justify-between gap-4">
          <span>{banner}</span>
          <button
            onClick={clearBanner}
            className="shrink-0 hover:opacity-70"
          >
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
                      ? "bg-amber-500 text-white"
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
                      ? "bg-amber-500 text-white"
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
                            className="accent-amber-500"
                          />
                          {v.codigo} - {v.nombre}
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
              <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/10 text-sm font-black text-amber-700 dark:text-amber-400">
                {unit === "galones"
                  ? `${totals.gallons} gal`
                  : `${totals.liters} L`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Estado del tanque de gasoil (fase 2) ---------- */}
      <Card className="mb-6">
        <CardContent className="p-5 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Fuel size={26} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Tanque de gasoil
              </p>
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {unit === "galones"
                  ? `${totalGasoil.toFixed(2)} gal`
                  : `${(totalGasoil * GALLONS_TO_LITERS).toFixed(2)} L`}{" "}
                <span className="text-xs font-semibold text-slate-400">
                  consumidos hasta ahora
                </span>
              </p>
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <TankBar
              level={totalGasoil}
              capacity={Math.max(totalGasoil * 1.4, 1)}
            />
          </div>
          <p className="text-xs text-slate-400 max-w-[220px]">
            Los abastecimientos (entradas) y el nivel disponible llegarán con el
            módulo de tanque en la fase 2.
          </p>
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
          className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-amber-500 hover:bg-amber-600 text-white transition-transform hover:scale-105 text-sm"
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
            <Card className="border-amber-200 dark:border-amber-500/20">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
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
                      value={form.solicitante}
                      onChange={(e) =>
                        setForm({ ...form, solicitante: e.target.value })
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
                          {v.codigo} - {v.nombre}
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
                        value={form.medida_valor}
                        onChange={(e) =>
                          setForm({ ...form, medida_valor: e.target.value })
                        }
                      />
                      <select
                        value={form.medida_tipo}
                        onChange={(e) =>
                          setForm({ ...form, medida_tipo: e.target.value })
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
                      value={form.galones}
                      onChange={(e) => setForm({ ...form, galones: e.target.value })}
                    />
                    {form.galones && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Gauge size={12} />
                        {(parseFloat(form.galones) * GALLONS_TO_LITERS).toFixed(2)} L
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label className="text-sm font-bold">Nota</Label>
                    <Input
                      placeholder="Detalle adicional..."
                      value={form.nota}
                      onChange={(e) => setForm({ ...form, nota: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Foto (opcional)</Label>
                    <label className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-white/[0.02] cursor-pointer hover:border-amber-400 transition-colors overflow-hidden">
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
                      className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
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
            ) : filteredFillUps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-400">
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
                  <TableCell className="text-sm font-mono text-amber-600 dark:text-amber-400">
                    {r.transaction_no || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(r.fecha)}</TableCell>
                  <TableCell className="text-sm font-mono">
                    {r.hora || fmtTime(r.fecha) || "-"}
                  </TableCell>
                  <TableCell className="text-sm">{r.solicitante || "-"}</TableCell>
                  <TableCell className="text-sm">{vehicleName(r.vehicle_id)}</TableCell>
                  <TableCell className="text-sm">{getMeasurement(r)}</TableCell>
                  <TableCell className="text-sm capitalize">
                    {r.combustible || "gasoil"}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-white text-sm">
                    {unit === "galones"
                      ? `${r.galones} gal`
                      : `${(parseFloat(r.galones) * GALLONS_TO_LITERS).toFixed(2)} L`}
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
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
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
                <Info label="Fecha" value={fmtDate(detail.fecha)} />
                <Info label="Hora" value={detail.hora || fmtTime(detail.fecha) || "-"} />
                <Info label="Solicitante" value={detail.solicitante || "-"} />
                <Info label="Combustible" value={detail.combustible || "gasoil"} />
                <Info label="Medida" value={getMeasurement(detail)} />
                <Info
                  label="Cantidad"
                  value={`${detail.galones} gal (${(parseFloat(detail.galones) * GALLONS_TO_LITERS).toFixed(2)} L)`}
                />
              </div>

              {detail.nota && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  <b>Nota:</b> {detail.nota}
                </p>
              )}

              {detail.fotoUrl && (
                <a
                  href={detail.fotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block"
                >
                  <img
                    src={detail.fotoUrl}
                    alt="Ticket"
                    className="w-full max-h-72 object-contain rounded-2xl border border-slate-200 dark:border-slate-700"
                  />
                </a>
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
        mono ? "font-mono text-amber-600 dark:text-amber-400" : ""
      }`}
    >
      {value}
    </p>
  </div>
);

export default FuelHeavyFleet;