import { useState, useEffect, useCallback } from "react";
import { Map, RefreshCw } from "lucide-react";
import { trackerService } from "@/services";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/layout/PageLayout";
import TrackerMap from "@/components/TrackerMap/TrackerMap";

// Refresca solo (sin llamar a la API real de nuevo): lee lo último guardado
// por la sincronización automática (cron cada 10 min) o por el botón manual.
const AUTO_REFRESH_MS = 30000;

const TrackerMapPage = () => {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await trackerService.getLatestSnapshots();
      setSnapshots(Array.isArray(res) ? res : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error cargando mapa de flota:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
    const interval = setInterval(loadSnapshots, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadSnapshots]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await trackerService.syncNow();
      await loadSnapshots();
    } catch (err) {
      console.error("Error sincronizando:", err);
    } finally {
      setSyncing(false);
    }
  };

  const withCoords = snapshots.filter((s) => s.latitude != null && s.longitude != null);
  const activas = snapshots.filter((s) => s.status === "ACTIVO" && !s.is_stale).length;
  const estacionadas = snapshots.filter((s) => s.status === "ESTACIONADO" && !s.is_stale).length;
  const sinSenal = snapshots.filter((s) => s.is_stale).length;

  return (
    <PageLayout icon={Map} title="Mapa en Vivo" subtitle="TRACKER GPS DE FLOTA" accentColor="orange">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Activas ({activas})
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Estacionadas ({estacionadas})
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Sin señal reciente ({sinSenal})
          </span>
          <span className="text-slate-400">
            {withCoords.length} de {snapshots.length} unidades con coordenadas
          </span>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-400">
              Actualizado {lastUpdated.toLocaleTimeString("es-VE")}
            </span>
          )}
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-xl font-bold flex items-center gap-2 px-5 h-10 bg-orange-500 hover:bg-orange-600 text-white text-sm"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
          </Button>
        </div>
      </div>

      <Card className="w-full overflow-hidden p-0" style={{ height: "70vh" }}>
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">Cargando mapa...</div>
        ) : (
          <TrackerMap snapshots={snapshots} />
        )}
      </Card>
    </PageLayout>
  );
};

export default TrackerMapPage;
