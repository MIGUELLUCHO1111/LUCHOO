// Configuración de PM2 para producción.
// Uso: pm2 start ecosystem.config.cjs --env production
//
// instances: empezar en 8 (no 'max'/28 -- Postgres y el sistema operativo
// también necesitan CPU, ver DEPLOYMENT.md sección "Dimensionamiento").
// exec_mode 'cluster': balancea peticiones HTTP entre procesos. Los cron del
// Tracker GPS (sync/alertas/archivado/notificaciones) son seguros en este
// modo -- backend/src/tracker/scheduler.js ya detecta NODE_APP_INSTANCE y
// solo el proceso 0 los programa, así no se duplican.
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
