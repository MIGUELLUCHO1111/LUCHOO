import { Fragment, useCallback, useEffect, useState } from "react";
import { Activity, ChevronDown, ChevronRight, RefreshCw, ShieldAlert } from "lucide-react";
import { activityService } from "@/services";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageLayout } from "@/components/layout/PageLayout";

// Seguridad > Actividad de usuarios (migración 066, 08/10/2026): última vez
// que entró cada usuario y una auditoría pequeña de uso. Solo lectura.

const TZ = "America/Caracas";

const ESTADOS = {
  EN_LINEA: { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  HOY: { dot: "bg-sky-500", pill: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
  RECIENTE: { dot: "bg-amber-500", pill: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" },
  INACTIVO: { dot: "bg-slate-400", pill: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400" },
  NUNCA: { dot: "bg-slate-300 dark:bg-slate-600", pill: "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-500" },
};

const MODULOS = {
  Fuel: "Combustible",
  Tracker: "Tracker GPS",
  Horas: "Control de Horas",
  Flota: "Flota",
  Mantenimiento: "Mantenimiento",
  Security: "Seguridad",
  Users: "Usuarios",
};

const EVENTOS = {
  LOGIN_OK: { texto: "Inició sesión", clase: "text-emerald-600 dark:text-emerald-400" },
  LOGOUT: { texto: "Cerró sesión", clase: "text-slate-600 dark:text-slate-300" },
  LOGOUT_IDLE: { texto: "Sesión cerrada por inactividad", clase: "text-slate-500 dark:text-slate-400" },
  LOGIN_FAIL: { texto: "Contraseña o usuario incorrecto", clase: "text-red-600 dark:text-red-400" },
  LOGIN_BLOCKED: { texto: "Intento de un usuario desactivado", clase: "text-red-600 dark:text-red-400" },
};

const fechaHora = (v) =>
  v
    ? new Date(v).toLocaleString("es-VE", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
const hora = (v) => (v ? new Date(v).toLocaleTimeString("es-VE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : "—");
const dia = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const nombre = (u) => [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.username;

const Stat = ({ label, value, tone }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-2xl font-black ${tone || "text-slate-900 dark:text-white"}`}>{value}</p>
    </CardContent>
  </Card>
);

function DetalleUsuario({ usuario }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    activityService
      .detalleUsuario(usuario.id, 14)
      .then((d) => vivo && setData(d))
      .catch((e) => vivo && setError(e.response?.data?.message || "No se pudo cargar el detalle"));
    return () => {
      vivo = false;
    };
  }, [usuario.id]);

  if (error) return <p className="text-sm text-red-500 py-3">{error}</p>;
  if (!data) return <p className="text-sm text-slate-400 py-3">Cargando...</p>;

  const max = Math.max(1, ...data.diario.map((d) => d.actions));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Últimos {data.dias} días</p>
        {data.diario.length === 0 ? (
          <p className="text-sm text-slate-400">Sin actividad registrada en estos días.</p>
        ) : (
          <ul className="space-y-2">
            {data.diario.map((d) => (
              <li key={d.fecha} className="text-xs">
                <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-slate-900 dark:text-white w-20">{dia(d.fecha)}</span>
                  <span className="flex-1">
                    {hora(d.first_seen)} – {hora(d.last_seen)}
                  </span>
                  <span className="tabular-nums">
                    {d.actions} acc. · {d.writes} cambios
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-brand-navy dark:bg-sky-400" style={{ width: `${(d.actions / max) * 100}%` }} />
                </div>
                {d.modules?.length > 0 && (
                  <p className="mt-0.5 text-[11px] text-slate-400">{d.modules.map((m) => MODULOS[m] || m).join(" · ")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Inicios y cierres de sesión</p>
        {data.eventos.length === 0 ? (
          <p className="text-sm text-slate-400">Sin eventos registrados todavía.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {data.eventos.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span className={`font-semibold ${EVENTOS[e.event]?.clase || ""}`}>{EVENTOS[e.event]?.texto || e.event}</span>
                <span className="text-slate-400 tabular-nums">
                  {fechaHora(e.created_at)}
                  {e.ip ? ` · ${e.ip}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const UserActivity = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    activityService
      .listarUsuarios()
      .then(setData)
      .catch((e) => setError(e.response?.data?.message || "No se pudo cargar la actividad"))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  const r = data?.resumen;

  return (
    <PageLayout icon={Activity} title="Actividad de usuarios" subtitle="QUIÉN ESTÁ USANDO EL SISTEMA • SE ACTUALIZA CADA MINUTO" accentColor="navy">
      <div className="flex justify-end mb-4">
        <Button variant="outline" onClick={cargar} disabled={cargando} className="rounded-xl text-sm flex items-center gap-2">
          <span className="inline-flex">
            <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
          </span>
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {r && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Stat label="En línea ahora" value={r.en_linea} tone="text-emerald-600 dark:text-emerald-400" />
          <Stat label="Activos hoy" value={r.activos_hoy} />
          <Stat label="Activos últimos 7 días" value={`${r.activos_7_dias} de ${r.total}`} />
          <Stat label="Nunca han entrado" value={r.nunca} />
          <Stat label="Intentos fallidos (7 días)" value={r.intentos_fallidos_7_dias} tone={r.intentos_fallidos_7_dias ? "text-red-600 dark:text-red-400" : undefined} />
        </div>
      )}

      <Card className="w-full overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Usuario</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Última actividad</TableHead>
                <TableHead>Último inicio de sesión</TableHead>
                <TableHead>Hoy</TableHead>
                <TableHead>Últimos 7 días</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    {error ? "—" : "Cargando..."}
                  </TableCell>
                </TableRow>
              ) : (
                data.usuarios.map((u) => {
                  const est = ESTADOS[u.estado] || ESTADOS.INACTIVO;
                  const open = abierto === u.id;
                  return (
                    <Fragment key={u.id}>
                      <TableRow onClick={() => setAbierto(open ? null : u.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                        <TableCell className="text-slate-400">
                          <span className="inline-flex">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                        </TableCell>
                        <TableCell>
                          <p className="font-bold text-slate-900 dark:text-white">{nombre(u)}</p>
                          <p className="text-xs text-slate-400">{u.username}{!u.is_active ? " · desactivado" : ""}</p>
                        </TableCell>
                        <TableCell className="text-sm">{u.profiles || "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${est.pill}`}>
                            <span className={`h-2 w-2 rounded-full ${est.dot}`} />
                            {u.etiqueta}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {fechaHora(u.last_seen_at)}
                          {u.last_ip && <p className="text-[11px] text-slate-400">IP {u.last_ip}</p>}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{fechaHora(u.last_login_at)}</TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {u.actions_today ? (
                            <>
                              {u.actions_today} acc.
                              <p className="text-[11px] text-slate-400">{u.writes_today} cambios</p>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {u.active_days_7} de 7 días
                          <p className="text-[11px] text-slate-400">
                            {u.actions_7} acc. · {u.logins_7} inicios
                          </p>
                        </TableCell>
                      </TableRow>
                      {open && (
                        <TableRow className="bg-slate-50/60 dark:bg-white/[0.02] hover:bg-slate-50/60">
                          <TableCell colSpan={8} className="px-6">
                            <DetalleUsuario usuario={u} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {data?.fallidos?.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span className="inline-flex text-red-500">
                <ShieldAlert size={16} />
              </span>
              Intentos de entrada fallidos (últimos 7 días)
            </p>
            <p className="text-xs text-slate-400 mb-3">
              Incluye nombres de usuario que no existen. Muchos intentos seguidos desde una misma IP pueden ser alguien probando contraseñas.
            </p>
            <ul className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
              {data.fallidos.map((f, i) => (
                <li key={i} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-mono font-bold">{f.username || "(sin usuario)"}</span>{" "}
                    <span className={EVENTOS[f.event]?.clase}>{EVENTOS[f.event]?.texto || f.event}</span>
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {fechaHora(f.created_at)}
                    {f.ip ? ` · IP ${f.ip}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
};

export default UserActivity;
