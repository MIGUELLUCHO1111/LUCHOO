import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Plus, X, IdCard, Pencil, Camera, AlertTriangle, FileText, HeartPulse, Upload, ExternalLink, Truck, Car, ScrollText, BadgeCheck, Stamp } from "lucide-react";
import { fleetService, resolveFleetFileUrl } from "@/services";
import { Button } from "@/components/ui/button";
import { inputCls, initials, fmtDate } from "./fleetParts";

// Piezas compartidas de Conductores (lista y ficha del conductor).

export const licencia = (d) => {
  if (!d.license_expires_at) return { key: "sin", label: "Sin vencimiento registrado", cls: "bg-slate-100 text-slate-500 dark:bg-white/5" };
  const n = Number(d.license_days_left);
  if (n < 0) return { key: "vencida", label: `Licencia vencida hace ${Math.abs(n)} d`, cls: "bg-red-600 text-white" };
  if (n <= 30) return { key: "por_vencer", label: n === 0 ? "Licencia vence hoy" : `Licencia vence en ${n} d`, cls: "bg-[#FFCD11] text-slate-900" };
  return { key: "vigente", label: `Licencia vigente · ${fmtDate(d.license_expires_at)}`, cls: "bg-emerald-600 text-white" };
};

export const cartaMedica = (d) => {
  if (!d.medical_expires_at) return { key: "sin", label: d.medical_file_url ? "Cargada (sin vencimiento)" : "Sin cargar", cls: "text-slate-500" };
  const n = Number(d.medical_days_left);
  if (n < 0) return { key: "vencida", label: `Vencida hace ${Math.abs(n)} d`, cls: "text-red-600" };
  if (n <= 30) return { key: "por_vencer", label: n === 0 ? "Vence hoy" : `Vence en ${n} d`, cls: "text-amber-600" };
  return { key: "vigente", label: `Vigente · ${fmtDate(d.medical_expires_at)}`, cls: "text-emerald-600" };
};
// Certificado de conduccion de flota pesada: se exige a los de Flota Pesada.
export const pideCertPesada = (d) => d.fleet_type === "PESADA" || d.fleet_type === "AMBAS";
export const certPesada = (d) => {
  const exige = pideCertPesada(d);
  if (!d.heavy_cert_file_url && !d.heavy_cert_expires_at) return exige ? { key: "falta", label: "Falta cargar (Flota Pesada)", cls: "text-red-600" } : { key: "no_aplica", label: "No requerido (no maneja pesada)", cls: "text-slate-400" };
  if (!d.heavy_cert_expires_at) return { key: "sin", label: "Cargado (sin vencimiento)", cls: "text-slate-500" };
  const n = Number(d.heavy_cert_days_left);
  if (n < 0) return { key: "vencida", label: `Vencido hace ${Math.abs(n)} d`, cls: "text-red-600" };
  if (n <= 30) return { key: "por_vencer", label: n === 0 ? "Vence hoy" : `Vence en ${n} d`, cls: "text-amber-600" };
  return { key: "vigente", label: `Vigente · ${fmtDate(d.heavy_cert_expires_at)}`, cls: "text-emerald-600" };
};
export const politica = (d) => (d.policy_file_url
  ? { key: "firmada", label: d.policy_signed_at ? `Firmada el ${fmtDate(d.policy_signed_at)}` : "Firmada", cls: "text-emerald-600" }
  : { key: "falta", label: "Falta la firma", cls: "text-amber-600" });
