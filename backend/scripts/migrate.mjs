// Ejecutor de migraciones (08/10/2026, despliegue en Azure).
//
// Antes cada migración de db/migrations se corría a mano y nada registraba
// cuáles ya estaban aplicadas en cada base. Este script lleva ese registro en
// la tabla schema_migrations y aplica SOLO las que faltan, en orden de nombre
// (001_..., 002_..., ...), cada una dentro de su propia transacción: si una
// falla, se revierte, se detiene y no se marca.
//
// Uso (desde backend/, con las variables DB_* del entorno o del .env):
//   node scripts/migrate.mjs --status     muestra aplicadas y pendientes
//   node scripts/migrate.mjs              aplica las pendientes
//   node scripts/migrate.mjs --baseline   marca TODAS las existentes como
//                                         aplicadas SIN correrlas (para una base
//                                         restaurada con pg_dump de una que ya
//                                         las tenía; se usa una sola vez)
//   node scripts/migrate.mjs --dir <ruta> carpeta de migraciones distinta
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { dbConfig } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dirArg = args.indexOf('--dir');
const MIGRATIONS_DIR = dirArg >= 0
  ? path.resolve(args[dirArg + 1])
  : path.resolve(process.env.MIGRATIONS_DIR || path.join(__dirname, '../../db/migrations'));
const mode = args.includes('--status') ? 'status' : args.includes('--baseline') ? 'baseline' : 'apply';

const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

const client = new pg.Client({ ...dbConfig, application_name: 'fullpetro-migrate' });
await client.connect();

// Dos procesos migrando a la vez (dos instancias arrancando juntas) no deben
// pisarse: el segundo espera a que el primero termine.
await client.query('SELECT pg_advisory_lock(727002)');
try {
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    baseline BOOLEAN NOT NULL DEFAULT false
  )`);
  const { rows } = await client.query('SELECT filename FROM public.schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));
  const pending = files.filter((f) => !applied.has(f));

  if (mode === 'status') {
    console.log(`Carpeta: ${MIGRATIONS_DIR}`);
    console.log(`Aplicadas: ${files.length - pending.length} de ${files.length}`);
    if (pending.length) console.log(`Pendientes:\n  ${pending.join('\n  ')}`);
    else console.log('No hay pendientes.');
  } else if (mode === 'baseline') {
    for (const f of pending) {
      await client.query('INSERT INTO public.schema_migrations (filename, baseline) VALUES ($1, true)', [f]);
    }
    console.log(`Línea base: ${pending.length} migración(es) marcadas como aplicadas sin ejecutarlas.`);
  } else {
    if (!pending.length) console.log('La base ya está al día.');
    for (const f of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
      process.stdout.write(`Aplicando ${f} ... `);
      try {
        // Algunas migraciones traen su propio BEGIN/COMMIT: se corren tal
        // cual (un BEGIN anidado solo da un aviso) y el registro va después.
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO public.schema_migrations (filename) VALUES ($1)', [f]);
        await client.query('COMMIT');
        console.log('OK');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.log('ERROR');
        console.error(`\nFalló ${f}: ${err.message}\nNo se aplicó nada de esa migración; las siguientes tampoco. Corrígela y vuelve a correr el script.`);
        process.exitCode = 1;
        break;
      }
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(727002)').catch(() => {});
  await client.end();
}
