// PLANTILLA -- copiar a backend/_fetch_reporte.mjs y reemplazar __TURNO__
// por MATUTINO, VESPERTINO o NOCTURNO antes de ejecutar. Ver
// CLAUDE.md -> "El reporte modelo interno" para el flujo completo.
import Reporte from './src/bo/sub_system/classes/reporte.js';
import fs from 'fs';

const r = new Reporte();
const res = await r.generarReporte({ turno: '__TURNO__', enVivo: true });
fs.writeFileSync('./_reporte_data.json', JSON.stringify(res.data));
console.log('OK');
process.exit(0);
