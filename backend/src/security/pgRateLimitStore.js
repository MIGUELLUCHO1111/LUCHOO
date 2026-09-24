import pool from '../../config/db.js';

// Store de express-rate-limit respaldado por Postgres, para que el conteo de
// intentos sea el mismo sin importar qué proceso de PM2 (modo cluster)
// atienda la petición. El MemoryStore por defecto es por-proceso: bajo
// cluster el límite real termina siendo N veces más débil de lo configurado.
//
// La fila se actualiza de forma atómica en una sola sentencia (INSERT ...
// ON CONFLICT), así que dos procesos incrementando la misma key al mismo
// tiempo no pisan el conteo del otro.
export default class PgRateLimitStore {
  windowMs;

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const resetTime = new Date(Date.now() + this.windowMs);
    const { rows } = await pool.query(
      `INSERT INTO rate_limit (key, count, reset_time)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limit.reset_time <= now() THEN 1 ELSE rate_limit.count + 1 END,
         reset_time = CASE WHEN rate_limit.reset_time <= now() THEN EXCLUDED.reset_time ELSE rate_limit.reset_time END
       RETURNING count, reset_time`,
      [key, resetTime],
    );
    const row = rows[0];
    return { totalHits: row.count, resetTime: row.reset_time };
  }

  async decrement(key) {
    await pool.query('UPDATE rate_limit SET count = GREATEST(count - 1, 0) WHERE key = $1', [key]);
  }

  async resetKey(key) {
    await pool.query('DELETE FROM rate_limit WHERE key = $1', [key]);
  }
}
