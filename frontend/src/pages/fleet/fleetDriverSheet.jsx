import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { UserRound, IdCard, Phone, Pencil, UserX, HeartPulse, Truck, Car, Plus, X, Search, History, AlertTriangle, CalendarClock, StickyNote, ChevronRight, Unlink } from "lucide-react";
import { fleetService } from "@/services";
import { getCurrentProfile } from "@/services/api";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { useConfirm } from "@/context";
import { inputCls, fmtDate, fmtDateTime } from "./fleetParts";
import { licencia, cartaMedica, docOk, photoOk, DriverForm, DocBox, DriverFleetBadge, DriverPhoto, DRIVER_FLEET, licDocEstado, medDocEstado } from "./fleetDriverParts";

// Ficha del conductor (/fleet/drivers/:id, pedido de Lguerra 07/10/2026):
// foto para identificarlo, a que flota pertenece, documentos y las unidades
// que maneja. Asignar o quitar una unidad aqui es lo mismo que hacerlo desde
// la ficha de la unidad (misma funcion asignarConductor): las dos quedan
// sincronizadas y la flota del conductor se ajusta sola.

const Card = ({ icon: Icon, title, action, children, className = "" }) => (
  <section className={`rounded-3xl border border-slate-100 dark:border-white/5 bg-white/90 dark:bg-[#0f1115]/80 p-5 ${className}`}>
    <div className="flex items-center justify-between gap-2 mb-4">
      <h2 className="flex items-center gap-2.5 font-display text-lg text-brand-navy dark:text-white">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-navy text-white shadow-md"><Icon size={16} /></span> {title}
      </h2>
      {action}
    </div>
    {children}
  </section>
);

const Dato = ({ label, value, mono, cls = "" }) => (
  <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] px-3.5 py-2.5 min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
    <p className={`text-sm font-extrabold truncate ${value ? `text-brand-navy dark:text-white ${cls}` : "text-slate-400"} ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
  </div>
);

const vence = (fecha, dias) => {
  if (!fecha) return { txt: null };
  const n = Number(dias);
  return { txt: `${fmtDate(fecha)}${n < 0 ? ` · vencida hace ${Math.abs(n)} d` : n <= 30 ? ` · vence en ${n} d` : ""}`, cls: n < 0 ? "!text-red-600" : n <= 30 ? "!text-amber-600" : "" };
};

// Elegir unidades para el conductor (solo las que el usuario puede editar).
const AssignUnits = ({ driver, onClose, onDone }) => {
  const [units, setUnits] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [flota, setFlota] = useState(driver.fleet_type === "PESADA" || driver.fleet_type === "LIVIANA" ? driver.fleet_type : "todas");
  useEffect(() => { fleetService.listar().then((d) => setUnits(Array.isArray(d) ? d : [])).catch((e) => setError(e.message)); }, []);
  const mias = new Set(driver.unidades.map((u) => Number(u.unit_id)));
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (units || [])
      .filter((u) => u.puede_editar && !mias.has(Number(u.id)))
      .filter((u) => flota === "todas" || u.fleet_type === flota)
      .filter((u) => !t || [u.code, u.plate, u.name, u.driver_name, u.conductor?.full_name].some((v) => String(v || "").toLowerCase().includes(t)))
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [units, q, flota, driver]); // eslint-disable-line react-hooks/exhaustive-deps
  const asignar = async (u) => {
    setBusy(u.id);
    setError(null);
    try { await fleetService.asignarConductor(u.id, driver.id); await onDone(); }
    catch (e) { setError(e.response?.data?.message || e.message); }
    finally { setBusy(null); }
  };
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-[#111216] border border-slate-100 dark:border-white/10 shadow-2xl p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="flex items-center gap-2.5 font-display text-xl text-brand-navy dark:text-white">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy text-white"><Plus size={16} /></span> Asignar unidad
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-500 mb-3">La unidad elegida queda con <b>{driver.full_name}</b> también en su ficha de Flota. Si hoy la maneja otro conductor, pasa al historial.</p>
        <div className="flex gap-1.5 mb-2">
          {[["todas", "Todas"], ["LIVIANA", "Liviana"], ["PESADA", "Pesada"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFlota(k)}
              className={`flex-1 h-9 rounded-xl text-xs font-black transition-colors ${flota === k ? (k === "PESADA" ? "bg-[#FFCD11] text-slate-900" : "bg-brand-navy text-white") : "border border-slate-200 dark:border-white/10 text-slate-500"}`}>{l}</button>
          ))}
        </div>
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={16} /></span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código, placa o conductor actual…" className={`${inputCls} pl-9`} />
        </div>
        {error && <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-red-600"><AlertTriangle size={14} /> {error}</p>}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5 min-h-[8rem]">
          {!units ? <p className="text-center text-slate-400 py-8 text-sm">Cargando unidades…</p>
            : !lista.length ? <p className="text-center text-slate-400 py-8 text-sm">No hay unidades con ese filtro.</p>
            : lista.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-white/5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                <span className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${u.fleet_type === "PESADA" ? "bg-[#FFCD11] text-slate-900" : "bg-brand-navy text-white"}`}>{u.fleet_type === "PESADA" ? <Truck size={16} /> : <Car size={16} />}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-brand-navy dark:text-white">{u.code} {u.plate && <span className="font-mono text-xs font-bold text-slate-500">· {u.plate}</span>}</p>
                  <p className="text-[11px] text-slate-500 truncate">Hoy: {u.conductor?.full_name || u.driver_name || "sin conductor"}</p>
                </div>
                <Button size="sm" disabled={busy != null} onClick={() => asignar(u)} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">{busy === u.id ? "Asignando…" : "Asignar"}</Button>
              </div>
            ))}
        </div>
        <div className="flex justify-end mt-4"><Button variant="outline" className="rounded-xl" onClick={onClose}>Listo</Button></div>
      </motion.div>
    </motion.div>,
    document.body,
  );
};

