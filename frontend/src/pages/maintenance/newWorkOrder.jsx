import { useEffect, useMemo, useState } from "react";
import { ClipboardPlus, Siren, Wrench, CalendarCheck } from "lucide-react";
import { maintenanceService } from "@/services";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchableSelect";
import { Modal, ErrorBox, Chip, CRIT, PRIORITY, ROLE_LABEL, inputCls, labelCls, unitLabel } from "./mntShared";

// Nueva Orden de Trabajo. El nivel de una correctiva lo decide el backend
// (mntCommon.computeLevel); aquí se muestra el mismo cálculo como vista previa.
const KINDS = [
  { value: "CORRECTIVA", icon: Wrench, title: "Correctiva", hint: "Una falla o hallazgo que hay que reparar. Necesita aprobación antes de ejecutarse." },
  { value: "PREVENTIVA", icon: CalendarCheck, title: "Preventiva", hint: "Servicio programado (aceite, filtros, inspección). Aprobada por el plan; el supervisor la valida al cerrar." },
  { value: "EMERGENCIA", icon: Siren, title: "Emergencia", hint: "Riesgo inminente: se ejecuta de una vez y Gerencia de Mantenimiento la regulariza después." },
];

const previewLevel = ({ criticality, cost, special, threshold }) => {
  if (criticality === "CRITICO") return { level: "MAYOR", why: "equipo crítico" };
  if (special) return { level: "MAYOR", why: "requiere compra especial" };
  if (threshold != null && cost !== "" && Number(cost) >= Number(threshold)) return { level: "MAYOR", why: `costo estimado ≥ ${threshold} USD` };
  return { level: "MENOR", why: threshold == null ? "equipo no crítico (umbral en USD aún sin definir)" : "equipo no crítico y costo bajo el umbral" };
};