// Autorizacion de manejo por la empresa (068): la firma el Presidente; se
// exige a todos. Puede tener vencimiento o no.
export const autorizacion = (d) => {
  if (!d.auth_file_url) return { key: "falta", label: "Falta la autorización", cls: "text-red-600" };
  if (!d.auth_expires_at) return { key: "firmada", label: d.auth_signed_at ? `Firmada el ${fmtDate(d.auth_signed_at)}` : "Firmada", cls: "text-emerald-600" };
  const n = Number(d.auth_days_left);
  if (n < 0) return { key: "vencida", label: `Vencida hace ${Math.abs(n)} d`, cls: "text-red-600" };
  if (n <= 30) return { key: "por_vencer", label: n === 0 ? "Vence hoy" : `Vence en ${n} d`, cls: "text-amber-600" };
  return { key: "vigente", label: `Vigente · ${fmtDate(d.auth_expires_at)}`, cls: "text-emerald-600" };
};
// Los documentos del conductor (kind = el de POST /fleet/drivers/document).
export const DRIVER_DOCS = [
  { kind: "licencia", title: "Licencia de conducir", short: "Licencia", icon: IdCard, url: "license_file_url", mime: "license_file_mime", estado: (d) => licDocEstado(d) },
  { kind: "medico", title: "Carta médica", short: "Carta médica", icon: HeartPulse, url: "medical_file_url", mime: "medical_file_mime", estado: (d) => medDocEstado(d) },
  { kind: "autorizacion", title: "Autorización de manejo por la empresa", short: "Autorización de manejo", icon: Stamp, url: "auth_file_url", mime: "auth_file_mime", estado: (d) => autorizacion(d) },
  { kind: "politica", title: "Política de conducción de vehículo corporativo", short: "Política de conducción", icon: ScrollText, url: "policy_file_url", mime: "policy_file_mime", estado: (d) => politica(d) },
  { kind: "pesada", title: "Certificado de conducción de flota pesada", short: "Certificado flota pesada", icon: BadgeCheck, url: "heavy_cert_file_url", mime: "heavy_cert_file_mime", estado: (d) => certPesada(d) },
];
export const DOC_SAVED = { licencia: "Licencia guardada", medico: "Carta médica guardada", politica: "Política de conducción guardada", pesada: "Certificado de flota pesada guardado", autorizacion: "Autorización de manejo guardada" };
export const DOC_TYPES = "image/jpeg,image/png,image/webp,application/pdf";
export const docOk = (file) => file && ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type) && file.size <= 10 * 1024 * 1024;
export const photoOk = (file) => file && ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 8 * 1024 * 1024;

// Flota del conductor (060): sale de las unidades que maneja; si no tiene, la
// que se le puso a mano. Mismos colores que las tarjetas de Flota.
export const DRIVER_FLEET = {
  LIVIANA: { label: "Flota Liviana", short: "Liviana", cls: "bg-brand-navy text-white", icon: Car },
  PESADA: { label: "Flota Pesada", short: "Pesada", cls: "bg-[#FFCD11] text-slate-900", icon: Truck },
  AMBAS: { label: "Liviana y Pesada", short: "Ambas", cls: "bg-gradient-to-r from-brand-navy from-50% to-[#FFCD11] to-50% text-white", icon: Truck },
};
export const driverInFleet = (d, flota) => (flota === "todas" ? true : flota === "sin" ? !d.fleet_type : d.fleet_type === flota || d.fleet_type === "AMBAS");

export const DriverFleetBadge = ({ type, size = "sm" }) => {
  const f = DRIVER_FLEET[type];
  const big = size === "lg";
  if (!f) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 dark:border-white/20 text-slate-500 font-extrabold ${big ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-0.5 text-[10px]"}`}>
        Flota sin definir
      </span>
    );
  }
  const Icon = f.icon;
  if (type === "AMBAS") {
    return (
      <span className={`inline-flex items-center overflow-hidden rounded-full font-black shadow-sm ${big ? "text-sm" : "text-[10px]"}`}>
        <span className={`inline-flex items-center gap-1 bg-brand-navy text-white ${big ? "px-3 py-1.5" : "px-2 py-0.5"}`}><Car size={big ? 15 : 11} /> Liviana</span>
        <span className={`inline-flex items-center gap-1 bg-[#FFCD11] text-slate-900 ${big ? "px-3 py-1.5" : "px-2 py-0.5"}`}><Truck size={big ? 15 : 11} /> Pesada</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-black shadow-sm ${f.cls} ${big ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-0.5 text-[10px]"}`}>
      <Icon size={big ? 15 : 11} /> {f.label}
    </span>
  );
};

// Foto del conductor (clic o arrastrar). Sin foto: sus iniciales.
export const DriverPhoto = ({ d, editable, onPhoto, className = "h-16 w-16 rounded-2xl text-xl", hint = false }) => {
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  const drop = (e) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && editable) onPhoto(file);
  };
  return (
    <>
      <button type="button" disabled={!editable} onClick={(e) => { e.stopPropagation(); ref.current?.click(); }} title={editable ? (d.photo_url ? "Cambiar la foto" : "Cargar la foto") : ""}
        onDragOver={(e) => { if (editable) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)} onDrop={drop}
        className={`group relative overflow-hidden shrink-0 bg-brand-navy text-white flex items-center justify-center font-display shadow-md ${over ? "ring-4 ring-brand-gold" : ""} ${className}`}>
        {d.photo_url ? <img src={resolveFleetFileUrl(d.photo_url)} alt={d.full_name} className="h-full w-full object-cover" /> : <span>{initials(d.full_name)}</span>}
        {editable && (
          <span className={`absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1 transition-opacity ${hint && !d.photo_url ? "opacity-100 !bg-brand-navy" : "opacity-0 group-hover:opacity-100"}`}>
            <Camera size={hint ? 26 : 18} />
            {hint && <span className="text-xs font-bold font-sans">{d.photo_url ? "Cambiar foto" : "Cargar foto"}</span>}
          </span>
        )}
      </button>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onPhoto(file); e.target.value = ""; }} />
    </>
  );
};

