import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderKanban, Plus, X, Pencil, Trash2, Users, Wrench } from "lucide-react";
import { hoursService, profileService, personService } from "@/services";
import { veTodayISO } from "@/lib/trackerFormat";
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
import { useAuth, useConfirm } from "@/context";

// Único tipo de proyecto con variables confirmadas por ahora (ver
// ROADMAP_HORAS_RENTABILIDAD.md) -- se agregan más opciones cuando llegue
// el documento de variables de "Estaciones de Flujo".
const TIPOS_PROYECTO = [{ value: "izamiento", label: "Izamiento" }];

const Projects = () => {
  const { user } = useAuth();
  const confirm = useConfirm();
  // Solo admin crea/edita/elimina proyectos o gestiona su acceso -- un
  // perfil restringido con esta sección concedida solo puede ver sus
  // proyectos (el backend ya lo hace cumplir en paralelo: ver
  // SECTION_PERMISSIONS['/hours/projects'] en option.js, que a partir de
  // ahora no le da esos métodos a ningún perfil que no sea admin).
  const isAdmin = user?.profiles?.some((p) => p.name === "admin");

  const [projects, setProjects] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    company_id: "",
    name: "",
    tipo: TIPOS_PROYECTO[0].value,
    is_active: true,
    responsible_person_id: "",
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [projectsRes, companiesRes] = await Promise.all([
        hoursService.getAllProyectos(),
        hoursService.getAllEmpresas(),
      ]);
      setProjects(Array.isArray(projectsRes) ? projectsRes : []);
      setCompanies(Array.isArray(companiesRes) ? companiesRes : []);
    } catch (err) {
      console.error("Error cargando proyectos:", err);
    } finally {
      setLoading(false);
    }

    // Personas solo hace falta para el <select> de Responsable, que es
    // admin-only -- un perfil restringido no tiene permiso sobre
    // Security.Person.getAllPersons (no está en ninguna sección que se le
    // pueda otorgar hoy), así que ni se pide para no romper el resto de
    // la carga de la página con un 403.
    if (isAdmin) {
      try {
        const personsRes = await personService.getAll();
        setPersons(Array.isArray(personsRes) ? personsRes : []);
      } catch (err) {
        console.error("Error cargando personas:", err);
      }
    }
  };

  const resetForm = () => {
    setForm({ company_id: "", name: "", tipo: TIPOS_PROYECTO[0].value, is_active: true, responsible_person_id: "" });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (project) => {
    setForm({
      company_id: String(project.company_id),
      name: project.name,
      tipo: project.tipo,
      is_active: project.is_active,
      responsible_person_id: project.responsible_person_id ? String(project.responsible_person_id) : "",
    });
    setEditingId(project.id);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const responsible_person_id = form.responsible_person_id ? Number(form.responsible_person_id) : null;

    try {
      if (editingId) {
        await hoursService.updateProyecto(editingId, {
          name: form.name,
          tipo: form.tipo,
          is_active: form.is_active,
          responsible_person_id,
        });
      } else {
        await hoursService.createProyecto({
          company_id: Number(form.company_id),
          name: form.name,
          tipo: form.tipo,
          responsible_person_id,
        });
      }
      resetForm();
      loadAll();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Error al guardar";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm(`¿Eliminar proyecto ${name}?`, { title: "Eliminar proyecto" });
    if (!ok) return;

    try {
      await hoursService.deleteProyecto(id);
      loadAll();
    } catch (err) {
      console.error("Error eliminando:", err);
    }
  };

  // ---------- Acceso: qué perfiles pueden rellenar este proyecto ----------

  const [managingAccess, setManagingAccess] = useState(null); // proyecto en el que se abrió "Acceso"
  const [allProfiles, setAllProfiles] = useState([]);
  const [assignedProfiles, setAssignedProfiles] = useState([]);
  const [accessError, setAccessError] = useState(null);

  const openAccess = async (project) => {
    setManagingAccess(project);
    setAccessError(null);
    try {
      const [profiles, assigned] = await Promise.all([
        profileService.getAll(),
        hoursService.getPerfilesAsignados(project.id),
      ]);
      setAllProfiles(Array.isArray(profiles) ? profiles : []);
      setAssignedProfiles(Array.isArray(assigned) ? assigned.map((p) => p.name) : []);
    } catch (err) {
      console.error("Error cargando acceso:", err);
      setAccessError(err.response?.data?.message || err.message || "Error al cargar los perfiles");
    }
  };

  const toggleProfileAccess = async (profileName) => {
    setAccessError(null);
    const isAssigned = assignedProfiles.includes(profileName);
    try {
      if (isAssigned) {
        await hoursService.quitarPerfilProyecto({ project_id: managingAccess.id, profile_name: profileName });
        setAssignedProfiles((prev) => prev.filter((n) => n !== profileName));
      } else {
        await hoursService.asignarPerfilProyecto({ project_id: managingAccess.id, profile_name: profileName });
        setAssignedProfiles((prev) => [...prev, profileName]);
      }
    } catch (err) {
      console.error("Error actualizando acceso:", err);
      setAccessError(err.response?.data?.message || err.message || "Error al actualizar el acceso");
    }
  };

  // ---------- Equipos: cuáles equipos están asignados a este proyecto ----------

  const [managingEquipos, setManagingEquipos] = useState(null); // proyecto en el que se abrió "Equipos"
  const [allEquipos, setAllEquipos] = useState([]);
  const [equiposError, setEquiposError] = useState(null);
  // Equipos con una petición de asignación en curso -- deshabilita su
  // checkbox mientras tanto, para que un clic repetido por lag no dispare
  // varias llamadas seguidas antes de que la lista se refresque.
  const [togglingIds, setTogglingIds] = useState(new Set());

  const loadEquiposModal = async (project) => {
    setEquiposError(null);
    try {
      const equipos = await hoursService.getAllEquipos();
      setAllEquipos(Array.isArray(equipos) ? equipos : []);
    } catch (err) {
      console.error("Error cargando equipos:", err);
      setEquiposError(err.response?.data?.message || err.message || "Error al cargar los equipos");
    }
  };

  const openEquipos = async (project) => {
    setManagingEquipos(project);
    await loadEquiposModal(project);
  };

  const toggleEquipoAssignment = async (equipo) => {
    if (togglingIds.has(equipo.id)) return; // ya hay una petición en curso para este equipo
    setEquiposError(null);
    const assignedHere = equipo.current_assignment?.project_id === managingEquipos.id;

    if (!assignedHere && equipo.current_assignment) {
      const ok = await confirm(
        `${equipo.code} está asignado a "${equipo.current_assignment.project_name}" -- asignarlo aquí cierra esa asignación. ¿Continuar?`,
        { title: "Reasignar equipo" },
      );
      if (!ok) return;
    }

    setTogglingIds((prev) => new Set(prev).add(equipo.id));
    try {
      if (assignedHere) {
        await hoursService.quitarAsignacionEquipo({ equipo_id: equipo.id, effective_from: veTodayISO() });
      } else {
        await hoursService.asignarEquipo({ equipo_id: equipo.id, project_id: managingEquipos.id, assigned_from: veTodayISO() });
      }
      await loadEquiposModal(managingEquipos);
    } catch (err) {
      console.error("Error actualizando asignación:", err);
      setEquiposError(err.response?.data?.message || err.message || "Error al actualizar la asignación");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(equipo.id);
        return next;
      });
    }
  };

  return (
    <PageLayout
      icon={FolderKanban}
      title="Proyectos"
      subtitle={`CONTROL DE HORAS • ${new Date().toLocaleDateString()}`}
      accentColor="navy"
    >
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <Button
            onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-brand-navy hover:bg-brand-navy-light text-white transition-transform hover:scale-105 text-sm"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Cancelar" : "Nuevo Proyecto"}
          </Button>
        </div>
      )}

      <AnimatePresence>
        {isAdmin && showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <Card className="border-brand-navy/20 dark:border-brand-navy-light/20">
              <CardContent className="p-6">
                <h3 className="font-display text-lg text-slate-900 dark:text-white mb-4">
                  {editingId ? "Editar Proyecto" : "Nuevo Proyecto"}
                </h3>

                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Empresa *</Label>
                    <select
                      required
                      value={form.company_id}
                      onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                      disabled={!!editingId}
                      className={`px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm ${editingId ? "opacity-50" : ""}`}
                    >
                      <option value="">Seleccionar...</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Nombre *</Label>
                    <Input
                      required
                      placeholder="Ej: Izamiento Septiembre"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Tipo *</Label>
                    <select
                      required
                      value={form.tipo}
                      onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                    >
                      {TIPOS_PROYECTO.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-bold">Responsable</Label>
                    <select
                      value={form.responsible_person_id}
                      onChange={(e) => setForm({ ...form, responsible_person_id: e.target.value })}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm"
                    >
                      <option value="">Sin responsable</option>
                      {persons.map((p) => (
                        <option key={p.person_id} value={p.person_id}>
                          {p.first_name} {p.last_name}{p.degree ? ` — ${p.degree}` : ""}
                        </option>
                      ))}
                    </select>
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
              <TableHead>Empresa</TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Responsable</TableHead>
              {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-slate-400">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-slate-400">
                  No hay proyectos registrados
                </TableCell>
              </TableRow>
            ) : (
              projects.map((p, i) => (
                <TableRow key={p.id} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                  <TableCell className="text-sm">{p.company_name}</TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-brand-navy/10 text-brand-navy dark:text-brand-navy-light capitalize">
                      {p.tipo}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${p.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                      {p.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.responsible_name ? (
                      <span>
                        {p.responsible_name}
                        {p.responsible_degree && (
                          <span className="text-slate-400"> — {p.responsible_degree}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEquipos(p)}
                        className="h-8 w-8 rounded-lg text-brand-navy hover:text-brand-navy-light hover:bg-brand-navy/10 dark:hover:bg-brand-navy-light/10"
                        title="Equipos asignados a este proyecto"
                      >
                        <Wrench size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openAccess(p)}
                        className="h-8 w-8 rounded-lg text-brand-navy hover:text-brand-navy-light hover:bg-brand-navy/10 dark:hover:bg-brand-navy-light/10"
                        title="Quién puede rellenar este proyecto"
                      >
                        <Users size={14} />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleEdit(p)} className="h-8 w-8 rounded-lg">
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(p.id, p.name)}
                        className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ---------- Modal: qué perfiles pueden rellenar este proyecto ---------- */}
      <AnimatePresence>
        {managingAccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setManagingAccess(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/5 shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-lg text-slate-900 dark:text-white">
                  Acceso a {managingAccess.name}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setManagingAccess(null)} className="h-8 w-8">
                  <X size={16} />
                </Button>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Solo los perfiles marcados aquí pueden ver y rellenar este proyecto en Registro Diario -- el perfil <span className="font-bold">admin</span> siempre tiene acceso a todos, no hace falta marcarlo.
              </p>

              {accessError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                  {accessError}
                </div>
              )}

              <div className="max-h-72 overflow-auto flex flex-col gap-1">
                {allProfiles.filter((pr) => pr.name !== "admin").map((pr) => (
                  <label
                    key={pr.name}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={assignedProfiles.includes(pr.name)}
                      onChange={() => toggleProfileAccess(pr.name)}
                      className="accent-brand-navy"
                    />
                    {pr.name}
                  </label>
                ))}
                {allProfiles.filter((pr) => pr.name !== "admin").length === 0 && (
                  <p className="px-2 py-1 text-xs text-slate-400">
                    No hay otros perfiles creados todavía -- crea uno en Seguridad {'>'} Perfiles.
                  </p>
                )}
              </div>

              <div className="flex justify-end mt-4">
                <Button type="button" onClick={() => setManagingAccess(null)} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">
                  Cerrar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Modal: equipos asignados a este proyecto ---------- */}
      <AnimatePresence>
        {managingEquipos && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setManagingEquipos(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-white/5 shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-lg text-slate-900 dark:text-white">
                  Equipos de {managingEquipos.name}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setManagingEquipos(null)} className="h-8 w-8">
                  <X size={16} />
                </Button>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Marca los equipos que trabajan en este proyecto desde hoy. Un equipo marcado en otro proyecto se
                reasigna aquí (se te pedirá confirmar).
              </p>

              {equiposError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                  {equiposError}
                </div>
              )}

              <div className="max-h-72 overflow-auto flex flex-col gap-1">
                {allEquipos.map((eq) => {
                  const assignedHere = eq.current_assignment?.project_id === managingEquipos.id;
                  const assignedElsewhere = eq.current_assignment && !assignedHere;
                  const isToggling = togglingIds.has(eq.id);
                  return (
                    <label
                      key={eq.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-sm ${isToggling ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        checked={assignedHere}
                        disabled={isToggling}
                        onChange={() => toggleEquipoAssignment(eq)}
                        className="accent-brand-navy"
                      />
                      <span>
                        {eq.code} {eq.name ? `- ${eq.name}` : ""}
                        {assignedElsewhere && (
                          <span className="text-slate-400"> (actualmente en {eq.current_assignment.project_name})</span>
                        )}
                      </span>
                    </label>
                  );
                })}
                {allEquipos.length === 0 && (
                  <p className="px-2 py-1 text-xs text-slate-400">
                    No hay equipos creados todavía -- crea uno en Control de Horas {'>'} Equipos.
                  </p>
                )}
              </div>

              <div className="flex justify-end mt-4">
                <Button type="button" onClick={() => setManagingEquipos(null)} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">
                  Cerrar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
};

export default Projects;