export default function NewWorkOrder({ onClose, onCreated, presetUnitId, presetIncidentIds = [], presetKind = "CORRECTIVA" }) {
  const [units, setUnits] = useState([]);
  const [threshold, setThreshold] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    unit_id: presetUnitId ? Number(presetUnitId) : null, kind: presetKind, title: "", description: "", priority: "",
    estimated_cost_usd: "", special_purchase: false, out_of_service: presetKind === "EMERGENCIA",
    meter: "", open_meter_value: "", technician: "", provider: "", provider_id: "", tasks: "",
  });
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [incSel, setIncSel] = useState(presetIncidentIds.map(Number));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    maintenanceService.listarUnidades().then((d) => setUnits(Array.isArray(d) ? d : [])).catch((e) => setError(e.message));
    maintenanceService.listarServicios().then((d) => setServices((Array.isArray(d) ? d : []).filter((x) => x.active))).catch(() => {});
    maintenanceService.listarProveedores().then((d) => setProviders((Array.isArray(d) ? d : []).filter((x) => x.active))).catch(() => {});
    maintenanceService.getAjustes().then((a) => {
      const v = a?.CORRECTIVA_MAYOR_UMBRAL_USD;
      setThreshold(v === null || v === undefined || v === "" ? null : Number(v));
    }).catch(() => {});
  }, []);

  const unit = useMemo(() => units.find((u) => Number(u.id) === Number(f.unit_id)) || null, [units, f.unit_id]);

  useEffect(() => {
    if (!f.unit_id) { setIncidents([]); return; }
    maintenanceService.listarIncidencias(f.unit_id).then((d) => setIncidents((Array.isArray(d) ? d : []).filter((i) => i.status === "ABIERTA"))).catch(() => setIncidents([]));
  }, [f.unit_id]);

  useEffect(() => {
    if (unit && !f.meter) set("meter", ["PESADA", "ESTATICO"].includes(unit.fleet_type) ? "HORAS" : "KM");
  }, [unit]); // eslint-disable-line react-hooks/exhaustive-deps

  const lvl = f.kind === "CORRECTIVA" && unit ? previewLevel({ criticality: unit.criticality, cost: f.estimated_cost_usd, special: f.special_purchase, threshold }) : null;
  const firmas = lvl ? (lvl.level === "MAYOR" ? ["GERENCIA_MTTO", "GERENCIA_OPS"] : ["SUPERVISOR"]) : [];

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const wo = await maintenanceService.crearOrden({
        unit_id: f.unit_id, kind: f.kind, title: f.title, description: f.description || null,
        priority: f.priority || null,
        estimated_cost_usd: f.kind === "CORRECTIVA" && f.estimated_cost_usd !== "" ? f.estimated_cost_usd : null,
        special_purchase: f.kind === "CORRECTIVA" && f.special_purchase,
        out_of_service: f.out_of_service, meter: f.meter || null,
        open_meter_value: f.open_meter_value !== "" ? f.open_meter_value : null,
        technician: f.technician || null, provider: f.provider || null, provider_id: f.provider_id ? Number(f.provider_id) : null,
        incident_ids: incSel, tasks: f.tasks.split("\n").map((t) => t.trim()).filter(Boolean),
      });
      onCreated?.(wo);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nueva Orden de Trabajo" icon={ClipboardPlus} onClose={onClose} wide>
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {KINDS.map(({ value, icon: Icon, title, hint }) => (
            <button key={value} type="button" onClick={() => { set("kind", value); if (value === "EMERGENCIA") set("out_of_service", true); }}
              className={`text-left rounded-2xl border p-3 transition-colors ${f.kind === value ? (value === "EMERGENCIA" ? "border-red-400 bg-red-50 dark:bg-red-500/10" : "border-brand-navy bg-brand-navy/5 dark:bg-white/5") : "border-slate-200 dark:border-slate-700 hover:border-brand-navy/40"}`}>
              <span className="flex items-center gap-2 font-extrabold text-sm text-slate-900 dark:text-white"><Icon size={15} /> {title}</span>
              <span className="block mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{hint}</span>
            </button>
          ))}
        </div>

        <div className="md:col-span-2 flex flex-col gap-1.5">
          <span className={labelCls}>Unidad *</span>
          <SearchableSelect items={units} getValue={(u) => Number(u.id)} getLabel={unitLabel} value={f.unit_id} onChange={(id) => { set("unit_id", id); setIncSel([]); }} placeholder="Buscar por código o placa..." emptyMessage="Sin unidades" />
          {unit && (
            <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Chip map={CRIT} value={unit.criticality} /> {unit.fleet_type === "PESADA" ? "Flota pesada" : unit.fleet_type === "LIVIANA" ? "Flota liviana" : unit.fleet_type === "ESTATICO" ? "Equipo estático" : "Sin tipo de flota"}
              {unit.open_orders > 0 && <span className="font-bold text-amber-700">· ya tiene {unit.open_orders} OT abierta(s)</span>}
            </span>
          )}
        </div>

        <div className="md:col-span-2 flex flex-col gap-1.5">
          <span className={labelCls}>Título *</span>
          <input className={inputCls} value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={200} placeholder={f.kind === "PREVENTIVA" ? "Ej. Servicio de 250 h: aceite y filtros" : "Ej. Fuga en manguera del sistema hidráulico"} />
        </div>
        <div className="md:col-span-2 flex flex-col gap-1.5">
          <span className={labelCls}>Descripción de la falla o tarea</span>
          <textarea className={`${inputCls} min-h-[70px]`} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>Prioridad</span>
          <select className={inputCls} value={f.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="">{f.kind === "EMERGENCIA" ? "Crítica (por defecto)" : "Media (por defecto)"}</option>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
          <input type="checkbox" checked={f.out_of_service} onChange={(e) => set("out_of_service", e.target.checked)} className="accent-brand-navy h-4 w-4" />
          La unidad queda parada (Fuera de servicio en Flota)
        </label>

        {f.kind === "CORRECTIVA" && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>Costo estimado (USD)</span>
              <input type="number" min="0" step="0.01" className={inputCls} value={f.estimated_cost_usd} onChange={(e) => set("estimated_cost_usd", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={f.special_purchase} onChange={(e) => set("special_purchase", e.target.checked)} className="accent-brand-navy h-4 w-4" />
              Requiere compra especial / repuesto importado
            </label>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>Lectura al abrir</span>
          <div className="flex gap-2">
            <select className={`${inputCls} w-28`} value={f.meter} onChange={(e) => set("meter", e.target.value)}>
              <option value="KM">km</option>
              <option value="HORAS">horas</option>
            </select>
            <input type="number" min="0" step="0.1" className={inputCls} value={f.open_meter_value} onChange={(e) => set("open_meter_value", e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>Técnico / Proveedor externo</span>
          <div className="flex gap-2">
            <input className={inputCls} value={f.technician} onChange={(e) => set("technician", e.target.value)} placeholder="Técnico" />
            {providers.length ? (
              <select className={inputCls} value={f.provider_id} onChange={(e) => set("provider_id", e.target.value)}>
                <option value="">Sin proveedor externo</option>
                {providers.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}{pr.type ? ` · ${pr.type}` : ""}</option>)}
              </select>
            ) : (
              <input className={inputCls} value={f.provider} onChange={(e) => set("provider", e.target.value)} placeholder="Taller externo" />
            )}
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col gap-1.5">
          <span className={labelCls}>Tareas (una por línea)</span>
          {services.length > 0 && (
            <select className={inputCls} value="" onChange={(e) => { const sv = services.find((x) => String(x.id) === e.target.value); if (sv) set("tasks", [f.tasks.trim(), sv.est_minutes ? `${sv.name} (~${sv.est_minutes} min)` : sv.name].filter(Boolean).join("\n")); }}>
              <option value="">+ Agregar un servicio del catálogo...</option>
              {services.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}{sv.est_minutes ? ` · ${sv.est_minutes} min` : ""}</option>)}
            </select>
          )}
          <textarea className={`${inputCls} min-h-[60px]`} value={f.tasks} onChange={(e) => set("tasks", e.target.value)} placeholder={"Cambiar manguera\nProbar estabilizadores"} />
        </div>

        {incidents.length > 0 && (
          <div className="md:col-span-2 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 p-3">
            <span className={labelCls}>Incidencias abiertas de esta unidad · marca las que resuelve esta OT</span>
            <div className="mt-2 flex flex-col gap-1">
              {incidents.map((i) => (
                <label key={i.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="accent-brand-navy" checked={incSel.includes(Number(i.id))}
                    onChange={() => setIncSel((s) => (s.includes(Number(i.id)) ? s.filter((x) => x !== Number(i.id)) : [...s, Number(i.id)]))} />
                  <span className={`font-bold ${PRIORITY[i.priority]?.cls}`}>{PRIORITY[i.priority]?.label}</span> {i.title}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="md:col-span-2 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3 text-sm text-slate-700 dark:text-slate-200">
          {f.kind === "CORRECTIVA" ? (
            unit ? (
              <>Será una <b>correctiva {lvl.level === "MAYOR" ? "mayor" : "menor"}</b> ({lvl.why}). Necesita la firma de: <b>{firmas.map((r) => ROLE_LABEL[r]).join(" y ")}</b>{lvl.level === "MAYOR" ? " (dos personas distintas)" : ""}.</>
            ) : "Elige la unidad para ver quién debe aprobar la OT."
          ) : f.kind === "EMERGENCIA" ? (
            <>Queda <b>aprobada para ejecutarse ya</b>. Gerencia de Mantenimiento debe regularizarla (por defecto en 48 h) antes de poder cerrarla.</>
          ) : (
            <>Queda <b>aprobada por el plan</b>. El Supervisor de Mantenimiento la valida al cerrarla.</>
          )}
        </div>

        <div className="md:col-span-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button type="submit" disabled={saving || !f.unit_id || !f.title.trim()} className="rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white">
            {saving ? "Creando..." : "Crear OT"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
