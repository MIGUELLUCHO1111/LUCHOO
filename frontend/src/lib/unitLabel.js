// Etiqueta de una unidad de fleet_unit para listas y desplegables. Desde la
// unificación (migraciones 039/040) la mayoría de las unidades no tienen
// `name` -- armar `${code} - ${name}` a secas mostraba "FP-VEH.02-08 - null".
// Usa el nombre si hay, si no la placa, y si no ninguna, solo el código.
export function unitLabel(unit) {
  if (!unit) return "";
  const extra = (unit.name || "").trim() || (unit.plate || "").trim();
  return extra ? `${unit.code} - ${extra}` : unit.code;
}
