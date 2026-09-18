import { useState, useEffect, useCallback } from "react";
import { X, Route, Clock, Gauge, MapPinned } from "lucide-react";
import { trackerService } from "@/services";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const formatHora = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
};

const formatHoras = (horas) => {
  if (horas == null) return "-";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  return `${horas.toFixed(1)} h`;
};

const veTodayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });

/**
 * Recorridos de una unidad en un día (Fase 3, pedido de Lguerra 17-18/09/2026):
 * lista de viajes (salida/llegada/duración/distancia) más los totales del
 * día, con la opción de dibujar cualquier viaje en el mapa. `unit` necesita
 * `gps_unit_id` (id interno de la plataforma GPS, no el id de tracker_unit)
 * -- sin eso no hay a quién pedirle los recorridos.
 */
export default function RecorridosPanel({ unit, onClose, onVerRuta, selectedTripIndex }) {
  const [fecha, setFecha] = useState(veTodayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!unit?.gps_unit_id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await trackerService.getRecorridos({ gps_unit_id: unit.gps_unit_id, fecha });
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Error al cargar los recorridos");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [unit?.gps_unit_id, fecha]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!unit) return null;

  const label = unit.unit_code || unit.plate || "Unidad sin identificar";

  return (
    <Card className="w-full overflow-hidden mb-4 border-blue-200 dark:border-blue-500/20">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-blue-500 text-white">
            <Route size={16} />
          </span>
          <span className="font-bold text-slate-900 dark:text-white">Recorridos — {label}</span>
          {unit.plate && <span className="text-xs text-slate-400">{unit.plate}</span>}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={fecha}
            max={veTodayISO()}
            onChange={(e) => setFecha(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115]"
          />
          <Button variant="outline" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
            <X size={14} />
          </Button>
        </div>
      </div>

      <div className="p-5">
        {loading && <p className="text-sm text-slate-400 text-center py-6">Cargando recorridos...</p>}
        {error && <p className="text-sm text-red-500 text-center py-6">{error}</p>}

        {!loading && !error && data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
              <div className="rounded-xl border border-slate-100 dark:border-white/5 px-3 py-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Recorridos</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">{data.total_recorridos}</div>
              </div>
              <div className="rounded-xl border border-slate-100 dark:border-white/5 px-3 py-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Primera salida</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{formatHora(data.primera_salida)}</div>
              </div>
              <div className="rounded-xl border border-slate-100 dark:border-white/5 px-3 py-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Última llegada</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{formatHora(data.ultima_llegada)}</div>
              </div>
              <div className="rounded-xl border border-slate-100 dark:border-white/5 px-3 py-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Kilómetros</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">{data.km_totales}</div>
              </div>
              <div className="rounded-xl border border-emerald-100 dark:border-emerald-500/20 px-3 py-2">
                <div className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-1"><Gauge size={11} />En movimiento</div>
                <div className="text-sm font-bold text-emerald-600">{formatHoras(data.horas_en_movimiento)}</div>
              </div>
              <div className="rounded-xl border border-amber-100 dark:border-amber-500/20 px-3 py-2">
                <div className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1"><Clock size={11} />Estacionado</div>
                <div className="text-sm font-bold text-amber-600">{formatHoras(data.horas_estacionado)}</div>
              </div>
            </div>

            {data.viajes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Sin recorridos registrados para esta fecha.</p>
            ) : (
              <div className="rounded-xl border border-slate-100 dark:border-white/5 overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-left">
                      <th className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase">Salida</th>
                      <th className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase">Llegada</th>
                      <th className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase">Duración</th>
                      <th className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase">Distancia</th>
                      <th className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase">Ubicación</th>
                      {onVerRuta && <th className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase text-right">Ruta</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.viajes.map((v, i) => (
                      <tr key={i} className={`${i % 2 === 0 ? "bg-transparent" : "bg-slate-50/60 dark:bg-white/[0.02]"} ${selectedTripIndex === i ? "outline outline-2 outline-blue-400" : ""}`}>
                        <td className="px-4 py-2 whitespace-nowrap">{formatHora(v.beginTime)}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{formatHora(v.endTime)}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{v.duration || "-"}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{v.distanceKm != null ? `${v.distanceKm} km` : "-"}</td>
                        <td className="px-4 py-2 max-w-xs truncate">{v.location || "-"}</td>
                        {onVerRuta && (
                          <td className="px-4 py-2 text-right">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => onVerRuta({ tripIndex: i, unit, viaje: v })}
                            >
                              <MapPinned size={14} />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
