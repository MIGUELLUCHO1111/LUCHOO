import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Check, Ban } from "lucide-react";
import { trackerService } from "@/services";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatHora } from "@/lib/trackerFormat";

// Tercera pestaña de Notificaciones (pedido de Lguerra, 24/09/2026): el bot
// de Telegram ya no suscribe solo a cualquiera que le escriba. Quien le
// escribe queda PENDIENTE y no recibe nada hasta que se le aprueba aquí;
// "Quitar acceso" lo deja BLOQUEADO (aunque vuelva a escribir, no se
// reactiva solo).
const ESTADOS = {
  PENDIENTE: { label: "Pendiente", className: "bg-amber-500/10 text-amber-600" },
  ACTIVO: { label: "Activo", className: "bg-emerald-500/10 text-emerald-600" },
  BLOQUEADO: { label: "Sin acceso", className: "bg-slate-500/10 text-slate-500" },
};

const fechaCorta = (iso) =>
  iso ? `${new Date(iso).toLocaleDateString("es-VE", { timeZone: "America/Caracas" })} ${formatHora(iso)}` : "-";

const SuscriptoresTelegram = () => {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trabajando, setTrabajando] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await trackerService.listarSuscriptores();
      setSubs(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando suscriptores de Telegram:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const nombreDe = (s) => [s.first_name, s.username ? `@${s.username}` : null].filter(Boolean).join(" · ") || `chat ${s.chat_id}`;

  const accion = async (s, tipo) => {
    if (tipo === "quitar" && !window.confirm(`¿Quitarle el acceso al bot a ${nombreDe(s)}? Dejará de recibir alertas y reportes.`)) return;
    setTrabajando(s.id);
    try {
      if (tipo === "aprobar") await trackerService.aprobarSuscriptor(s.id);
      else await trackerService.quitarAccesoSuscriptor(s.id);
      await load();
    } catch (err) {
      console.error("Error cambiando el acceso del suscriptor:", err);
      window.alert("No se pudo cambiar el acceso. Intenta de nuevo.");
    } finally {
      setTrabajando(null);
    }
  };

  const cuenta = (status) => subs.filter((s) => s.status === status).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Card className="px-5 py-3 border-emerald-200 dark:border-emerald-500/20">
          <div className="text-[11px] font-bold text-emerald-600 uppercase">Reciben mensajes</div>
          <div className="text-2xl font-black text-emerald-600">{cuenta("ACTIVO")}</div>
        </Card>
        <Card className="px-5 py-3 border-amber-200 dark:border-amber-500/20">
          <div className="text-[11px] font-bold text-amber-600 uppercase">Pendientes de aprobar</div>
          <div className="text-2xl font-black text-amber-600">{cuenta("PENDIENTE")}</div>
        </Card>
        <Card className="px-5 py-3">
          <div className="text-[11px] font-bold text-slate-400 uppercase">Sin acceso</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{cuenta("BLOQUEADO")}</div>
        </Card>
        <Button onClick={load} variant="outline" className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 text-sm ml-auto">
          <RefreshCw size={16} />
          Actualizar
        </Button>
      </div>

      <Card className="w-full overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Pidió acceso</TableHead>
              <TableHead>Último cambio</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">Cargando...</TableCell>
              </TableRow>
            ) : subs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  Nadie le ha escrito al bot todavía
                </TableCell>
              </TableRow>
            ) : (
              subs.map((s, i) => {
                const estado = ESTADOS[s.status] || ESTADOS.PENDIENTE;
                return (
                  <TableRow key={s.id} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                    <TableCell className="text-sm font-bold">{nombreDe(s)}</TableCell>
                    <TableCell className="text-sm">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${estado.className}`}>{estado.label}</span>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fechaCorta(s.created_at)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fechaCorta(s.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {s.status !== "ACTIVO" && (
                          <Button
                            size="sm"
                            disabled={trabajando === s.id}
                            onClick={() => accion(s, "aprobar")}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1"
                          >
                            <Check size={14} /> Aprobar
                          </Button>
                        )}
                        {s.status !== "BLOQUEADO" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={trabajando === s.id}
                            onClick={() => accion(s, "quitar")}
                            className="rounded-lg text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10 font-bold gap-1"
                          >
                            <Ban size={14} /> Quitar acceso
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 max-w-2xl">
        Para dar acceso a alguien nuevo: que busque el bot en Telegram y le escriba cualquier mensaje. Aparecerá aquí como
        pendiente (y a los que ya reciben mensajes les llega un aviso); no recibe nada hasta que lo apruebes. Quitar el
        acceso no borra lo que esa persona ya recibió ni le impide abrir el chat del bot — solo deja de llegarle todo lo nuevo.
      </p>
    </>
  );
};

export default SuscriptoresTelegram;
