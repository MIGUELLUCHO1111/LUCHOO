import pg from 'pg';
const { Pool, types } = pg;
import dotenv from 'dotenv';
import Config from './config.js';
const config = new Config();
const getMessage = config.getMessage.bind(config);

dotenv.config();

// BIGINT (OID 20) llega como string por defecto (para no perder precisión más
// allá de Number.MAX_SAFE_INTEGER). Los ids de este proyecto están muy por
// debajo de ese límite, así que los devolvemos como number: si no, el
// validador Zod (z.number()) rechaza cualquier id que venga de una columna
// BIGINT en cuanto se reenvía tal cual desde el frontend.
types.setTypeParser(20, (val) => parseInt(val, 10));

// max: 10 (default de pg) x 8 procesos de PM2 cluster = 80 conexiones, contra
// el max_connections=100 por defecto de Postgres -- margen muy justo si algo
// más (pg_dump del backup diario, una sesión psql manual) se conecta al
// mismo tiempo. Se baja a 6 por proceso (48 en total) para dejar margen real,
// más timeouts explícitos: sin idleTimeoutMillis una conexión colgada no se
// libera nunca, y sin connectionTimeoutMillis una petición se queda esperando
// indefinidamente si el pool está agotado en vez de fallar rápido.
//
// Azure (08/10/2026): con varias instancias, el total de conexiones es
// DB_POOL_MAX x procesos por instancia x instancias, y tiene que quedar por
// debajo del max_connections del servidor de Azure (ver DEPLOY_AZURE.md,
// "Conexiones a la base"). Por eso el tamaño ahora es configurable.
// DB_SSL=true es obligatorio en Azure Database for PostgreSQL (rechaza
// conexiones sin cifrar); el certificado de Azure lo firma una CA pública
// que Node ya trae, así que se valida normalmente (rejectUnauthorized).
// DB_STATEMENT_TIMEOUT_MS corta una consulta que se quede colgada en vez de
// retener una conexión del pool indefinidamente (0 = sin límite, como antes).
const intEnv = (name, fallback) => {
  const n = Number.parseInt(process.env[name], 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  max: intEnv('DB_POOL_MAX', 6),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: intEnv('DB_CONNECTION_TIMEOUT_MS', 5000),
  statement_timeout: intEnv('DB_STATEMENT_TIMEOUT_MS', 0) || undefined,
  application_name: process.env.DB_APPLICATION_NAME || 'fullpetro-backend',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
};

const pool = new Pool(dbConfig);

// Antes se imprimía en CADA conexión nueva del pool (decenas de líneas
// iguales en el log); ahora solo la primera de cada proceso.
let loggedFirstConnection = false;
pool.on('connect', () => {
  if (loggedFirstConnection) return;
  loggedFirstConnection = true;
  console.log(getMessage(config.LANGUAGE, 'db_connected_success'));
});

pool.on('error', (err) => {
  console.error(getMessage(config.LANGUAGE, 'db_connected_error'), err);
});

export { dbConfig };
export default pool;
