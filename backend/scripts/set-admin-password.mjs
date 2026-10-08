// Cambia la contraseña de un usuario directo en la base (08/10/2026).
// Pensado para el administrador en producción: la primera instalación, si no
// se definió INITIAL_ADMIN_PASSWORD, o si se olvidó la contraseña.
//
// Uso (desde backend/, con las variables DB_* del entorno o del .env):
//   NEW_PASSWORD='una-contraseña-larga' node scripts/set-admin-password.mjs
//   NEW_PASSWORD='...' ADMIN_USER=otro_usuario node scripts/set-admin-password.mjs
//
// La contraseña va por variable de entorno (no como argumento) para que no
// quede en el historial de comandos ni en la lista de procesos.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { dbConfig } from '../config/db.js';

const username = process.env.ADMIN_USER || 'admin01';
const password = process.env.NEW_PASSWORD;

if (!password || password.length < 10) {
  console.error('Define NEW_PASSWORD con al menos 10 caracteres. Ej.: NEW_PASSWORD=\'...\' node scripts/set-admin-password.mjs');
  process.exit(1);
}

const client = new pg.Client({ ...dbConfig, application_name: 'fullpetro-set-password' });
await client.connect();
try {
  const hash = await bcrypt.hash(password, 10);
  const r = await client.query(
    'UPDATE public."user" SET password_hash = $1, is_active = true WHERE name = $2 AND deleted_at IS NULL RETURNING id',
    [hash, username],
  );
  if (!r.rowCount) {
    console.error(`No existe un usuario activo llamado "${username}".`);
    process.exitCode = 1;
  } else {
    console.log(`Contraseña de "${username}" actualizada. Ya puedes iniciar sesión con ella.`);
  }
} finally {
  await client.end();
}