const FleetDriverSheet = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const profile = getCurrentProfile();
  const isAdmin = profile === "admin";
  const puedeAsignar = isAdmin || profile === "encargado_flota";
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [editar, setEditar] = useState(false);
  const [asignar, setAsignar] = useState(false);

  const load = () => fleetService.obtenerConductor(Number(id)).then((x) => { setD(x); setError(null); }).catch((e) => setError(e.response?.data?.message || e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, ok) => {
    try { await fn(); setAviso(ok); await load(); } catch (e) { setError(e.response?.data?.message || e.message); }
  };
  const photo = (file) => (photoOk(file) ? run(() => fleetService.subirFotoConductor(d.id, file), "Foto guardada") : setError("La foto debe ser JPG, PNG o WEBP de hasta 8 MB."));
  const doc = (kind, file) => (docOk(file) ? run(() => fleetService.subirDocumentoConductor(d.id, kind, file), kind === "licencia" ? "Licencia guardada" : "Carta médica guardada") : setError("El archivo debe ser una foto (JPG, PNG, WEBP) o un PDF de hasta 10 MB."));
  const quitar = async (u) => {
    if (!(await confirm(`¿Quitar a ${d.full_name} de ${u.code}? La unidad queda como ROTATIVO.`, { title: "Quitar unidad", confirmText: "Quitar" }))) return;
    run(() => fleetService.asignarConductor(u.unit_id, null), `${u.code} quedó como ROTATIVO`);
  };
  const baja = async () => {
    if (!(await confirm(`¿Dar de baja a ${d.full_name}?${d.unidades.length ? ` Sus unidades (${d.unidades.map((u) => u.code).join(", ")}) quedarán como ROTATIVO.` : ""}`, { title: "Dar de baja", confirmText: "Dar de baja" }))) return;
    try { await fleetService.eliminarConductor(d.id); navigate("/fleet/drivers"); } catch (e) { setError(e.message); }
  };
  useEffect(() => { if (!aviso) return undefined; const t = setTimeout(() => setAviso(null), 3500); return () => clearTimeout(t); }, [aviso]);

  const back = { to: "/fleet/drivers", label: "Conductores" };
  if (!d) {
    return (
      <PageLayout back={back} icon={UserRound} title="Ficha del conductor" subtitle="FLOTA • CONDUCTORES" maxWidth="max-w-[1400px]">
        <p className={`text-center py-16 ${error ? "text-red-600 font-bold" : "text-slate-400"}`}>{error || "Cargando ficha…"}</p>
      </PageLayout>
    );
  }
  const lic = licencia(d);
  const med = cartaMedica(d);
  const lv = vence(d.license_expires_at, d.license_days_left);
  const mv = vence(d.medical_expires_at, d.medical_days_left);
  const fleet = DRIVER_FLEET[d.fleet_type];
  const pesada = d.fleet_type === "PESADA";
  const heroBg = d.fleet_type === "AMBAS" ? "bg-gradient-to-br from-brand-navy via-brand-navy to-[#8a6d00]" : pesada ? "bg-gradient-to-br from-[#FFD84D] via-[#FFCD11] to-[#E6B400]" : "bg-gradient-to-br from-brand-navy to-[#1d4466]";
  const heroTxt = pesada ? "text-slate-900" : "text-white";
  const anteriores = (d.historial || []).filter((h) => h.ended_at);

  return (
    <PageLayout back={back} icon={UserRound} title={d.full_name} subtitle={`FICHA DEL CONDUCTOR • ${fleet ? fleet.label.toUpperCase() : "FLOTA SIN DEFINIR"}`} maxWidth="max-w-[1400px]">
      {/* Encabezado tipo ficha: foto grande + identificacion */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`relative overflow-hidden rounded-3xl ${heroBg} ${heroTxt} p-6 md:p-8 shadow-xl mb-6`}>
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute right-24 -bottom-24 h-56 w-56 rounded-full bg-white/5" />
        <div className="relative flex flex-col md:flex-row gap-6 md:items-center">
          <DriverPhoto d={d} editable={isAdmin} onPhoto={photo} hint className="h-56 w-44 rounded-3xl text-5xl ring-4 ring-white/30 shadow-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-full bg-white px-1 py-1 shadow"><DriverFleetBadge type={d.fleet_type} size="lg" /></span>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${d.is_active ? "bg-emerald-500 text-white" : "bg-slate-300 text-slate-700"}`}>{d.is_active ? "ACTIVO" : "INACTIVO"}</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl leading-tight">{d.full_name}</h1>
            <div className={`mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm font-bold ${pesada ? "text-slate-800" : "text-white/85"}`}>
              {d.cedula && <span className="inline-flex items-center gap-1.5"><IdCard size={15} /> C.I. <span className="font-mono">{d.cedula}</span></span>}
              {d.phone && <a href={`tel:${d.phone}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone size={15} /> {d.phone}</a>}
              {d.license_category && <span className="inline-flex items-center gap-1.5">Licencia de {d.license_category}</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-xl px-3 py-1.5 text-xs font-extrabold shadow ${lic.cls}`}>{lic.label}</span>
              <span className="rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold shadow"><span className="text-slate-500">Carta médica: </span><span className={med.cls}>{med.label}</span></span>
              <span className="rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold text-brand-navy shadow">{d.unidades.length ? `Maneja ${d.unidades.length} unidad(es)` : "Sin unidad asignada"}</span>
            </div>
            {!d.photo_url && isAdmin && <p className={`mt-3 text-xs font-bold ${pesada ? "text-slate-800" : "text-white/80"}`}>Toca el recuadro de la foto (o arrastra una imagen) para identificar al conductor.</p>}
          </div>
          {isAdmin && (
            <div className="flex md:flex-col gap-2 shrink-0">
              <Button onClick={() => setEditar(true)} className="rounded-xl bg-white text-brand-navy hover:bg-slate-100 font-bold gap-1.5 shadow"><Pencil size={15} /> Editar ficha</Button>
              <Button onClick={baja} variant="outline" className={`rounded-xl font-bold gap-1.5 bg-transparent ${pesada ? "border-slate-900/30 text-slate-900 hover:bg-slate-900/10" : "border-white/40 text-white hover:bg-white/10"}`}><UserX size={15} /> Dar de baja</Button>
            </div>
          )}
        </div>
      </motion.section>

      <AnimatePresence>
        {(aviso || error) && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`mb-4 rounded-2xl px-4 py-2.5 text-sm font-bold ${error ? "bg-red-50 text-red-700 dark:bg-red-500/10" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10"}`}>
            {error || aviso}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-10">
        <div className="xl:col-span-2 space-y-6">
          <Card icon={Truck} title="Unidades que maneja"
            action={puedeAsignar && d.is_active && <Button onClick={() => setAsignar(true)} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white gap-1.5"><Plus size={15} /> Asignar unidad</Button>}>
            {d.unidades.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {d.unidades.map((u) => {
                  const p = u.fleet_type === "PESADA";
                  return (
                    <motion.div key={u.unit_id} whileHover={{ y: -2 }} className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-white/5 p-3 hover:shadow-md transition-shadow">
                      <span className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${p ? "bg-[#FFCD11] text-slate-900" : "bg-brand-navy text-white"}`}>{p ? <Truck size={20} /> : <Car size={20} />}</span>
                      <button type="button" onClick={() => navigate(`/fleet/${u.unit_id}`)} className="min-w-0 flex-1 text-left group">
                        <p className="font-black text-brand-navy dark:text-white group-hover:underline">{u.code}</p>
                        <p className="text-[11px] text-slate-500 truncate">{u.plate ? <span className="font-mono">{u.plate} · </span> : null}{p ? "Flota Pesada" : u.fleet_type === "LIVIANA" ? "Flota Liviana" : "Sin tipo"} · desde {fmtDate(String(u.desde).slice(0, 10))}</p>
                      </button>
                      <button type="button" onClick={() => navigate(`/fleet/${u.unit_id}`)} title="Abrir la ficha de la unidad" className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-brand-navy hover:text-white transition-colors"><ChevronRight size={16} /></button>
                      {puedeAsignar && <button type="button" onClick={() => quitar(u)} title="Quitar (la unidad queda ROTATIVO)" className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 transition-colors"><Unlink size={15} /></button>}
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 py-8">
                <span className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mb-2"><Truck size={22} /></span>
                <p className="font-bold text-slate-500">Todavía no maneja ninguna unidad.</p>
                {puedeAsignar && d.is_active && <p className="text-xs text-slate-400 mt-1">Usa "Asignar unidad": quedará igual en la ficha de la unidad.</p>}
              </div>
            )}
            <p className="mt-3 text-[11px] text-slate-500">Sincronizado con Flota: lo que se asigna aquí aparece en la ficha de la unidad (y al revés), y la flota del conductor se ajusta sola según sus unidades.</p>
          </Card>

          <Card icon={HeartPulse} title="Documentos del conductor">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DocBox big title="Licencia de conducir" icon={IdCard} url={d.license_file_url} mime={d.license_file_mime} isAdmin={isAdmin} onUpload={(file) => doc("licencia", file)} estado={licDocEstado(d)} />
              <DocBox big title="Carta médica" icon={HeartPulse} url={d.medical_file_url} mime={d.medical_file_mime} isAdmin={isAdmin} onUpload={(file) => doc("medico", file)} estado={medDocEstado(d)} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card icon={IdCard} title="Datos del conductor">
            <div className="grid grid-cols-2 gap-2">
              <Dato label="Cédula" value={d.cedula} mono />
              <Dato label="Teléfono" value={d.phone} />
              <Dato label="N° de licencia" value={d.license_number} mono />
              <Dato label="Grado" value={d.license_category} />
              <div className="col-span-2"><Dato label="Vence la licencia" value={lv.txt} cls={lv.cls} /></div>
              <div className="col-span-2"><Dato label="Vence la carta médica" value={mv.txt} cls={mv.cls} /></div>
              <div className="col-span-2"><Dato label="Flota" value={fleet ? fleet.label : null} /></div>
            </div>
            {d.notes && (
              <div className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700"><StickyNote size={12} /> Notas</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{d.notes}</p>
              </div>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500"><CalendarClock size={12} /> Registrado el {fmtDateTime(d.created_at)}</p>
          </Card>

          <Card icon={History} title="Historial de unidades">
            {d.historial?.length ? (
              <ol className="relative border-l-2 border-slate-100 dark:border-white/10 ml-2 space-y-3">
                {d.historial.map((h) => (
                  <li key={h.id} className="ml-4">
                    <span className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ring-4 ring-white dark:ring-[#0f1115] ${h.ended_at ? "bg-slate-300" : "bg-emerald-500"}`} />
                    <button type="button" onClick={() => navigate(`/fleet/${h.unit_id}`)} className="text-sm font-black text-brand-navy dark:text-white hover:underline">{h.code}</button>
                    <span className="ml-1.5 text-[10px] font-bold text-slate-500">{h.fleet_type === "PESADA" ? "Pesada" : h.fleet_type === "LIVIANA" ? "Liviana" : ""}</span>
                    <p className="text-[11px] text-slate-500">{fmtDate(String(h.started_at).slice(0, 10))} → {h.ended_at ? fmtDate(String(h.ended_at).slice(0, 10)) : <b className="text-emerald-600">hoy</b>}{h.created_by ? ` · por ${h.created_by}` : ""}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-slate-400">Sin movimientos todavía.</p>}
            {anteriores.length > 0 && <p className="mt-3 text-[11px] text-slate-500">{anteriores.length} asignación(es) anterior(es).</p>}
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {editar && <DriverForm driver={d} onClose={() => setEditar(false)} onSaved={() => { setEditar(false); setAviso("Ficha actualizada"); load(); }} />}
        {asignar && <AssignUnits driver={d} onClose={() => setAsignar(false)} onDone={async () => { setAviso("Unidad asignada"); await load(); }} />}
      </AnimatePresence>
    </PageLayout>
  );
};

export default FleetDriverSheet;
