import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, X, Pencil, Trash2 } from "lucide-react";
import { personService } from "@/services";
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
import { DEPARTMENTS } from "@/lib/catalogs";
import { readJSON, writeJSON, isPendingTransaction } from "@/lib/storage";

const PERSONS_STORAGE_KEY = "fullpetro_persons_local";

const emptyForm = {
  first_name: "",
  last_name: "",
  degree: "",
  department: "",
};

const normalize = (p) => ({
  id: p.id ?? p.person_id,
  first_name: p.first_name || p.name || "",
  last_name: p.last_name || p.lastname || "",
  degree: p.degree || "",
  department: p.department || "",
  document_id: p.document_id || p.ci || "",
});

const Persons = () => {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPersons();
  }, []);

  const loadPersons = async () => {
    try {
      const res = await personService.getAll();
      const list = (Array.isArray(res) ? res : res?.rows || []).map(normalize);
      if (list.length) setPersons(list);
      setBanner(null);
    } catch (err) {
      if (isPendingTransaction(err)) {
        setPersons(readJSON(PERSONS_STORAGE_KEY).map(normalize));
        setBanner(
          "Modo local: listar/editar/borrar personas (tx 91-94) aún no existen en el backend; los datos se guardan temporalmente en el navegador.",
        );
      } else {
        console.error(err);
      }
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

  const saveLocal = (list) => {
    writeJSON(PERSONS_STORAGE_KEY, list);
    setPersons(list.map(normalize));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const row = {
      id: editingId || Date.now(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      degree: form.degree.trim(),
      department: form.department,
      document_id: editingId
        ? persons.find((p) => p.id === editingId)?.document_id
        : undefined,
    };

    try {
      if (editingId) {
        try {
          await personService.update(editingId, form);
        } catch (err) {
          if (!isPendingTransaction(err)) throw err;
        }
        saveLocal(persons.map((p) => (p.id === editingId ? row : p)));
      } else {
        let id = row.id;
        try {
          const res = await personService.create(form);
          if (res?.person_id) id = res.person_id;
          else if (res?.id) id = res.id;
        } catch (err) {
          if (!isPendingTransaction(err)) throw err;
        }
        row.id = id;
        row.document_id = row.document_id || `PER-${id}`;
        saveLocal([...persons, row]);
      }
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (p) => {
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      degree: p.degree || "",
      department: p.department || "",
    });
    setEditingId(p.id);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (p) => {
    if (!confirm(`¿Eliminar a ${p.first_name} ${p.last_name}?`)) return;
    try {
      try {
        await personService.delete(p.id);
      } catch (err) {
        if (!isPendingTransaction(err)) throw err;
      }
      saveLocal(persons.filter((x) => x.id !== p.id));
    } catch (err) {
      console.error("Error eliminando:", err);
    }
  };

  return (
    <PageLayout
      icon={Users}
      title="Personas"
      subtitle={`REGISTRO DE PERSONAS • ${new Date().toLocaleDateString()}`}
      accentColor="orange"
    >
      {banner && (
        <div className="mb-6 p-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm flex items-center justify-between gap-4">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="shrink-0 hover:opacity-70">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Usado, por ejemplo, para asignar el <b>responsable</b> en cargas de
          combustible de flota liviana.
        </p>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-orange-500 hover:bg-orange-600 text-white transition-transform hover:scale-105 text-sm"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancelar" : "Nueva Persona"}
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
                  {editingId ? "Editar Persona" : "Registrar Persona"}
                </h3>

                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <form
                  onSubmit={handleSubmit}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Nombre *</Label>
                    <Input
                      required
                      placeholder="Ej: Juan"
                      value={form.first_name}
                      onChange={(e) =>
                        setForm({ ...form, first_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Apellido *</Label>
                    <Input
                      required
                      placeholder="Ej: Pérez"
                      value={form.last_name}
                      onChange={(e) =>
                        setForm({ ...form, last_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Cargo</Label>
                    <Input
                      placeholder="Ej: Supervisor"
                      value={form.degree}
                      onChange={(e) =>
                        setForm({ ...form, degree: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Departamento</Label>
                    <select
                      value={form.department}
                      onChange={(e) =>
                        setForm({ ...form, department: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                    >
                      <option value="">Seleccionar...</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
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
                      className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {submitting
                        ? "Guardando..."
                        : editingId
                          ? "Actualizar"
                          : "Registrar"}
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
              <TableHead>Nombre</TableHead>
              <TableHead>Apellido</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Departamento</TableHead>
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
            ) : persons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  No hay personas registradas
                </TableCell>
              </TableRow>
            ) : (
              persons.map((p, i) => (
                <TableRow
                  key={p.id}
                  className={
                    i % 2 === 0
                      ? "bg-transparent"
                      : "bg-slate-50/60 dark:bg-white/[0.02]"
                  }
                >
                  <TableCell className="text-sm">{p.first_name}</TableCell>
                  <TableCell className="text-sm">{p.last_name}</TableCell>
                  <TableCell className="text-sm">{p.degree || "-"}</TableCell>
                  <TableCell className="text-sm">
                    {p.department ? (
                      <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600">
                        {p.department}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(p)}
                        className="h-8 w-8 rounded-lg"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(p)}
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
    </PageLayout>
  );
};

export default Persons;