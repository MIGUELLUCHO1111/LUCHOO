import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Plus, X, Pencil, Trash2, UserCog, Save } from "lucide-react";
import { profileService, userService } from "@/services";
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
import { readJSON, writeJSON, isPendingTransaction } from "@/lib/storage";

const PROFILES_STORAGE_KEY = "fullpetro_profiles_local";
const USERS_STORAGE_KEY = "fullpetro_users_local";
const ASSIGN_STORAGE_KEY = "fullpetro_user_profiles_local";

const fallbackRoles = [
  { id: 1, name: "admin", description: "Administrador del sistema", is_active: true },
];

const readRoles = () => {
  const local = readJSON(PROFILES_STORAGE_KEY, null);
  if (local === null || local.length === 0) {
    writeJSON(PROFILES_STORAGE_KEY, fallbackRoles);
    return fallbackRoles;
  }
  return local;
};

const emptyForm = { name: "", description: "", is_active: true };

const normalizeRole = (p) => ({
  id: p.id ?? p.profile_id,
  name: p.name || p.profile_de || p.profile_name || "",
  description: p.description || "",
  is_active: p.is_active !== false,
});

const normalizeUser = (u) => ({
  id: u.id ?? u.user_id,
  first_name: u.first_name || (u.name ? u.name.split(" ")[0] : ""),
  last_name: u.last_name || (u.name ? u.name.split(" ").slice(1).join(" ") : ""),
  name: u.name || u.username || "",
});