// Selector de archivo del formulario (licencia o carta medica).
const FilePick = ({ label, icon: Icon, file, hasCurrent, onPick }) => {
  const ref = useRef(null);
  return (
    <button type="button" onClick={() => ref.current?.click()}
      className={`flex items-center gap-3 rounded-2xl border-2 border-dashed px-3 py-2.5 text-left transition-colors ${file ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-200 dark:border-white/10 hover:border-brand-navy/40"}`}>
      <span className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${file ? "bg-emerald-600 text-white" : "bg-brand-navy text-white"}`}><Icon size={16} /></span>
      <span className="min-w-0">
        <span className="block text-xs font-extrabold text-brand-navy dark:text-white">{label}</span>
        <span className="block text-[10px] text-slate-500 truncate">{file ? file.name : hasCurrent ? "Ya cargada · clic para cambiarla" : "Foto o PDF, hasta 10 MB"}</span>
      </span>
      <input ref={ref} type="file" accept={DOC_TYPES} className="hidden" onChange={(e) => { onPick(e.target.files?.[0] || null); e.target.value = ""; }} />
    </button>
  );
};

export const DriverForm = ({ driver, onClose, onSaved }) => {
  const [f, setF] = useState({
    full_name: driver?.full_name || "", cedula: driver?.cedula || "", phone: driver?.phone || "",
    license_number: driver?.license_number || "", license_category: driver?.license_category || "",
    license_expires_at: driver?.license_expires_at || "", medical_expires_at: driver?.medical_expires_at || "",
    fleet_type: driver?.fleet_type || "", notes: driver?.notes || "", is_active: driver ? driver.is_active : true,
    policy_signed_at: driver?.policy_signed_at || "", heavy_cert_expires_at: driver?.heavy_cert_expires_at || "",
    auth_signed_at: driver?.auth_signed_at || "", auth_expires_at: driver?.auth_expires_at || "",
  });
  const [files, setFiles] = useState({ licencia: null, medico: null, autorizacion: null, politica: null, pesada: null, foto: null });
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const tieneUnidades = (driver?.unidades || []).length > 0;
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const pickFile = (kind, file) => {
    if (file && kind === "foto" && !photoOk(file)) return setError("La foto debe ser JPG, PNG o WEBP de hasta 8 MB.");
    if (file && kind !== "foto" && !docOk(file)) return setError("El archivo debe ser una foto (JPG, PNG, WEBP) o un PDF de hasta 10 MB.");
    setError(null);
    setFiles((x) => ({ ...x, [kind]: file }));
    if (kind === "foto") setPreview(file ? URL.createObjectURL(file) : null);
  };
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e) => {
    e.preventDefault();
    if (!f.full_name.trim()) return setError("Indica el nombre del conductor.");
    setSaving(true);
    setError(null);
    try {
      const res = await fleetService.guardarConductor({ ...(driver ? { id: driver.id } : {}), ...f, fleet_type: f.fleet_type || null });
      const id = driver?.id || res?.id;
      if (files.foto && id) await fleetService.subirFotoConductor(id, files.foto);
      for (const kind of ["licencia", "medico", "autorizacion", "politica", "pesada"]) {
        if (files[kind] && id) await fleetService.subirDocumentoConductor(id, kind, files[kind]);
      }
      onSaved(id);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };
  const fotoRef = useRef(null);
  const fotoUrl = preview || (driver?.photo_url ? resolveFleetFileUrl(driver.photo_url) : null);
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.form onSubmit={save} initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#111216] border border-slate-100 dark:border-white/10 shadow-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="flex items-center gap-2.5 font-display text-xl text-brand-navy dark:text-white">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy text-white">{driver ? <Pencil size={15} /> : <Plus size={16} />}</span>
            {driver ? "Editar conductor" : "Nuevo conductor"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="flex items-center gap-4 mb-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-3">
          <button type="button" onClick={() => fotoRef.current?.click()}
            className="group relative h-24 w-20 rounded-2xl overflow-hidden shrink-0 bg-brand-navy text-white flex items-center justify-center font-display text-2xl shadow-md">
            {fotoUrl ? <img src={fotoUrl} alt="Foto" className="h-full w-full object-cover" /> : <span>{f.full_name ? initials(f.full_name) : <Camera size={24} />}</span>}
            <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera size={20} /></span>
          </button>
          <input ref={fotoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pickFile("foto", e.target.files?.[0] || null); e.target.value = ""; }} />
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-brand-navy dark:text-white">Foto del conductor</p>
            <p className="text-xs text-slate-500">{files.foto ? files.foto.name : "Para identificarlo: una foto de frente, tipo carnet (JPG, PNG o WEBP)."}</p>
            <button type="button" onClick={() => fotoRef.current?.click()} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand-navy dark:text-sky-300 hover:underline"><Upload size={12} /> {fotoUrl ? "Cambiar foto" : "Cargar foto"}</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-300">Nombre y apellido *
            <input autoFocus value={f.full_name} onChange={(e) => set("full_name", e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <div className="sm:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-300">Flota a la que pertenece
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {[["", "Sin definir"], ["LIVIANA", "Liviana"], ["PESADA", "Pesada"], ["AMBAS", "Ambas"]].map(([k, l]) => (
                <button key={k || "sin"} type="button" disabled={tieneUnidades} onClick={() => set("fleet_type", k)}
                  className={`h-10 rounded-xl text-xs font-black transition-colors disabled:cursor-not-allowed ${f.fleet_type === k
                    ? (k === "PESADA" ? "bg-[#FFCD11] text-slate-900" : k === "" ? "bg-slate-500 text-white" : "bg-brand-navy text-white")
                    : "border border-slate-200 dark:border-white/10 text-slate-500 hover:border-brand-navy/40"} ${tieneUnidades && f.fleet_type !== k ? "opacity-40" : ""}`}>
                  {l}
                </button>
              ))}
            </div>
            <span className="block mt-1 text-[10px] font-normal text-slate-500">
              {tieneUnidades ? "Se toma sola de las unidades que maneja (se actualiza al asignarle o quitarle unidades)." : "Al asignarle una unidad se ajusta sola según el tipo de esa unidad."}
            </span>
          </div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Cédula
            <input value={f.cedula} onChange={(e) => set("cedula", e.target.value.toUpperCase())} placeholder="V-12345678" className={`${inputCls} mt-1 font-mono`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Teléfono
            <input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0414-1234567" className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">N° de licencia
            <input value={f.license_number} onChange={(e) => set("license_number", e.target.value.toUpperCase())} className={`${inputCls} mt-1 font-mono`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Grado de licencia
            <input list="grados-licencia" value={f.license_category} onChange={(e) => set("license_category", e.target.value.toUpperCase())} placeholder="Ej. 5TA" className={`${inputCls} mt-1`} />
            <datalist id="grados-licencia">{["2DA", "3RA", "4TA", "5TA"].map((g) => <option key={g} value={g} />)}</datalist>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Vencimiento de la licencia
            <input type="date" value={f.license_expires_at} onChange={(e) => set("license_expires_at", e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Vencimiento de la carta médica
            <input type="date" value={f.medical_expires_at} onChange={(e) => set("medical_expires_at", e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Firma de la autorización de manejo
            <input type="date" value={f.auth_signed_at} onChange={(e) => set("auth_signed_at", e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Vencimiento de la autorización <span className="font-normal text-slate-400">(si tiene)</span>
            <input type="date" value={f.auth_expires_at} onChange={(e) => set("auth_expires_at", e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Firma de la política de conducción
            <input type="date" value={f.policy_signed_at} onChange={(e) => set("policy_signed_at", e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Vencimiento del certificado de flota pesada
            <input type="date" value={f.heavy_cert_expires_at} onChange={(e) => set("heavy_cert_expires_at", e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <div className="sm:col-span-2">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Documentos (foto o PDF, hasta 10 MB)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DRIVER_DOCS.map((x) => (
                <FilePick key={x.kind} label={x.short} icon={x.icon} file={files[x.kind]} hasCurrent={!!driver?.[x.url]} onPick={(file) => pickFile(x.kind, file)} />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 pb-2">
            <input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} className="h-4 w-4" /> Activo
          </label>
          <label className="sm:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-300">Notas
            <textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputCls} mt-1 resize-none`} />
          </label>
        </div>
        {error && <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-red-600"><AlertTriangle size={14} /> {error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">{saving ? "Guardando…" : driver ? "Guardar cambios" : "Registrar conductor"}</Button>
        </div>
      </motion.form>
    </motion.div>,
    document.body,
  );
};

