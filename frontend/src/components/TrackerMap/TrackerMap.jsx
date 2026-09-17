import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Colores por estado (mismo criterio que la tabla del tracker).
const STATUS_COLOR = {
  ACTIVO: "#10b981", // verde: en movimiento / encendida
  ESTACIONADO: "#ef4444", // rojo: apagada / detenida
};
const STALE_COLOR = "#f59e0b"; // amarillo: sin señal reciente -- revisar en sitio

// Centro por defecto: Zulia, Venezuela (zona de operación de la flota).
const DEFAULT_CENTER = [10.35, -71.6];
const DEFAULT_ZOOM = 9;

const MARKER_RADIUS = 8;
const MARKER_RADIUS_HOVER = 10;
// Acercamiento sutil al seleccionar (unos pocos niveles desde donde ya
// estaba el mapa, nunca un salto directo a un zoom fijo alto) -- pedido de
// Lguerra, 17/09/2026, tras ver que ir directo a zoom 15 se sentia brusco.
const CLICK_ZOOM_STEP = 3;
const CLICK_ZOOM_MAX = 14;

const formatHora = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

/**
 * Mapa en vivo de la flota (Fase 3). Recibe los mismos snapshots que la
 * tabla de estado; solo dibuja los que tienen coordenadas válidas.
 */
export default function TrackerMap({ snapshots = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const boundsRef = useRef(null);
  const hasFitBoundsRef = useRef(false);

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // El contenedor puede no tener su tamaño final en el primer render (la
    // tarjeta que lo envuelve anima su entrada); sin re-ajustar cuando el
    // tamaño real se estabiliza, Leaflet calcula los límites contra un
    // contenedor chico y el mapa queda con zoom mundial en vez de la flota.
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
      if (boundsRef.current) map.fitBounds(boundsRef.current.pad(0.2));
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Redibuja los marcadores cada vez que cambian los datos.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const withCoords = snapshots.filter(
      (s) => s.latitude != null && s.longitude != null && !Number.isNaN(Number(s.latitude)) && !Number.isNaN(Number(s.longitude))
    );

    for (const s of withCoords) {
      const color = s.is_stale ? STALE_COLOR : STATUS_COLOR[s.status] || STALE_COLOR;

      const marker = L.circleMarker([Number(s.latitude), Number(s.longitude)], {
        radius: MARKER_RADIUS,
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.9,
        className: "tracker-marker",
      });

      const label = s.unit_code || s.plate || "Unidad sin identificar";
      marker.bindPopup(
        `<strong>${label}</strong>${s.plate ? ` · ${s.plate}` : ""}<br/>` +
          `${s.driver_name ? `Conductor: ${s.driver_name}<br/>` : ""}` +
          `Estado: <strong style="color:${color}">${s.status}</strong>${s.is_stale ? " (sin señal reciente)" : ""}<br/>` +
          `Ubicación: ${s.location_text || "desconocida"}<br/>` +
          `Hora: ${formatHora(s.last_report_at)}`
      );

      // Acercamiento animado a la unidad seleccionada, ademas de la etiqueta
      // (el popup ya se abre solo por bindPopup) -- pedido de Lguerra,
      // 17/09/2026, para que se sienta interactivo en vez de solo mostrar el
      // cartel en el mismo zoom en que estaba el mapa. Solo unos pocos
      // niveles desde el zoom actual, no un salto fijo (se sentia brusco).
      marker.on("click", () => {
        const targetZoom = Math.min(map.getZoom() + CLICK_ZOOM_STEP, CLICK_ZOOM_MAX);
        map.flyTo(marker.getLatLng(), Math.max(targetZoom, map.getZoom()), { duration: 0.8 });
      });

      // Crecimiento leve al pasar el cursor (sin necesidad de hacer clic) --
      // la transicion suave de "r" viene de la clase .tracker-marker en
      // index.css.
      marker.on("mouseover", () => marker.setRadius(MARKER_RADIUS_HOVER));
      marker.on("mouseout", () => marker.setRadius(MARKER_RADIUS));

      marker.addTo(map);
      markersRef.current.push(marker);
    }

    if (withCoords.length > 0) {
      const bounds = L.latLngBounds(withCoords.map((s) => [Number(s.latitude), Number(s.longitude)]));
      boundsRef.current = bounds;
      map.invalidateSize();
      // Solo se ajusta la vista a toda la flota la primera vez que llegan
      // datos -- el refresco automático cada 30s (ver trackerMap.jsx,
      // AUTO_REFRESH_MS) volvía a alejar el mapa y deshacía el acercamiento
      // apenas alguien le daba clic a una unidad para verla de cerca.
      if (!hasFitBoundsRef.current) {
        map.fitBounds(bounds.pad(0.2));
        hasFitBoundsRef.current = true;
      }
    }
  }, [snapshots]);

  return <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" />;
}
