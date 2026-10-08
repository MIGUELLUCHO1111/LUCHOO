import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carpeta base de TODOS los archivos subidos (fotos de combustible y flota,
// documentos, adjuntos y reportes del Tracker, evidencias de Mantenimiento).
// Por defecto backend/uploads, como siempre en desarrollo. En Azure apunta a
// un recurso compartido de Azure Files montado en el contenedor (ej.
// UPLOADS_DIR=/data/uploads): así los archivos sobreviven a cada redeploy y
// TODAS las instancias ven los mismos -- si quedaran dentro del contenedor,
// una foto subida a la instancia A daría 404 al pedirla a la instancia B.
export const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, '../uploads');

export const uploadsPath = (...parts) => path.join(UPLOADS_ROOT, ...parts);