const Profiles = () => {
  const confirm = useConfirm();
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignment, setAssignment] = useState({});
  const [banner, setBanner] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [assigningId, setAssigningId] = useState("");
  const [assigningSel, setAssigningSel] = useState({});
  const [savingAssignment, setSavingAssignment] = useState(false);

  const load = async () => {
    try {
      const res = await profileService.getAll();
      const list = Array.isArray(res) ? res : res?.rows || [];
      if (list.length) {
        // El switch "Activo" del formulario solo cambia is_active (el rol
        // sigue en la lista, marcado Inactivo). "Eliminar" es aparte: borra
        // la fila de verdad, así que no hace falta filtrar nada aquí.
        setRoles(list.map(normalizeRole));
        writeJSON(PROFILES_STORAGE_KEY, list);
        setBanner(null);
      } else {
        setRoles(readRoles());
      }
    } catch (_) {
      setRoles(readRoles());
      setBanner(
        "Modo local: no se pudo contactar al backend; los datos se guardan temporalmente en el navegador.",
      );
    }

    try {
      const res = await userService.getAll();
      const list = (Array.isArray(res) ? res : res?.rows || []).map(normalizeUser);
      if (list.length) {
        writeJSON(USERS_STORAGE_KEY, list);
        setUsers(list);
      } else {
        setUsers(readJSON(USERS_STORAGE_KEY).map(normalizeUser));
      }
    } catch (_) {
      setUsers(readJSON(USERS_STORAGE_KEY).map(normalizeUser));
    }

    setAssignment(readJSON(ASSIGN_STORAGE_KEY, {}));
  };

  useEffect(() => {
    load();
  }, []);

  const saveRoles = (list) => {
    writeJSON(PROFILES_STORAGE_KEY, list);
    setRoles(list.map(normalizeRole));
  };

  // ---------- CRUD de roles ----------
  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const row = {
      id: editingId || Date.now(),
      name: form.name.trim(),
      description: form.description.trim(),
      is_active: form.is_active,
    };

    try {
      if (editingId) {
        try {
          await profileService.update(editingId, {
            name: row.name,
            description: row.description,
            is_active: row.is_active,
          });
        } catch (err) {
          if (!isPendingTransaction(err)) throw err;
        }
        saveRoles(roles.map((r) => (r.id === editingId ? row : r)));
      } else {
        try {
          const res = await profileService.create({ name: row.name, description: row.description });
          if (res?.profile_id) row.id = res.profile_id;
          else if (res?.id) row.id = res.id;
        } catch (err) {
          if (!isPendingTransaction(err)) throw err;
        }
        saveRoles([...roles, row]);
      }
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (r) => {
    setForm({
      name: r.name,
      description: r.description || "",
      is_active: r.is_active,
    });
    setEditingId(r.id);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (r) => {
    const ok = await confirm(`¿Eliminar el rol "${r.name}"?`, {
      title: "Eliminar rol",
    });
    if (!ok) return;
    try {
      try {
        await profileService.delete(r.id);
      } catch (err) {
        if (!isPendingTransaction(err)) throw err;
      }
      saveRoles(roles.filter((x) => x.id !== r.id));
    } catch (err) {
      console.error("Error eliminando rol:", err);
    }
  };

  // ---------- Asignación de roles a usuarios ----------
  const pickUser = (userId) => {
    setAssigningId(String(userId));
    const current = assignment[userId] || [];
    const sel = {};
    roles.forEach((r) => {
      sel[r.id] = current.includes(r.id);
    });
    setAssigningSel(sel);
    setNotice(null);
  };

  const saveAssignment = async () => {
    if (!assigningId) return;
    setSavingAssignment(true);
    setNotice(null);
    const userId = Number(assigningId);
    const previous = assignment[userId] || [];
    const current = roles.filter((r) => assigningSel[r.id]).map((r) => r.id);
    const added = current.filter((id) => !previous.includes(id));
    const removed = previous.filter((id) => !current.includes(id));

    for (const pid of added) {
      try {
        await profileService.assignToUser(userId, pid);
      } catch (err) {
        if (!isPendingTransaction(err)) console.error(err);
      }
    }
    for (const pid of removed) {
      try {
        await profileService.removeFromUser(userId, pid);
      } catch (err) {
        if (!isPendingTransaction(err)) console.error(err);
      }
    }

    const next = { ...assignment, [userId]: current };
    writeJSON(ASSIGN_STORAGE_KEY, next);
    setAssignment(next);
    setNotice(
      added.length || removed.length
        ? `Roles actualizados para el usuario (backend pendiente: se guardó en modo local si aplica).`
        : "Sin cambios.",
    );
    setSavingAssignment(false);
  };

  const selectedUser = users.find((u) => String(u.id) === assigningId);

  return (
    <PageLayout
      icon={ShieldCheck}
      title="Perfiles"
      subtitle={`ROLES Y ACCESOS • ${new Date().toLocaleDateString()}`}
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ---------- Roles ---------- */}
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
                Roles
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setShowForm(!showForm);
                }}
                className="rounded-xl"
              >
                {showForm ? <X size={14} /> : <Plus size={14} />}
                {showForm ? "Cancelar" : "Nuevo Rol"}
              </Button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <form
                    onSubmit={handleSubmit}
                    className="rounded-xl border border-orange-200 dark:border-orange-500/20 p-4 space-y-3"
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-sm font-bold">Nombre del rol *</Label>
                      <Input
                        required
                        placeholder="Ej: supervisor"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-sm font-bold">Descripción</Label>
                      <Input
                        placeholder="Qué puede hacer este rol"
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={form.is_active}
                        onCheckedChange={(checked) =>
                          setForm({ ...form, is_active: checked })
                        }
                      />
                      <span className="text-sm text-slate-500">
                        {form.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <div className="flex justify-end gap-3 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetForm}
                        className="rounded-xl"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={submitting}
                        size="sm"
                        className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {submitting
                          ? "Guardando..."
                          : editingId
                            ? "Actualizar"
                            : "Crear Rol"}
                      </Button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-slate-400 text-sm">
                      Sin roles
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((r, i) => (
                    <TableRow
                      key={r.id}
                      className={
                        i % 2 === 0
                          ? "bg-transparent"
                          : "bg-slate-50/60 dark:bg-white/[0.02]"
                      }
                    >
                      <TableCell className="text-sm font-bold">{r.name}</TableCell>
                      <TableCell className="text-sm">{r.description || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                            r.is_active
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-red-500/10 text-red-600"
                          }`}
                        >
                          {r.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
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
          </CardContent>
        </Card>

        {/* ---------- Asignación de roles a usuarios ---------- */}
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <UserCog size={16} className="text-orange-500" /> Asignar roles a
              usuarios
            </h3>

            {notice && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
                {notice}
              </div>
            )}

            <div className="flex flex-col gap-1.5 mb-4">
              <Label className="text-sm font-bold">Usuario</Label>
              <select
                value={assigningId}
                onChange={(e) => pickUser(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
              >
                <option value="">Seleccionar usuario...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
              {users.length === 0 && (
                <p className="text-[11px] text-amber-500">
                  Registre usuarios en la sección Usuarios para asignarles roles.
                </p>
              )}
            </div>

            {assigningId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4"
              >
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Roles para{" "}
                  <span className="text-orange-600 dark:text-orange-400">
                    {selectedUser?.first_name} {selectedUser?.last_name}
                  </span>
                </p>
                <div className="space-y-2">
                  {roles.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-500/40 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={!!assigningSel[r.id]}
                        onChange={(e) =>
                          setAssigningSel({ ...assigningSel, [r.id]: e.target.checked })
                        }
                        className="accent-orange-500 h-4 w-4"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {r.name}
                        </span>
                        {r.description && (
                          <span className="text-xs text-slate-400">
                            {r.description}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                <Button
                  onClick={saveAssignment}
                  disabled={savingAssignment}
                  className="mt-4 w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-2"
                >
                  <Save size={16} />
                  {savingAssignment ? "Guardando..." : "Guardar asignación"}
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default Profiles;