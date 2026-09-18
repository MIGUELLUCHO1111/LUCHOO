import { useState, useEffect, useCallback } from "react";
import { Map, RefreshCw, Route } from "lucide-react";
import { trackerService } from "@/services";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/layout/PageLayout";
import TrackerMap from "@/components/TrackerMap/TrackerMap";
import RecorridosPanel from "@/components/TrackerMap/RecorridosPanel";

const veTodayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });

// Refresca solo (sin llamar a la API real de nuevo): lee lo último guardado
// por la sincronización automática (cron cada 10 min) o por el botón manual.
const AUTO_REFRESH_MS = 30000;

const TrackerMapPage = () => {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Recorridos (Fase 3, 17-18/09/2026): se puede abrir haciendo clic en una
  // unidad del mapa o eligiendola aparte en el selector -- ambas formas
  // comparten el mismo panel y el mismo dibujo de ruta en el mapa.
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [routePoints, setRoutePoints] = useState(null);
  const [selectedTripIndex, setSelectedTripIndex] = useState(null);
  const [pickerPlate, setPickerPlate] = useState("");

  const abrirRecorridos = (snapshot) => {
    setSelectedUnit(snapshot);
    setRoutePoints(null);
    setSelectedTripIndex(null);
  };

  const cerrarRecorridos = () => {
    setSelectedUnit(null);
    setRoutePoints(null);
    setSelectedTripIndex(null);
  };

  const verRuta = async ({ tripIndex, unit, viaje }) => {
    setSelectedTripIndex(tripIndex);
    try {
      const puntos = await trackerService.getRuta({
        gps_unit_id: unit.gps_unit_id,
        startdate: viaje.beginTime?.slice(0, 19),
        enddate: viaje.endTime?.slice(0, 19),
      });
      setRoutePoints(Array.isArray(puntos) ? puntos : []);
    } catch (err) {
      console.error("Error cargando la ruta del viaje:", err);
    }
  };

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

      <Card className="w-full overflow-hidden p-0 mb-4" style={{ height: "70vh" }}>
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">Cargando mapa...</div>
        ) : (
          <TrackerMap snapshots={snapshots} onSelectUnit={abrirRecorridos} routePoints={routePoints} />
        )}
      </Card>

      {/* Recorridos (Fase 3): dos formas de abrir el mismo panel -- clic en
          una unidad del mapa (ver TrackerMap/onSelectUnit), o eligiendola
          aca sin depender de encontrarla en el mapa. */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={pickerPlate}
          onChange={(e) => setPickerPlate(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] min-w-[220px]"
        >
          <option value="">Elegir unidad para ver recorridos...</option>
          {snapshots
            .filter((s) => s.gps_unit_id != null)
            .map((s) => (
              <option key={s.plate || s.gps_unit_id} value={s.plate || ""}>
                {s.unit_code || s.plate} {s.plate ? `· ${s.plate}` : ""}
              </option>
            ))}
        </select>
        <Button
          variant="outline"
          disabled={!pickerPlate}
          onClick={() => {
            const s = snapshots.find((x) => x.plate === pickerPlate);
            if (s) abrirRecorridos(s);
          }}
          className="rounded-xl font-bold flex items-center gap-2 h-10 text-sm"
        >
          <Route size={16} />
          Ver recorridos
        </Button>
      </div>

      {selectedUnit && (
        <RecorridosPanel
          unit={selectedUnit}
          onClose={cerrarRecorridos}
          onVerRuta={verRuta}
          selectedTripIndex={selectedTripIndex}
        />
      )}
    </PageLayout>
  );
};

export default TrackerMapPage;
