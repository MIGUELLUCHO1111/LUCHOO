import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserCog, Plus, X, Pencil, Trash2, KeyRound } from "lucide-react";
import { userService, profileService, generateUsername } from "@/services";
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

const USERS_STORAGE_KEY = "fullpetro_users_local";
const PROFILES_STORAGE_KEY = "fullpetro_profiles_local";

const emptyForm = {
  first_name: "",
  last_name: "",
  name: "",
  email: "",
  profile_id: "",
  password: "",
  confirm_password: "",
  is_active: true,
};

const normalize = (u) => ({
  id: u.id ?? u.user_id,
  first_name: u.first_name || (u.name ? u.name.split(" ")[0] : ""),
  last_name: u.last_name || (u.name ? u.name.split(" ").slice(1).join(" ") : ""),
  name: u.name || u.username || "",
  email: u.email || "",
  profile_id: u.profile_id || u.rol_id || "",
  profile_name: u.profile_name || u.rol_name || "",
  is_active: u.is_active !== false,
});

const Users = () => {
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Mientras no se toque a mano, el usuario de acceso se sugiere solo a
  // partir de nombre+apellido (solo al crear; al editar uno existente no se
  // le cambia el username por retocar el nombre).
  const [usernameTouched, setUsernameTouched] = useState(false);

  useEffect(() => {
    if (editingId || usernameTouched) return;
    setForm((f) => ({ ...f, name: generateUsername(f.first_name, f.last_name) }));
  }, [form.first_name, form.last_name, editingId, usernameTouched]);

  const loadProfiles = async () => {
    try {
      const res = await profileService.getAll();
      const list = (Array.isArray(res) ? res : res?.rows || []).map((p) => ({
        ...p,
        id: p.id ?? p.profile_id,
      }));
      if (list.length) {
        writeJSON(PROFILES_STORAGE_KEY, list);
        setProfiles(list);
        return;
      }
    } catch (_) {
      /* backend pendiente */
    }
    setProfiles(readJSON(PROFILES_STORAGE_KEY));
  };

  const loadUsers = async () => {
    try {
      const res = await userService.getAll();
      const list = (Array.isArray(res) ? res : res?.rows || []).map(normalize);
      if (list.length) {
        writeJSON(USERS_STORAGE_KEY, list);
        setUsers(list);
        setBanner(null);
        return;
      }
    } catch (_) {
      /* backend pendiente */
    } finally {
      setLoading(false);
    }
    setUsers(readJSON(USERS_STORAGE_KEY).map(normalize));
    setBanner(
      "Modo local: el CRUD de usuarios (tx 31-36) aún no existe en el backend; los datos se guardan temporalmente en el navegador.",
    );
  };

  useEffect(() => {
    loadUsers();
    loadProfiles();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError(null);
    setUsernameTouched(false);
  };

  const roleName = (id) =>
    profiles.find((p) => String(p.id) === String(id))?.name ||
    profiles.find((p) => String(p.profile_id) === String(id))?.name ||
    "-";

  const saveLocal = (list) => {
    writeJSON(USERS_STORAGE_KEY, list);
    setUsers(list.map(normalize));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const isNew = !editingId;
    if (isNew && form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      setSubmitting(false);
      return;
    }
    if (form.password !== form.confirm_password) {
      setError("Las contraseñas no coinciden.");
      setSubmitting(false);
      return;
    }
    if (!form.email) {
      setError("El correo empresarial es obligatorio.");
      setSubmitting(false);
      return;
    }
    if (!form.name.trim()) {
      setError("El usuario de acceso es obligatorio.");
      setSubmitting(false);
      return;
    }

    const row = {
      id: editingId || Date.now(),
      name: form.name.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      profile_id: form.profile_id ? Number(form.profile_id) : null,
      profile_name: roleName(form.profile_id),
      is_active: form.is_active,
    };

    try {
      if (editingId) {
        try {
          await userService.update(editingId, {
            ...row,
            password: form.password || undefined,
          });
        } catch (err) {
          if (!isPendingTransaction(err)) throw err;
        }
        saveLocal(users.map((u) => (u.id === editingId ? row : u)));
      } else {
        try {
          const res = await userService.create({ ...row, password: form.password });
          if (res?.id) row.id = res.id;
          else if (res?.user_id) row.id = res.user_id;
        } catch (err) {
          if (!isPendingTransaction(err)) throw err;
        }
        saveLocal([...users, row]);
      }
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (u) => {
    setForm({
      first_name: u.first_name,
      last_name: u.last_name,
      name: u.name,
      email: u.email || "",
      profile_id: String(u.profile_id || ""),
      password: "",
      confirm_password: "",
      is_active: u.is_active,
    });
    setEditingId(u.id);
    setShowForm(true);
    setError(null);
    setUsernameTouched(true);
  };

  const handleDelete = async (u) => {
    const ok = await confirm(`¿Eliminar al usuario ${u.first_name} ${u.last_name}?`, {
      title: "Eliminar usuario",
    });
    if (!ok) return;
    try {
      try {
        await userService.delete(u.id);
      } catch (err) {
        if (!isPendingTransaction(err)) throw err;
      }
      saveLocal(users.filter((x) => x.id !== u.id));
    } catch (err) {
      console.error("Error eliminando:", err);
    }
  };

  return (
    <PageLayout
      icon={UserCog}
      title="Usuarios"
      subtitle={`USUARIOS DEL SISTEMA • ${new Date().toLocaleDateString()}`}
      accentColor="navy"
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
          Cada usuario accede con su <b>usuario</b> (se genera solo, columna
          "Usuario") y contraseña — el correo es solo de referencia.
        </p>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-brand-navy hover:bg-brand-navy-light text-white transition-transform hover:scale-105 text-sm"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancelar" : "Nuevo Usuario"}
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
                <h3 className="font-display text-lg text-slate-900 dark:text-white mb-1">
                  {editingId ? "Editar Usuario" : "Registrar Usuario"}
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  El acceso del usuario queda limitado a las secciones que su rol
                  permite (matriz de permisos del backend).
                </p>

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
                      placeholder="Ej: María"
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
                      placeholder="Ej: Gómez"
                      value={form.last_name}
                      onChange={(e) =>
                        setForm({ ...form, last_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Usuario de acceso *</Label>
                    <Input
                      required
                      className="font-mono"
                      placeholder="Se sugiere a partir del nombre y apellido"
                      value={form.name}
                      onChange={(e) => {
                        setUsernameTouched(true);
                        setForm({
                          ...form,
                          name: e.target.value.toLowerCase().replace(/\s+/g, ""),
                        });
                      }}
                    />
                    <p className="text-[11px] text-slate-400">
                      Con esto (y la contraseña) entra a Fullpetro — comunícaselo a la persona.
                      {!editingId && " Se sugiere solo; puedes cambiarlo."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Correo empresarial *</Label>
                    <Input
                      required
                      type="email"
                      placeholder="maria.gomez@fullpetro.com"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Rol *</Label>
                    <select
                      required
                      value={form.profile_id}
                      onChange={(e) =>
                        setForm({ ...form, profile_id: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                    >
                      <option value="">Seleccionar rol...</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {profiles.length === 0 && (
                      <p className="text-[11px] text-amber-500">
                        Sin roles disponibles: créelos en la sección Perfiles.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">
                      Contraseña {editingId ? "(dejar en blanco para no cambiar)" : "*"}
                    </Label>
                    <div className="relative">
                      <KeyRound
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <Input
                        required={!editingId}
                        type="password"
                        minLength={6}
                        placeholder="••••••"
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Confirmar contraseña *</Label>
                    <Input
                      required={!editingId}
                      type="password"
                      placeholder="••••••"
                      value={form.confirm_password}
                      onChange={(e) =>
                        setForm({ ...form, confirm_password: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Activo</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={form.is_active}
                        onCheckedChange={(checked) =>
                          setForm({ ...form, is_active: checked })
                        }
                      />
                      <span className="text-sm text-slate-500">
                        {form.is_active ? "Sí" : "No"}
                      </span>
                    </div>
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
              <TableHead>Usuario</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
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
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  No hay usuarios registrados
                </TableCell>
              </TableRow>
            ) : (
              users.map((u, i) => (
                <TableRow
                  key={u.id}
                  className={
                    i % 2 === 0
                      ? "bg-transparent"
                      : "bg-slate-50/60 dark:bg-white/[0.02]"
                  }
                >
                  <TableCell className="text-sm">{u.first_name}</TableCell>
                  <TableCell className="text-sm">{u.last_name}</TableCell>
                  <TableCell className="text-sm font-mono text-slate-500 dark:text-slate-400">
                    {u.name || "-"}
                  </TableCell>
                  <TableCell className="text-sm">{u.email || "-"}</TableCell>
                  <TableCell className="text-sm">
                    <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold">
                      {roleName(u.profile_id) || u.profile_name || "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                        u.is_active
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-red-500/10 text-red-600"
                      }`}
                    >
                      {u.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(u)}
                        className="h-8 w-8 rounded-lg"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(u)}
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

export default Users;