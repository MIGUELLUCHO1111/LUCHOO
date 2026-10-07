import { useState } from "react";
import { motion } from "framer-motion";
import { FileDown, Loader2 } from "lucide-react";
import { fleetService } from "@/services";

// Boton "Descargar ficha (PDF)" (07/10/2026): kind = "unidad" | "conductor".
// El PDF lo arma el backend (GET /fleet/units|drivers/:id/sheet.pdf).
const FichaPdfButton = ({ kind, id, className = "" }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const descargar = async () => {
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await fleetService.descargarFichaPdf(kind, id);
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
      setError(msg || "No se pudo generar la ficha");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-stretch">
      <motion.button type="button" onClick={descargar} disabled={busy} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} title="Descargar la ficha en PDF para imprimir o enviar"
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 h-10 text-sm font-bold shadow disabled:opacity-70 ${className || "bg-white text-brand-navy border border-slate-200 dark:bg-white/10 dark:text-white dark:border-white/10 hover:border-brand-navy/40"}`}>
        <span className="inline-flex">{busy ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}</span>
        {busy ? "Generando PDF…" : "Descargar ficha (PDF)"}
      </motion.button>
      {error && <span className="mt-1 text-[11px] font-bold text-red-600">{error}</span>}
    </div>
  );
};

export default FichaPdfButton;
