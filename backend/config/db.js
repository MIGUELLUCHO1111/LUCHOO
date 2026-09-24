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
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  max: 6,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

const pool = new Pool(dbConfig);

pool.on('connect', () => {
  console.log(getMessage(config.LANGUAGE, 'db_connected_success'));
});

pool.on('error', (err) => {
  console.error(getMessage(config.LANGUAGE, 'db_connected_error'), err);
});

export default pool;
