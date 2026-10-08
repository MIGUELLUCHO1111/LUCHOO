import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList, Check, X as XIcon, Play, PauseCircle, PlayCircle, CheckCircle2, Lock, Ban, ShieldCheck,
  Plus, Trash2, Package, ListChecks, History, AlertTriangle, Siren, Pencil, Paperclip, Timer, FileText, Upload,
} from "lucide-react";
import { maintenanceService, resolveMntFileUrl } from "@/services";
import { Button } from "@/components/ui/button";
import {
  Modal, ErrorBox, Chip, STATUS, KIND, PRIORITY, CRIT, FAILURE, ROLE_LABEL, INC_STATUS, TERMINAL,
  useMntRole, requiredRoles, inputCls, labelCls, fmtDateTime, usd, daysSince,
} from "./mntShared";

const Section = ({ icon: Icon, title, right, children }) => (
  <section className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
    <div className="flex items-center justify-between gap-2 mb-3">
      <h4 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-brand-navy dark:text-white"><Icon size={15} /> {title}</h4>
      {right}
    </div>
    {children}
  </section>
);

const Field = ({ label, children }) => (
  <div className="min-w-0">
    <span className={labelCls}>{label}</span>
    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">{children || "—"}</div>
  </div>
);

// Pequeño formulario en línea para acciones que piden datos (motivo, cierre...).
const ActionForm = ({ title, fields, submitLabel, danger, onSubmit, onCancel }) => {
  const [v, setV] = useState(Object.fromEntries(fields.map((f) => [f.key, f.initial ?? ""])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try { await onSubmit(v); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={go} className={`rounded-2xl border p-4 flex flex-col gap-3 ${danger ? "border-red-200 bg-red-50/50 dark:bg-red-500/5" : "border-brand-navy/20 bg-brand-navy/[0.03] dark:bg-white/[0.03]"}`}>
      <p className="font-extrabold text-sm text-slate-900 dark:text-white">{title}</p>
      <ErrorBox>{err}</ErrorBox>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <label key={f.key} className={`flex flex-col gap-1 ${f.wide ? "sm:col-span-2" : ""}`}>
            <span className={labelCls}>{f.label}</span>
            {f.type === "textarea" ? (
              <textarea className={`${inputCls} min-h-[60px]`} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            ) : f.type === "select" ? (
              <select className={inputCls} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
                <option value="">{f.placeholder || "Seleccionar..."}</option>
                {f.options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            ) : f.type === "checkbox" ? (
              <span className="flex items-center gap-2 text-sm pt-1"><input type="checkbox" className="accent-brand-navy h-4 w-4" checked={!!v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.checked })} /> {f.checkLabel}</span>
            ) : (
              <input type={f.type || "text"} step={f.step} min={f.min} className={inputCls} value={v[f.key]} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            )}
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={busy} className={`rounded-xl text-white ${danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-navy hover:bg-brand-navy-light"}`}>{busy ? "Guardando..." : submitLabel}</Button>
      </div>
    </form>
  );
};

export default function WorkOrderDetail({ id, onClose, onChanged }) {
  const role = useMntRole();
  const [wo, setWo] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null); // acción con formulario abierta
  const [task, setTask] = useState("");
  const [part, setPart] = useState({ description: "", part_number: "", quantity: "1", unit_cost_usd: "", provider: "" });
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    maintenanceService.listarServicios().then((d) => setServices((Array.isArray(d) ? d : []).filter((x) => x.active))).catch(() => {});
    maintenanceService.listarProveedores().then((d) => setProviders((Array.isArray(d) ? d : []).filter((x) => x.active))).catch(() => {});
  }, []);
  const upload = async (files) => {
    setUploading(true);
    setError(null);
    try { for (const f of files) await maintenanceService.subirEvidencia(wo.id, f); await load(); onChanged?.(); }
    catch (e) { setError(e.message); }
    finally { setUploading(false); }
  };

  const load = useCallback(() => maintenanceService.obtenerOrden(id).then(setWo).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try { await fn(); await load(); onChanged?.(); setForm(null); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  // Para ActionForm: deja que el formulario muestre su propio error.
  const runForm = async (fn) => { await fn(); await load(); onChanged?.(); setForm(null); };

  if (!wo) {
    return (
      <Modal title="Orden de Trabajo" icon={ClipboardList} onClose={onClose} wide>
        <ErrorBox>{error}</ErrorBox>
        {!error && <p className="text-sm text-slate-400 py-10 text-center">Cargando...</p>}
      </Modal>
    );
  }

  const open = !TERMINAL.includes(wo.status);
  const req = requiredRoles(wo);
  const signed = (r) => (wo.approvals || []).find((a) => a.role === r);
  const mySignable = wo.status === "SOLICITADA" ? req.filter((r) => !signed(r) && role.roles.includes(r)) : [];
  const partsTotal = (wo.repuestos || []).reduce((s, p) => s + Number(p.quantity) * Number(p.unit_cost_usd || 0), 0);
  const emergencyPending = wo.kind === "EMERGENCIA" && !wo.regularized_at && !["RECHAZADA", "ANULADA"].includes(wo.status);
  const emergencyLate = emergencyPending && wo.regularize_due_at && new Date() > new Date(wo.regularize_due_at);
  const meterLabel = (wo.meter || (wo.unit_fleet_type === "PESADA" ? "HORAS" : "KM")) === "HORAS" ? "horómetro" : "odómetro";

  return (
    <Modal wide icon={ClipboardList} onClose={onClose} title={<span className="flex flex-wrap items-center gap-2">{wo.number} <span className="text-slate-400 font-sans text-base">· {wo.unit_code}</span></span>}>
      <ErrorBox>{error}</ErrorBox>

      {/* ---------- Encabezado ---------- */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Chip map={STATUS} value={wo.status} />
        <Chip map={KIND} value={wo.kind}>{KIND[wo.kind].label}{wo.level ? ` ${wo.level === "MAYOR" ? "mayor" : "menor"}` : ""}</Chip>
        <Chip map={CRIT} value={wo.criticality_at_open} />
        <span className={`text-xs font-bold ${PRIORITY[wo.priority]?.cls}`}>Prioridad {PRIORITY[wo.priority]?.label.toLowerCase()}</span>
        {wo.out_of_service && open && <span className="text-xs font-bold text-red-600">· Unidad fuera de servicio por esta OT</span>}
      </div>
      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{wo.title}</h2>
      {wo.description && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">{wo.description}</p>}
      <p className="text-xs text-slate-400 mt-1">Abierta por {wo.opened_by || "—"} el {fmtDateTime(wo.opened_at)} · {daysSince(wo.opened_at)} día(s)</p>

      {emergencyPending && (
        <div className={`mt-4 rounded-2xl p-3 text-sm flex flex-wrap items-center gap-3 ${emergencyLate ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300" : "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300"}`}>
          <Siren size={16} />
          <span className="flex-1 min-w-[200px]">Emergencia {emergencyLate ? <b>fuera de plazo</b> : "pendiente"}: Gerencia de Mantenimiento debe regularizarla {emergencyLate ? "(vencía" : "antes del"} {fmtDateTime(wo.regularize_due_at)}{emergencyLate ? ")" : ""}. No se puede cerrar hasta entonces.</span>
          {role.isGerencia && <Button size="sm" disabled={busy} onClick={() => run(() => maintenanceService.regularizarOrden(wo.id))} className="rounded-xl bg-brand-navy text-white">Regularizar</Button>}
        </div>
      )}

      {/* ---------- Acciones según el estado ---------- */}
      {open && !form && (
        <div className="mt-4 flex flex-wrap gap-2">
          {mySignable.map((r) => (
            <Button key={r} disabled={busy} onClick={() => run(() => maintenanceService.aprobarOrden(wo.id, r))} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <Check size={15} /> Firmar como {ROLE_LABEL[r]}
            </Button>
          ))}
          {wo.status === "SOLICITADA" && mySignable.length > 0 && (
            <Button variant="outline" disabled={busy} onClick={() => setForm("rechazar")} className="rounded-xl gap-1.5 text-red-600"><XIcon size={15} /> Rechazar</Button>
          )}
          {wo.status === "APROBADA" && <Button disabled={busy} onClick={() => setForm("iniciar")} className="rounded-xl bg-brand-navy text-white gap-1.5"><Play size={15} /> Iniciar trabajo</Button>}
          {wo.status === "EN_EJECUCION" && (
            <>
              <Button disabled={busy} onClick={() => setForm("ejecutar")} className="rounded-xl bg-brand-navy text-white gap-1.5"><CheckCircle2 size={15} /> Marcar ejecutada</Button>
              <Button variant="outline" disabled={busy} onClick={() => run(() => maintenanceService.pausarOrden(wo.id))} className="rounded-xl gap-1.5"><PauseCircle size={15} /> Espera de repuesto</Button>
            </>
          )}
          {wo.status === "ESPERA_REPUESTO" && <Button disabled={busy} onClick={() => run(() => maintenanceService.reanudarOrden(wo.id))} className="rounded-xl bg-brand-navy text-white gap-1.5"><PlayCircle size={15} /> Reanudar trabajo</Button>}
          {wo.status === "EJECUTADA" && role.isSupervisor && (
            <Button disabled={busy || emergencyPending} onClick={() => setForm("cerrar")} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"><Lock size={15} /> Validar y cerrar</Button>
          )}
          {wo.status === "EJECUTADA" && !role.isSupervisor && <span className="text-sm text-slate-500 self-center">Ejecutada: falta que el Supervisor de Mantenimiento la valide y la cierre.</span>}
          <Button variant="outline" disabled={busy} onClick={() => setForm("editar")} className="rounded-xl gap-1.5"><Pencil size={15} /> Editar datos</Button>
          {role.isGerencia && <Button variant="outline" disabled={busy} onClick={() => setForm("anular")} className="rounded-xl gap-1.5 text-red-600 ml-auto"><Ban size={15} /> Anular</Button>}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {form === "rechazar" && (
          <ActionForm title="Rechazar la OT" danger submitLabel="Rechazar" onCancel={() => setForm(null)}
            fields={[{ key: "reason", label: "Motivo del rechazo *", type: "textarea", wide: true }]}
            onSubmit={(v) => runForm(() => maintenanceService.rechazarOrden(wo.id, v.reason))} />
        )}
        {form === "iniciar" && (
          <ActionForm title="Iniciar el trabajo" submitLabel="Iniciar" onCancel={() => setForm(null)}
            fields={[{ key: "technician", label: "Técnico a cargo", initial: wo.technician || "", wide: true }]}
            onSubmit={(v) => runForm(() => maintenanceService.iniciarOrden(wo.id, v.technician || null))} />
        )}
        {form === "ejecutar" && (
          <ActionForm title="Marcar el trabajo como ejecutado" submitLabel="Marcar ejecutada" onCancel={() => setForm(null)}
            fields={[
              { key: "technician", label: "Técnico ejecutor *", initial: wo.technician || "" },
              { key: "labor_hours", label: "Horas de intervención *", type: "number", step: "0.25", min: "0", initial: wo.labor_hours ?? "" },
              { key: "failure_system", label: "Sistema de la falla", type: "select", options: Object.entries(FAILURE), initial: wo.failure_system || "" },
              { key: "functional_test", label: "Prueba", type: "checkbox", checkLabel: "Prueba funcional / de carga realizada", initial: !!wo.functional_test },
              { key: "result", label: "Trabajo realizado y resultado *", type: "textarea", wide: true, initial: wo.result || "" },
            ]}
            onSubmit={(v) => runForm(() => maintenanceService.ejecutarOrden(wo.id, { ...v, failure_system: v.failure_system || null }))} />
        )}
        {form === "cerrar" && (
          <ActionForm title="Validar y cerrar la OT" submitLabel="Cerrar OT" onCancel={() => setForm(null)}
            fields={[
              { key: "close_meter_value", label: `Lectura del ${meterLabel} al cerrar`, type: "number", step: "0.1", min: "0", placeholder: "Opcional: queda en el historial de la ficha" },
              ...(wo.kind !== "PREVENTIVA" ? [{ key: "failure_system", label: "Sistema de la falla *", type: "select", options: Object.entries(FAILURE), initial: wo.failure_system || "" }] : []),
              { key: "note", label: "Observación de cierre", type: "textarea", wide: true },
            ]}
            onSubmit={(v) => runForm(() => maintenanceService.cerrarOrden(wo.id, { close_meter_value: v.close_meter_value !== "" ? v.close_meter_value : null, failure_system: v.failure_system || null, note: v.note || null }))} />
        )}
        {form === "anular" && (
          <ActionForm title="Anular la OT" danger submitLabel="Anular" onCancel={() => setForm(null)}
            fields={[{ key: "reason", label: "Motivo de la anulación *", type: "textarea", wide: true }]}
            onSubmit={(v) => runForm(() => maintenanceService.anularOrden(wo.id, v.reason))} />
        )}
        {form === "editar" && (
          <ActionForm title="Editar datos de la OT" submitLabel="Guardar" onCancel={() => setForm(null)}
            fields={[
              { key: "title", label: "Título", initial: wo.title, wide: true },
              { key: "priority", label: "Prioridad", type: "select", options: Object.entries(PRIORITY).map(([k, v]) => [k, v.label]), initial: wo.priority },
              { key: "technician", label: "Técnico", initial: wo.technician || "" },
              ...(providers.length ? [{ key: "provider_id", label: "Proveedor del catálogo", type: "select", placeholder: "— Sin proveedor del catálogo —", options: providers.map((pr) => [String(pr.id), pr.type ? `${pr.name} · ${pr.type}` : pr.name]), initial: wo.provider_id ? String(wo.provider_id) : "" }] : []),
              { key: "provider", label: "Proveedor / taller externo (texto)", initial: wo.provider || "" },
              ...(wo.kind === "CORRECTIVA" ? [
                { key: "estimated_cost_usd", label: "Costo estimado (USD)", type: "number", step: "0.01", min: "0", initial: wo.estimated_cost_usd ?? "" },
                { key: "special_purchase", label: "Compra", type: "checkbox", checkLabel: "Requiere compra especial / repuesto importado", initial: wo.special_purchase },
              ] : []),
              { key: "out_of_service", label: "Unidad", type: "checkbox", checkLabel: "La unidad está parada por esta OT", initial: wo.out_of_service },
              { key: "description", label: "Descripción", type: "textarea", wide: true, initial: wo.description || "" },
            ]}
            onSubmit={(v) => runForm(() => maintenanceService.actualizarOrden(wo.id, {
              ...v, priority: v.priority || undefined,
              provider_id: v.provider_id === undefined ? undefined : v.provider_id ? Number(v.provider_id) : null,
              estimated_cost_usd: wo.kind === "CORRECTIVA" ? (v.estimated_cost_usd === "" ? null : v.estimated_cost_usd) : undefined,
              special_purchase: wo.kind === "CORRECTIVA" ? v.special_purchase : undefined,
            }))} />
        )}

        {/* ---------- Firmas ---------- */}
        {(req.length > 0 || wo.kind === "EMERGENCIA" || (wo.approvals || []).length > 0) && (
          <Section icon={ShieldCheck} title="Aprobación">
            {wo.kind === "CORRECTIVA" && (
              <p className="text-xs text-slate-500 mb-3">Correctiva {wo.level === "MAYOR" ? "mayor" : "menor"}: {wo.level === "MAYOR" ? "la firman Gerencia de Mantenimiento y Gerencia de Operaciones (dos personas distintas)." : "la firma el Supervisor de Mantenimiento (72 h)."}</p>
            )}
            <div className="flex flex-col gap-2">
              {[...new Set([...req, ...(wo.approvals || []).map((a) => a.role)])].map((r) => {
                const a = signed(r);
                return (
                  <div key={r} className="flex flex-wrap items-center gap-2 text-sm">
                    {a ? (a.decision === "APROBADA" ? <Check size={16} className="text-emerald-600" /> : <XIcon size={16} className="text-red-600" />) : <span className="h-4 w-4 rounded-full border-2 border-slate-300" />}
                    <b className="text-slate-800 dark:text-slate-100">{ROLE_LABEL[r]}</b>
                    {a ? <span className="text-slate-500">{a.decision === "APROBADA" ? "firmó" : "rechazó"} · {a.user_name || "—"} · {fmtDateTime(a.created_at)}{a.note ? ` · "${a.note}"` : ""}</span> : <span className="text-amber-700">pendiente</span>}
                  </div>
                );
              })}
            </div>
            {wo.reject_reason && <p className="mt-2 text-sm text-red-600">Motivo del rechazo: {wo.reject_reason}</p>}
          </Section>
        )}

        {/* ---------- Datos de ejecución ---------- */}
        <Section icon={ClipboardList} title="Datos de la OT">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Unidad">{wo.unit_code}{wo.unit_plate && wo.unit_plate !== wo.unit_code ? ` · ${wo.unit_plate}` : ""}</Field>
            <Field label="Técnico">{wo.technician}</Field>
            <Field label="Proveedor">{wo.provider}</Field>
            <Field label="Costo estimado">{wo.estimated_cost_usd != null ? usd(wo.estimated_cost_usd) : null}</Field>
            <Field label={`Lectura al abrir (${(wo.meter || "").toLowerCase() || "—"})`}>{wo.open_meter_value != null ? Number(wo.open_meter_value).toLocaleString("es-VE") : null}</Field>
            <Field label="Lectura al cerrar">{wo.close_meter_value != null ? Number(wo.close_meter_value).toLocaleString("es-VE") : null}</Field>
            <Field label="Horas de intervención">{wo.labor_hours != null ? `${Number(wo.labor_hours)} h` : null}</Field>
            <Field label="Sistema de la falla">{FAILURE[wo.failure_system]}</Field>
            <Field label="Prueba funcional">{wo.functional_test == null ? null : wo.functional_test ? "Sí" : "No"}</Field>
            <Field label="Iniciada">{wo.started_at ? fmtDateTime(wo.started_at) : null}</Field>
            <Field label="Ejecutada">{wo.executed_at ? fmtDateTime(wo.executed_at) : null}</Field>
            <Field label="Cerrada">{wo.closed_at ? `${fmtDateTime(wo.closed_at)}${wo.closed_by ? ` · ${wo.closed_by}` : ""}` : null}</Field>
          </div>
          {wo.result && <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line"><span className={labelCls}>Resultado</span><br />{wo.result}</p>}
          {wo.void_reason && <p className="mt-3 text-sm text-red-600">Motivo de la anulación: {wo.void_reason}</p>}
        </Section>

        {/* ---------- Tareas ---------- */}
        <Section icon={ListChecks} title={`Tareas ${(wo.tareas || []).length ? `(${(wo.tareas || []).filter((t) => t.done).length}/${wo.tareas.length})` : ""}`}>
          <div className="flex flex-col gap-1.5">
            {(wo.tareas || []).map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm group">
                <input type="checkbox" className="accent-brand-navy h-4 w-4" checked={t.done} disabled={!open || busy}
                  onChange={() => run(() => maintenanceService.marcarTarea(wo.id, Number(t.id), !t.done))} />
                <span className={`flex-1 ${t.done ? "line-through text-slate-400" : "text-slate-800 dark:text-slate-100"}`}>{t.description}</span>
                {t.done && <span className="text-[11px] text-slate-400">{t.done_by} · {fmtDateTime(t.done_at)}</span>}
                {open && <button type="button" aria-label="Eliminar tarea" onClick={() => run(() => maintenanceService.eliminarTarea(wo.id, Number(t.id)))} className="text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>}
              </div>
            ))}
            {!(wo.tareas || []).length && <p className="text-sm text-slate-400">Sin tareas.</p>}
          </div>
          {open && services.length > 0 && (
            <select className={`${inputCls} mt-3`} value="" disabled={busy} onChange={(e) => { const sv = services.find((x) => String(x.id) === e.target.value); if (sv) run(() => maintenanceService.agregarTarea(wo.id, sv.est_minutes ? `${sv.name} (~${sv.est_minutes} min)` : sv.name)); }}>
              <option value="">+ Agregar un servicio del catálogo como tarea...</option>
              {services.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}{sv.est_minutes ? ` · ${sv.est_minutes} min` : ""}</option>)}
            </select>
          )}
          {open && (
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (task.trim()) run(async () => { await maintenanceService.agregarTarea(wo.id, task); setTask(""); }); }}>
              <input className={inputCls} value={task} onChange={(e) => setTask(e.target.value)} placeholder="Nueva tarea (ej. Cambiar filtro hidráulico)" />
              <Button type="submit" disabled={busy || !task.trim()} className="rounded-xl bg-brand-navy text-white gap-1"><Plus size={15} /> Agregar</Button>
            </form>
          )}
        </Section>

        {/* ---------- Repuestos ---------- */}
        <Section icon={Package} title="Repuestos y materiales" right={<span className="text-sm font-extrabold text-slate-900 dark:text-white">Total {usd(partsTotal)}</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-400"><th className="py-1 pr-2">N.º de parte</th><th className="pr-2">Descripción</th><th className="pr-2 text-right">Cant.</th><th className="pr-2 text-right">USD c/u</th><th className="pr-2">Proveedor</th><th /></tr></thead>
              <tbody>
                {(wo.repuestos || []).map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-white/5">
                    <td className="py-1.5 pr-2 font-mono text-xs">{p.part_number || "—"}</td>
                    <td className="pr-2">{p.description}</td>
                    <td className="pr-2 text-right tabular-nums">{Number(p.quantity)}</td>
                    <td className="pr-2 text-right tabular-nums">{p.unit_cost_usd != null ? usd(p.unit_cost_usd) : "—"}</td>
                    <td className="pr-2">{p.provider || "—"}</td>
                    <td className="text-right">{open && <button type="button" aria-label="Eliminar repuesto" onClick={() => run(() => maintenanceService.eliminarRepuesto(wo.id, Number(p.id)))} className="text-slate-300 hover:text-red-600"><Trash2 size={14} /></button>}</td>
                  </tr>
                ))}
                {!(wo.repuestos || []).length && <tr><td colSpan={6} className="py-2 text-slate-400">Sin repuestos registrados.</td></tr>}
              </tbody>
            </table>
          </div>
          {open && (
            <form className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2" onSubmit={(e) => {
              e.preventDefault();
              if (part.description.trim()) run(async () => { await maintenanceService.agregarRepuesto(wo.id, { ...part, unit_cost_usd: part.unit_cost_usd === "" ? null : part.unit_cost_usd }); setPart({ description: "", part_number: "", quantity: "1", unit_cost_usd: "", provider: "" }); });
            }}>
              <input className={inputCls} value={part.part_number} onChange={(e) => setPart({ ...part, part_number: e.target.value })} placeholder="N.º de parte" />
              <input className={`${inputCls} col-span-2`} value={part.description} onChange={(e) => setPart({ ...part, description: e.target.value })} placeholder="Descripción *" />
              <input type="number" min="0.01" step="0.01" className={inputCls} value={part.quantity} onChange={(e) => setPart({ ...part, quantity: e.target.value })} placeholder="Cant." />
              <input type="number" min="0" step="0.01" className={inputCls} value={part.unit_cost_usd} onChange={(e) => setPart({ ...part, unit_cost_usd: e.target.value })} placeholder="USD c/u" />
              <Button type="submit" disabled={busy || !part.description.trim()} className="rounded-xl bg-brand-navy text-white gap-1"><Plus size={15} /> Agregar</Button>
            </form>
          )}
        </Section>

        {/* ---------- Tiempos de parada (§10.3) ---------- */}
        {wo.tiempos && (
          <Section icon={Timer} title="Tiempos">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Diagnóstico y aprobación">{wo.tiempos.diagnostico_h != null ? `${wo.tiempos.diagnostico_h} h` : null}</Field>
              <Field label="Espera de repuesto">{`${wo.tiempos.espera_repuesto_h ?? 0} h${wo.paused_at ? " (en curso)" : ""}`}</Field>
              <Field label="Reparación">{wo.tiempos.reparacion_h != null ? `${wo.tiempos.reparacion_h} h` : null}</Field>
              <Field label="Unidad parada (total)">{wo.tiempos.parada_total_h != null ? `${wo.tiempos.parada_total_h} h${open ? " y contando" : ""}` : "No la detuvo"}</Field>
            </div>
          </Section>
        )}

        {/* ---------- Evidencias (§10.1) ---------- */}
        <Section icon={Paperclip} title={`Evidencias ${(wo.archivos || []).length ? `(${wo.archivos.length})` : ""}`}
          right={open && (
            <label className={`inline-flex items-center gap-1.5 rounded-xl px-3 h-9 text-sm font-bold cursor-pointer ${uploading ? "bg-slate-200 text-slate-500" : "bg-brand-navy text-white hover:bg-brand-navy-light"}`}>
              <Upload size={14} /> {uploading ? "Subiendo..." : "Subir foto o PDF"}
              <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" disabled={uploading}
                onChange={(e) => { const fl = [...e.target.files]; e.target.value = ""; if (fl.length) upload(fl); }} />
            </label>
          )}>
          {(wo.archivos || []).length === 0 ? (
            <p className="text-sm text-slate-400">Sin evidencias. Sube fotos del trabajo (antes / después) o el informe del taller en PDF. Máximo 10 MB por archivo.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {wo.archivos.map((f) => (
                <div key={f.id} className="group relative rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                  <a href={resolveMntFileUrl(f.url)} target="_blank" rel="noreferrer" className="block">
                    {String(f.mime_type).startsWith("image/") ? (
                      <img src={resolveMntFileUrl(f.url)} alt={f.original_name || "Evidencia"} className="h-28 w-full object-cover" />
                    ) : (
                      <span className="h-28 flex flex-col items-center justify-center gap-1 text-slate-500"><FileText size={28} /> <span className="text-xs font-bold">PDF</span></span>
                    )}
                  </a>
                  <span className="block px-2 py-1 text-[11px] truncate text-slate-600 dark:text-slate-300">{f.original_name || "Archivo"}</span>
                  {open && (
                    <button type="button" aria-label="Eliminar evidencia" onClick={() => run(() => maintenanceService.eliminarEvidencia(Number(f.id)))}
                      className="absolute top-1 right-1 h-7 w-7 rounded-lg bg-white/90 text-red-600 hidden group-hover:flex items-center justify-center shadow"><Trash2 size={13} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ---------- Incidencias ---------- */}
        {(wo.incidencias || []).length > 0 && (
          <Section icon={AlertTriangle} title="Incidencias que resuelve">
            <div className="flex flex-col gap-1.5">
              {wo.incidencias.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <Chip map={INC_STATUS} value={i.status} />
                  <span className={`font-bold ${PRIORITY[i.priority]?.cls}`}>{PRIORITY[i.priority]?.label}</span>
                  <span className="text-slate-800 dark:text-slate-100">{i.title}</span>
                  <span className="text-xs text-slate-400">· {i.reported_by || "—"} · {fmtDateTime(i.created_at)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ---------- Historial ---------- */}
        <Section icon={History} title="Historial">
          <ol className="flex flex-col gap-2">
            {(wo.eventos || []).map((e) => (
              <li key={e.id} className="text-sm">
                <span className="text-xs text-slate-400 tabular-nums">{fmtDateTime(e.created_at)}</span> · <b className="text-slate-800 dark:text-slate-100">{e.title}</b>
                {e.created_by && <span className="text-slate-500"> · {e.created_by}</span>}
                {e.detail && <span className="block text-slate-500 text-xs">{e.detail}</span>}
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </Modal>
  );
}
