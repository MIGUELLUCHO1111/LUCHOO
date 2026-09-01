import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fuel, Plus, X, Pencil, Trash2, ArrowDownToLine, History } from "lucide-react";
import { useAuth, useConfirm } from "@/context";
import { fuelService } from "@/services";
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
import { fmtDate, fmtTime } from "@/lib/excel";

const emptyForm = {
  code: "",
  name: "",
  capacity_liters: "",
  min_alert_liters: "",
  fuel_type: "gasoil",
  is_active: true,
};

const emptyMovementForm = {
  movement_type: "in",
  quantity_liters: "",
  notes: "",
};

const FuelTank = () => {
  const { user } = useAuth();
  const confirm = useConfirm();

  const [tanks, setTanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [movementTank, setMovementTank] = useState(null);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [movementSubmitting, setMovementSubmitting] = useState(false);
  const [movementError, setMovementError] = useState(null);

  const [historyTank, setHistoryTank] = useState(null);
  const [movements, setMovements] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadTanks();
  }, []);

  const loadTanks = async () => {
    try {
      const res = await fuelService.getAllTanks();
      setTanks(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando tanques:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (tank) => {
    setForm({
      code: tank.code,
      name: tank.name,
      capacity_liters: String(tank.capacity_liters ?? ""),
      min_alert_liters: String(tank.min_alert_liters ?? ""),
      fuel_type: tank.fuel_type,
      is_active: !!tank.is_active,
    });
    setEditingId(tank.id);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        capacity_liters: parseFloat(form.capacity_liters),
        min_alert_liters: form.min_alert_liters ? parseFloat(form.min_alert_liters) : 0,
        fuel_type: form.fuel_type,
        is_active: form.is_active,
      };

      if (editingId) {
        await fuelService.updateTank(editingId, payload);
      } else {
        await fuelService.createTank({ ...payload, code: form.code });
      }

      resetForm();
      loadTanks();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Error al guardar";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tank) => {
    const ok = await confirm(`¿Eliminar el tanque ${tank.code}?`, {
      title: "Eliminar tanque",
    });
    if (!ok) return;
    try {
      await fuelService.deleteTank(tank.id);
      loadTanks();
    } catch (err) {
      console.error("Error eliminando tanque:", err);
    }
  };

  // ---------- Movimientos ----------
  const openMovementModal = (tank) => {
    setMovementTank(tank);
    setMovementForm(emptyMovementForm);
    setMovementError(null);
  };

  const closeMovementModal = () => {
    setMovementTank(null);
    setMovementError(null);
  };

  const handleRegisterMovement = async (e) => {
    e.preventDefault();
    setMovementSubmitting(true);
    setMovementError(null);
    try {
      await fuelService.registerMovement({
        tank_id: movementTank.id,
        movement_type: movementForm.movement_type,
        quantity_liters: parseFloat(movementForm.quantity_liters),
        reference_type: "manual",
        notes: movementForm.notes || null,
        created_by: parseInt(user?.id),
      });
      closeMovementModal();
      loadTanks();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Error al registrar el movimiento";
      setMovementError(msg);
    } finally {
      setMovementSubmitting(false);
    }
  };

  const openHistory = async (tank) => {
    setHistoryTank(tank);
    setHistoryLoading(true);
    try {
      const res = await fuelService.getMovementsByTank(tank.id);
      setMovements(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando movimientos:", err);
      setMovements([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <PageLayout
      icon={Fuel}
      title="Tanque de Gasoil"
      subtitle={`GESTIÓN DE TANQUES • ${new Date().toLocaleDateString()}`}
      accentColor="amber"
    >
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-amber-500 hover:bg-amber-600 text-white transition-transform hover:scale-105 text-sm"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancelar" : "Nuevo Tanque"}
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
                  {editingId ? "Editar Tanque" : "Nuevo Tanque"}
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
                      placeholder="Ej: TANQUE-01"
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
                      placeholder="Ej: Tanque Principal de Gasoil"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Capacidad (litros) *</Label>
                    <Input
                      required
                      type="number"
                      min="0"
                      placeholder="Ej: 5000"
                      value={form.capacity_liters}
                      onChange={(e) => setForm({ ...form, capacity_liters: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Alerta mínima (litros)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Ej: 500"
                      value={form.min_alert_liters}
                      onChange={(e) => setForm({ ...form, min_alert_liters: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Combustible</Label>
                    <select
                      value={form.fuel_type}
                      onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                    >
                      <option value="gasoil">Gasoil</option>
                      <option value="gasolina">Gasolina</option>
                      <option value="diesel">Diesel</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Activo</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={form.is_active}
                        onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                      />
                      <span className="text-sm text-slate-500">
                        {form.is_active ? "Sí" : "No"}
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl">
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-sm text-slate-400 col-span-full text-center py-8">Cargando...</p>
        ) : tanks.length === 0 ? (
          <p className="text-sm text-slate-400 col-span-full text-center py-8">
            No hay tanques registrados
          </p>
        ) : (
          tanks.map((t) => {
            const low = Number(t.current_level_liters) <= Number(t.min_alert_liters);
            return (
              <Card key={t.id} className={low ? "border-red-300 dark:border-red-500/30" : ""}>
                <CardContent className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-xs text-amber-600 dark:text-amber-400 font-bold">
                        {t.code}
                      </p>
                      <p className="font-bold text-slate-900 dark:text-white">{t.name}</p>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          t.is_active
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-red-500/10 text-red-600"
                        }`}
                      >
                        {t.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openHistory(t)}
                        className="h-8 w-8 rounded-lg"
                        title="Ver movimientos"
                      >
                        <History size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(t)}
                        className="h-8 w-8 rounded-lg"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(t)}
                        className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <TankBar level={t.current_level_liters} capacity={t.capacity_liters} />
                    <div className="text-sm">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {Math.round(t.current_level_liters)} / {Math.round(t.capacity_liters)} L
                      </p>
                      <p className="text-xs text-slate-400 capitalize">{t.fuel_type}</p>
                      {low && (
                        <p className="text-xs text-red-500 font-bold">Nivel bajo mínimo</p>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => openMovementModal(t)}
                    className="rounded-xl flex items-center gap-2 text-sm"
                  >
                    <ArrowDownToLine size={14} /> Registrar movimiento
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ---------- Modal registrar movimiento ---------- */}
      <AnimatePresence>
        {movementTank && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeMovementModal}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/5 shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Movimiento · {movementTank.code}
                </h3>
                <Button variant="ghost" size="icon" onClick={closeMovementModal} className="rounded-xl">
                  <X size={18} />
                </Button>
              </div>

              {movementError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                  {movementError}
                </div>
              )}

              <form onSubmit={handleRegisterMovement} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-bold">Tipo *</Label>
                  <select
                    value={movementForm.movement_type}
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, movement_type: e.target.value })
                    }
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                  >
                    <option value="in">Entrada (abastecimiento)</option>
                    <option value="out">Salida (despacho manual)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-bold">Litros *</Label>
                  <Input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ej: 1000"
                    value={movementForm.quantity_liters}
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, quantity_liters: e.target.value })
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-bold">Nota</Label>
                  <Input
                    placeholder="Detalle adicional..."
                    value={movementForm.notes}
                    onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={closeMovementModal} className="rounded-xl">
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={movementSubmitting}
                    className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {movementSubmitting ? "Guardando..." : "Registrar"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Modal historial de movimientos ---------- */}
      <AnimatePresence>
        {historyTank && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setHistoryTank(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/5 shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Movimientos · {historyTank.code}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setHistoryTank(null)} className="rounded-xl">
                  <X size={18} />
                </Button>
              </div>

              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Litros</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-slate-400">
                          Cargando...
                        </TableCell>
                      </TableRow>
                    ) : movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-slate-400">
                          Sin movimientos registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      movements.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-sm">{fmtDate(m.created_at)}</TableCell>
                          <TableCell className="text-sm font-mono">{fmtTime(m.created_at)}</TableCell>
                          <TableCell className="text-sm">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                m.movement_type === "in"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-amber-500/10 text-amber-600"
                              }`}
                            >
                              {m.movement_type === "in" ? "Entrada" : "Salida"}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-bold">{m.quantity_liters} L</TableCell>
                          <TableCell className="text-sm capitalize">
                            {m.reference_type || "-"}
                            {m.reference_id ? ` #${m.reference_id}` : ""}
                          </TableCell>
                          <TableCell className="text-sm">{m.notes || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
};

export default FuelTank;