// Casilla de un documento del conductor: ver / cargar / cambiar.
// big = version grande de la ficha (vista previa amplia).
export const DocBox = ({ title, icon: Icon, url, mime, estado, isAdmin, onUpload, big = false }) => {
  const ref = useRef(null);
  const isImg = url && mime && mime.startsWith("image/");
  const abrir = (e) => { e.stopPropagation(); window.open(resolveFleetFileUrl(url), "_blank"); };
  const cargar = (e) => { e.stopPropagation(); ref.current?.click(); };
  const input = <input ref={ref} type="file" accept={DOC_TYPES} className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.target.value = ""; }} />;
  if (big) {
    return (
      <div className={`rounded-2xl border overflow-hidden ${url ? "border-slate-100 dark:border-white/5" : "border-dashed border-slate-300 dark:border-white/15"}`}>
        <button type="button" disabled={!url && !isAdmin} onClick={url ? abrir : cargar}
          className={`w-full h-40 flex flex-col items-center justify-center gap-2 overflow-hidden ${url ? "bg-brand-navy/5 hover:bg-brand-navy/10" : "bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100"} transition-colors`}>
          {isImg ? <img src={resolveFleetFileUrl(url)} alt={title} className="h-full w-full object-cover" />
            : url ? <><span className="h-14 w-14 rounded-2xl bg-brand-navy text-white flex items-center justify-center"><FileText size={26} /></span><span className="text-xs font-bold text-brand-navy dark:text-sky-300">PDF · clic para abrir</span></>
            : <><span className="h-14 w-14 rounded-2xl bg-slate-200 dark:bg-white/10 text-slate-400 flex items-center justify-center"><Icon size={26} /></span><span className="text-xs font-bold text-slate-400">{isAdmin ? "Clic para cargar" : "Sin cargar"}</span></>}
        </button>
        <div className="flex items-center gap-2 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-brand-navy dark:text-white">{title}</p>
            <p className={`text-xs font-bold truncate ${estado.cls}`}>{estado.label}</p>
          </div>
          {url && <button type="button" onClick={abrir} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-navy dark:text-sky-300 hover:bg-brand-navy/5"><ExternalLink size={13} /> Ver</button>}
          {isAdmin && <button type="button" onClick={cargar} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-brand-navy text-white hover:bg-brand-navy-light"><Upload size={13} /> {url ? "Cambiar" : "Cargar"}</button>}
          {input}
        </div>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border p-2.5 ${url ? "border-slate-100 dark:border-white/5" : "border-dashed border-slate-300 dark:border-white/15"}`}>
      <button type="button" disabled={!url} onClick={abrir} title={url ? "Abrir" : ""}
        className={`h-11 w-11 rounded-xl overflow-hidden shrink-0 flex items-center justify-center ${url ? "bg-brand-navy text-white hover:ring-2 hover:ring-brand-gold" : "bg-slate-100 dark:bg-white/5 text-slate-400"}`}>
        {isImg ? <img src={resolveFleetFileUrl(url)} alt={title} className="h-full w-full object-cover" /> : url ? <FileText size={18} /> : <Icon size={18} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold text-brand-navy dark:text-white leading-tight">{title}</p>
        <p className={`text-[10px] font-bold truncate ${estado.cls}`}>{estado.label}</p>
        {url && <button type="button" onClick={abrir} className="inline-flex items-center gap-0.5 text-[10px] font-bold text-brand-navy dark:text-sky-300 hover:underline"><ExternalLink size={10} /> Ver</button>}
      </div>
      {isAdmin && (
        <button type="button" onClick={cargar} title={url ? "Cambiar" : "Cargar"}
          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-brand-navy/10 text-brand-navy dark:bg-white/10 dark:text-sky-300 hover:bg-brand-navy hover:text-white transition-colors"><Upload size={14} /></button>
      )}
      {input}
    </div>
  );
};

export const licDocEstado = (d) => (d.license_file_url ? { label: "Imagen cargada", cls: "text-emerald-600" } : { label: "Falta la imagen", cls: "text-amber-600" });
export const medDocEstado = (d) => (!d.medical_file_url && !d.medical_expires_at ? { label: "Falta cargar", cls: "text-amber-600" } : cartaMedica(d));
