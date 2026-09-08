import { useState, useEffect, useCallback } from "react";
import { BellRing, RefreshCw } from "lucide-react";
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
import { PageLayout } from "@/components/layout/PageLayout";
import { formatHora } from "@/lib/trackerFormat";

const TrackerAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await trackerService.getRecentAlerts();
      setAlerts(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error cargando alertas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const activas = alerts.filter((a) => !a.resolved_at).length;

  return (
    <PageLayout icon={BellRing} title="Alertas" subtitle="TRACKER GPS DE FLOTA" accentColor="orange">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-4">
          <Card className="px-5 py-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Total alertas</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{alerts.length}</div>
          </Card>
          <Card className="px-5 py-3 border-red-200 dark:border-red-500/20">
            <div className="text-[11px] font-bold text-red-600 uppercase">Activas ahora</div>
            <div className="text-2xl font-black text-red-600">{activas}</div>
          </Card>
        </div>
        <Button onClick={loadAlerts} variant="outline" className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 text-sm">
          <RefreshCw size={16} />
          Actualizar
        </Button>
      </div>

      <Card className="w-full overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Mensaje</TableHead>
              <TableHead>Notificada</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">Cargando...</TableCell>
              </TableRow>
            ) : alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  Sin alertas registradas todavía
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((a, i) => (
                <TableRow key={a.id} className={i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"}>
                  <TableCell className="text-sm whitespace-nowrap">{formatHora(a.triggered_at)}</TableCell>
                  <TableCell className="text-sm">{a.unit_code || a.plate || "-"}</TableCell>
                  <TableCell className="text-sm">
                    <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-orange-500/10 text-orange-600">
                      {a.alert_type === "fuera_de_horario" ? "Fuera de horario" : "Fuera de zona"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs max-w-md whitespace-pre-line text-slate-500 dark:text-slate-400">
                    {a.message}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${a.notified ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                      {a.notified ? "Sí" : "No"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${a.resolved_at ? "bg-slate-500/10 text-slate-500" : "bg-red-500/10 text-red-600"}`}>
                      {a.resolved_at ? "Resuelta" : "Activa"}
                    </span>
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

export default TrackerAlerts;
