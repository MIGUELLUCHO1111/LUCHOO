// Configuración de PM2 para producción.
// Uso: pm2 start ecosystem.config.cjs --env production
//
// instances: empezar en 8 (no 'max'/28 -- Postgres y el sistema operativo
// también necesitan CPU, ver DEPLOYMENT.md sección "Dimensionamiento").
// exec_mode 'cluster': balancea peticiones HTTP entre procesos. Los cron
// (Tracker, Mantenimiento, Flota) corren en UN solo proceso: lo decide un
// advisory lock de PostgreSQL (backend/src/scheduler/leader.js), que sirve
// igual con un PM2 que con varias instancias en Azure.
module.exports = {
  apps: [
    {
      name: 'fullpetro-backend',
      cwd: __dirname + '/backend',
      script: 'main.js',
      instances: 8,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '500M',
      out_file: '/var/log/fullpetro/backend-out.log',
      error_file: '/var/log/fullpetro/backend-error.log',
      time: true,
    },
  ],
};
