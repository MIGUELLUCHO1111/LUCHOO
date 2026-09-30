import { useState } from "react";
import { FileSpreadsheet, FileText, Download } from "lucide-react";
import { trackerService } from "@/services";
import { Button } from "@/components/ui/button";
import { TURNOS } from "@/lib/trackerFormat";

// Turno que corresponde por la hora de Venezuela: el ultimo corte ya ocurrido.
const turnoPorHora = () => {
  const h = parseInt(new Date().toLocaleString("en-US", { timeZone: "America/Caracas", hour: "2-digit", hour12: false }), 10) % 24;
  if (h >= 21 || h < 9) return "NOCTURNO";
  if (h >= 14) return "VESPERTINO";
  return "MATUTINO";
};

/**
 * Descarga provisional del reporte de turno con el formato del "modelo
 * interno" (el mismo Excel que se genera en el chat), en Excel o PDF.
 * Pedido de Lguerra, 30/09/2026.
 */
const ModeloInternoDownload = () => {
  const [turno, setTurno] = useState(turnoPorHora());
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const descargar = async (formato) => {
    setBusy(formato);
    setError(null);
    try {
      const { blob, filename } = await trackerService.descargarModeloInterno(turno, formato);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      let msg = e.message;
      // Los errores vienen como blob porque se pidio responseType "blob".
      try { msg = JSON.parse(await e.response?.data?.text())?.message || msg; } catch { /* sin detalle */ }
      setError(msg || "No se pudo descargar el reporte");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-8 rounded-3xl border-2 border-dashed border-brand-navy/20 dark:border-white/10 bg-white/60 dark:bg-[#0f1115]/60 p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <span className="inline-flex"><Download size={16} className="text-brand-navy dark:text-sky-300" /></span>
            Descargar reporte de turno como el modelo interno
            <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase">Provisional</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">El mismo formato del Excel manual (leyenda de colores, tabla con bordes), con los datos del GPS en el momento de la descarga.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={turno} onChange={(e) => setTurno(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1115] text-sm font-bold">
            {Object.entries(TURNOS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
          <Button onClick={() => descargar("xlsx")} disabled={!!busy} className="rounded-xl font-bold gap-2 h-10 bg-emerald-700 hover:bg-emerald-800 text-white">
            <FileSpreadsheet size={16} /> {busy === "xlsx" ? "Generando…" : "Descargar Excel"}
          </Button>
          <Button onClick={() => descargar("pdf")} disabled={!!busy} className="rounded-xl font-bold gap-2 h-10 bg-red-700 hover:bg-red-800 text-white">
            <FileText size={16} /> {busy === "pdf" ? "Generando…" : "Descargar PDF"}
          </Button>
        </div>
      </div>
      {busy && <p className="text-xs text-slate-400 mt-3">Consultando el GPS y armando el reporte… puede tardar unos segundos.</p>}
      {error && <p className="text-xs font-bold text-red-600 mt-3">{error}</p>}
    </div>
  );
};

export default ModeloInternoDownload;
