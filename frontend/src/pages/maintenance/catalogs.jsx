import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { BookOpen, Plus, Pencil, Archive, RotateCcw, Wrench, Building2 } from "lucide-react";
import { maintenanceService } from "@/services";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { Modal, ErrorBox, FAILURE, useMntRole, inputCls, labelCls } from "./mntShared";

// Mantenimiento > Servicios y proveedores (063). Los servicios se agregan a
// una OT con un clic (como tareas); los proveedores se eligen en la OT.

const SERVICE_KIND = { PREVENTIVO: "Preventivo", CORRECTIVO: "Correctivo", INSPECCION: "Inspección" };
const PROVIDER_TYPES = ["Taller externo", "Hidráulica", "Certificación de izamiento", "Repuestos", "Cauchera", "Electricidad", "Latonería y pintura", "Grúa / remolque", "Otro"];

const ServiceModal = ({ item, onClose, onSaved }) => {
  const [f, setF] = useState({ id: item?.id, name: item?.name || "", system: item?.system || "", kind: item?.kind || "PREVENTIVO", est_minutes: item?.est_minutes ?? "", description: item?.description || "" });
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try { await maintenanceService.guardarServicio({ ...f, id: f.id ? Number(f.id) : undefined, system: f.system || null, est_minutes: f.est_minutes === "" ? null : f.est_minutes }); onSaved(); }
    catch (err) { setError(err.message); }
  };
  return (
    <Modal title={f.id ? "Editar servicio" : "Nuevo servicio"} icon={Wrench} onClose={onClose}>
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label className="col-span-2 flex flex-col gap-1.5"><span className={labelCls}>Servicio *</span><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej. Servicio de frenos" /></label>
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Tipo</span><select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(SERVICE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Sistema</span><select className={inputCls} value={f.system} onChange={(e) => setF({ ...f, system: e.target.value })}><option value="">—</option>{Object.entries(FAILURE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Duración estimada (min)</span><input type="number" min="1" className={inputCls} value={f.est_minutes} onChange={(e) => setF({ ...f, est_minutes: e.target.value })} /></label>
        <label className="col-span-2 flex flex-col gap-1.5"><span className={labelCls}>Descripción</span><textarea className={`${inputCls} min-h-[60px]`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="rounded-xl bg-brand-navy text-white">Guardar</Button>
        </div>
      </form>
    </Modal>
  );
};

const ProviderModal = ({ item, onClose, onSaved }) => {
  const [f, setF] = useState({ id: item?.id, name: item?.name || "", type: item?.type || "", rif: item?.rif || "", contact: item?.contact || "", phone: item?.phone || "", email: item?.email || "", notes: item?.notes || "" });
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try { await maintenanceService.guardarProveedor({ ...f, id: f.id ? Number(f.id) : undefined }); onSaved(); }
    catch (err) { setError(err.message); }
  };
  const field = (k, l, ph) => <label className="flex flex-col gap-1.5"><span className={labelCls}>{l}</span><input className={inputCls} value={f[k]} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  return (
    <Modal title={f.id ? "Editar proveedor" : "Nuevo proveedor"} icon={Building2} onClose={onClose}>
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">{field("name", "Nombre *", "Ej. Hidráulica del Lago C.A.")}</div>
        <label className="flex flex-col gap-1.5"><span className={labelCls}>Tipo</span>
          <input list="mnt-provider-types" className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} />
          <datalist id="mnt-provider-types">{PROVIDER_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        {field("rif", "RIF", "J-00000000-0")}
        {field("contact", "Contacto")}
        {field("phone", "Teléfono")}
        <div className="col-span-2">{field("email", "Correo")}</div>
        <label className="col-span-2 flex flex-col gap-1.5"><span className={labelCls}>Notas</span><textarea className={`${inputCls} min-h-[60px]`} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="rounded-xl bg-brand-navy text-white">Guardar</Button>
        </div>
      </form>
    </Modal>
  );
};

export default function Catalogs() {
  const role = useMntRole();
  const [tab, setTab] = useState("servicios");
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState(null);
  const [edit, setEdit] = useState(null);

  const load = useCallback(() => Promise.all([
    maintenanceService.listarServicios().then((d) => setServices(Array.isArray(d) ? d : [])),
    maintenanceService.listarProveedores().then((d) => setProviders(Array.isArray(d) ? d : [])),
  ]).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const toggle = (kind, item) => (kind === "servicios" ? maintenanceService.archivarServicio(Number(item.id), !item.active) : maintenanceService.archivarProveedor(Number(item.id), !item.active)).then(load).catch((e) => setError(e.message));
  const rows = tab === "servicios" ? services : providers;

  return (
    <PageLayout icon={BookOpen} title="Servicios y proveedores" subtitle={`MANTENIMIENTO • ${new Date().toLocaleDateString()}`} accentColor="navy">
      <div className="w-full flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5">
            {[["servicios", `Servicios (${services.filter((s) => s.active).length})`], ["proveedores", `Proveedores (${providers.filter((p) => p.active).length})`]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`h-9 px-4 rounded-lg text-sm font-bold ${tab === k ? "bg-white dark:bg-[#0f1115] text-brand-navy dark:text-white shadow-sm" : "text-slate-500"}`}>{l}</button>
            ))}
          </div>
          {role.isSupervisor && <Button onClick={() => setEdit({ kind: tab, item: null })} className="h-11 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-slate-900 font-extrabold gap-2"><Plus size={17} /> {tab === "servicios" ? "Nuevo servicio" : "Nuevo proveedor"}</Button>}
        </div>
        <ErrorBox>{error}</ErrorBox>
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0f1115]/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-white/10">
                  {tab === "servicios"
                    ? <><th className="px-4 py-3">Servicio</th><th className="px-2">Tipo</th><th className="px-2">Sistema</th><th className="px-2">Duración</th></>
                    : <><th className="px-4 py-3">Proveedor</th><th className="px-2">Tipo</th><th className="px-2">RIF</th><th className="px-2">Contacto</th><th className="px-2">OT</th></>}
                  <th className="px-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400">{tab === "servicios" ? "Sin servicios." : "Todavía no hay proveedores. Agrega los talleres externos con los que trabajan."}</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} className={`border-b border-slate-100 dark:border-white/5 ${r.active ? "" : "opacity-50"}`}>
                    {tab === "servicios" ? (
                      <>
                        <td className="px-4 py-2.5 font-bold">{r.name}{r.description && <span className="block text-xs font-normal text-slate-400">{r.description}</span>}</td>
                        <td className="px-2">{SERVICE_KIND[r.kind]}</td>
                        <td className="px-2">{FAILURE[r.system] || "—"}</td>
                        <td className="px-2 tabular-nums">{r.est_minutes ? `${r.est_minutes} min` : "—"}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 font-bold">{r.name}{r.notes && <span className="block text-xs font-normal text-slate-400">{r.notes}</span>}</td>
                        <td className="px-2">{r.type || "—"}</td>
                        <td className="px-2">{r.rif || "—"}</td>
                        <td className="px-2">{[r.contact, r.phone, r.email].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="px-2 tabular-nums">{r.orders}</td>
                      </>
                    )}
                    <td className="px-2 pr-4 text-right whitespace-nowrap">
                      {role.isSupervisor && (
                        <span className="inline-flex gap-1">
                          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setEdit({ kind: tab, item: r })} aria-label="Editar"><Pencil size={13} /></Button>
                          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => toggle(tab, r)} aria-label={r.active ? "Archivar" : "Reactivar"}>{r.active ? <Archive size={13} /> : <RotateCcw size={13} />}</Button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {edit && edit.kind === "servicios" && <ServiceModal item={edit.item} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
        {edit && edit.kind === "proveedores" && <ProviderModal item={edit.item} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      </AnimatePresence>
    </PageLayout>
  );
}
