// Detección de estructura jerárquica de menús (forma constante)
export default function _isMenusStructureShape(data) {
  if (!data || typeof data !== 'object') return false;
  // Si cualquier valor posee 'options' o 'submenus' en su rama inmediata asumimos forma constante
  const topKeys = Object.keys(data);
  for (const k of topKeys) {
    const v = data[k];
    if (v && typeof v === 'object') {
      if (v.options || v.submenus) return true;
      // inspección un nivel más profundo
      for (const inner of Object.values(v)) {
        if (
          inner &&
          typeof inner === 'object' &&
          (inner.options || inner.submenus)
        )
          return true;
      }
    }
  }
  return false;
}
