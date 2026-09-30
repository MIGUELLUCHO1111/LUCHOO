// PLANTILLA -- copiar tal cual a backend/_build_modelo_interno.mjs, sin
// modificar nada (lee ./_reporte_data.json, que deja fetch_reporte.template
// ya ejecutado). Ver CLAUDE.md -> "El reporte modelo interno".
//
// El formato vive en backend/src/tracker/modeloInterno.js (el mismo que usa
// la descarga de la app en Reportes de Turno), asi el chat y la app sacan
// exactamente el mismo Excel.
import fs from 'fs';
import { buildModeloInternoWorkbook, modeloInternoFileName } from './src/tracker/modeloInterno.js';

const r = JSON.parse(fs.readFileSync('./_reporte_data.json', 'utf8'));
const wb = buildModeloInternoWorkbook(r);
const outPath = `./${modeloInternoFileName(r, 'xlsx')}`;

await wb.xlsx.writeFile(outPath);
console.log('WRITTEN:', outPath);
