// PM2 dentro del contenedor de Azure (lo usa docker-entrypoint.sh).
//
// WEB_CONCURRENCY procesos por instancia (por defecto 2 = un plan de 2 vCPU).
// Ojo con las conexiones a la base: cada proceso abre hasta DB_POOL_MAX, así
// que el total es DB_POOL_MAX x WEB_CONCURRENCY x instancias, y tiene que
// quedar por debajo del max_connections del servidor PostgreSQL de Azure
// (ver DEPLOY_AZURE.md, "Conexiones a la base").
//
// Los logs van a la salida estándar: Azure los recoge (Log stream / Log
// Analytics), no hace falta escribir archivos dentro del contenedor.
module.exports = {
  apps: [
    {
      name: 'fullpetro-backend',
      cwd: '/app/backend',
      script: 'main.js',
      instances: Number.parseInt(process.env.WEB_CONCURRENCY, 10) || 2,
      exec_mode: 'cluster',
      max_memory_restart: process.env.MAX_MEMORY_RESTART || '700M',
      kill_timeout: 12000,
      time: true,
    },
  ],
};
