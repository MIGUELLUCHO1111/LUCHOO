import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, Plus, X, Pencil, Trash2 } from "lucide-react";
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
import { useConfirm } from "@/context";

const Vehicles = () => {
  const confirm = useConfirm();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    plate: "",
    tank_capacity_liters: "",
    fleet_type: "LIVIANA",
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      const res = await fuelService.getAllVehicles();
      setVehicles(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando vehículos:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      code: "",
      name: "",
      plate: "",
      tank_capacity_liters: "",
      fleet_type: "LIVIANA",
    });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (vehicle) => {
    setForm({
      code: vehicle.code,
      name: vehicle.name,
      plate: vehicle.plate || "",
      tank_capacity_liters: vehicle.tank_capacity_liters || "",
      fleet_type: vehicle.fleet_type || "LIVIANA",
    });
    setEditingId(vehicle.id);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (editingId) {
        await fuelService.updateVehicle(editingId, {
          name: form.name,
          plate: form.plate || null,
          tank_capacity_liters: form.tank_capacity_liters ? parseInt(form.tank_capacity_liters) : null,
          fleet_type: form.fleet_type,
        });
      } else {
        await fuelService.createVehicle({
          code: form.code,
          name: form.name,
          plate: form.plate || null,
          tank_capacity_liters: form.tank_capacity_liters ? parseInt(form.tank_capacity_liters) : null,
          fleet_type: form.fleet_type,
        });
      }
      resetForm();
      loadVehicles();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Error al guardar";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, code) => {
    const ok = await confirm(`¿Eliminar vehículo ${code}?`, {
      title: "Eliminar vehículo",
    });
    if (!ok) return;

    try {
      await fuelService.deleteVehicle(id);
      loadVehicles();
    } catch (err) {
      console.error("Error eliminando:", err);
    }
  };

  return (
    <PageLayout
      icon={Truck}
      title="Unidades"
      subtitle={`GESTIÓN DE VEHÍCULOS • ${new Date().toLocaleDateString()}`}
      accentColor="navy"
    >
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-brand-navy hover:bg-brand-navy-light text-white transition-transform hover:scale-105 text-sm"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancelar" : "Nueva Unidad"}
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
                  {editingId ? "Editar Unidad" : "Nueva Unidad"}
                </h3>

                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Código *</Label>
                    <Input
                      required
                      placeholder="Ej: VH-001"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      disabled={!!editingId}
                      className={editingId ? "opacity-50" : ""}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Nombre *</Label>
                    <Input
                      required
                      placeholder="Ej: Camioneta Ford"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Placa</Label>
                    <Input
                      placeholder="Ej: ABC-123"
                      value={form.plate}
                      onChange={(e) => setForm({ ...form, plate: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Capacidad tanque (litros)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Ej: 80"
                      value={form.tank_capacity_liters}
                      onChange={(e) => setForm({ ...form, tank_capacity_liters: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Tipo de flota *</Label>
                    <select
                      value={form.fleet_type}
                      onChange={(e) => setForm({ ...form, fleet_type: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                    >
                      <option value="LIVIANA">Liviana</option>
                      <option value="PESADA">Pesada</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 flex justify-end gap-3">
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
                      {submitting ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="w-full overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Cap. Tanque</TableHead>
              <TableHead>Flota</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  No hay vehículos registrados
                </TableCell>
              </TableRow>
            ) : (
              vehicles.map((v, i) => (
                <TableRow
                  key={v.id}
                  className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}
                >
                  <TableCell className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {v.code}
                  </TableCell>
                  <TableCell className="text-sm">{v.name}</TableCell>
                  <TableCell className="text-sm">{v.plate || "-"}</TableCell>
                  <TableCell className="text-sm">{v.tank_capacity_liters ? `${v.tank_capacity_liters}L` : "-"}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${v.fleet_type === "PESADA" ? "bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold" : "bg-brand-navy/10 text-brand-navy dark:text-white"}`}>
                      {v.fleet_type === "PESADA" ? "Pesada" : "Liviana"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${v.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                      {v.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(v)}
                        className="h-8 w-8 rounded-lg"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(v.id, v.code)}
                        className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
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
    </PageLayout>
  );
};

export default Vehicles;