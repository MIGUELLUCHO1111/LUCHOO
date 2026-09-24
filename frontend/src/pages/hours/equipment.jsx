import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, Plus, X, Pencil, Trash2 } from "lucide-react";
import { hoursService } from "@/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

const Equipment = () => {
  const confirm = useConfirm();
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({ code: "", name: "", is_active: true });

  useEffect(() => {
    loadEquipos();
  }, []);

  const loadEquipos = async () => {
    try {
      const res = await hoursService.getAllEquipos();
      setEquipos(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando equipos:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ code: "", name: "", is_active: true });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (equipo) => {
    setForm({ code: equipo.code, name: equipo.name || "", is_active: equipo.is_active });
    setEditingId(equipo.id);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (editingId) {
        await hoursService.updateEquipo(editingId, { name: form.name || null, is_active: form.is_active });
      } else {
        await hoursService.createEquipo({ code: form.code, name: form.name || null });
      }
      resetForm();
      loadEquipos();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Error al guardar";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, code) => {
    const ok = await confirm(`¿Eliminar equipo ${code}?`, { title: "Eliminar equipo" });
    if (!ok) return;

    try {
      await hoursService.deleteEquipo(id);
      loadEquipos();
    } catch (err) {
      console.error("Error eliminando:", err);
    }
  };

  return (
    <PageLayout
      icon={Wrench}
      title="Equipos"
      subtitle={`CONTROL DE HORAS • ${new Date().toLocaleDateString()}`}
      accentColor="navy"
    >
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-brand-navy hover:bg-brand-navy-light text-white transition-transform hover:scale-105 text-sm"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancelar" : "Nuevo Equipo"}
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
                  {editingId ? "Editar Equipo" : "Nuevo Equipo"}
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
                      placeholder="Ej: FP-GT-02"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      disabled={!!editingId}
                      className={editingId ? "opacity-50" : ""}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Nombre</Label>
                    <Input
                      placeholder="Ej: Grúa Torre 02"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  {editingId && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-sm font-bold">Activo</Label>
                      <div className="flex items-center gap-2 h-10">
                        <Switch
                          checked={form.is_active}
                          onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                        />
                        <span className="text-sm text-slate-500">{form.is_active ? "Sí" : "No"}</span>
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl">
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
              <TableHead>Proyecto actual</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : equipos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  No hay equipos registrados
                </TableCell>
              </TableRow>
            ) : (
              equipos.map((e, i) => (
                <TableRow key={e.id} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                  <TableCell className="font-mono font-bold text-slate-900 dark:text-white text-sm">{e.code}</TableCell>
                  <TableCell className="text-sm">{e.name || "-"}</TableCell>
                  <TableCell className="text-sm">
                    {e.current_assignment ? e.current_assignment.project_name : (
                      <span className="text-slate-400">Sin asignar</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${e.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                      {e.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleEdit(e)} className="h-8 w-8 rounded-lg">
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(e.id, e.code)}
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
      <p className="text-xs text-slate-400 mt-3">
        Para asignar un equipo a un proyecto, ve a Proyectos → botón "Equipos" en la fila del proyecto.
      </p>
    </PageLayout>
  );
};

export default Equipment;
