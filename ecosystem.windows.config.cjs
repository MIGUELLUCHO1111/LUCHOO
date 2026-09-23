// Configuración de PM2 para la laptop Windows de la oficina (no para el
// servidor de producción -- ese usa ecosystem.config.cjs). Pedido de Lguerra,
// 23/09/2026: que el sistema arranque solo al iniciar sesión en Windows y se
// levante solo si se cae, sin ventanas negras que se puedan cerrar por error.
//
// Uso (una vez):   pm2 start ecosystem.windows.config.cjs && pm2 save
// Al iniciar sesión lo arranca "Fullpetro (inicio automatico).vbs" desde la
// carpeta de Inicio de Windows (ver scripts/windows/).
//
// Un solo proceso del backend (fork): en esta laptop no hace falta el modo
// clúster, y así los cron del Tracker corren una sola vez igual.
module.exports = {
  apps: [
    {
      name: 'fullpetro-backend',
      cwd: __dirname + '/backend',
      script: 'main.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: '500M',
      time: true,
    },
    {
      name: 'fullpetro-frontend',
      cwd: __dirname + '/frontend',
      // vite directo con node (no "pnpm run dev"): en Windows PM2 no puede
      // lanzar bien los .cmd de pnpm.
      script: 'node_modules/vite/bin/vite.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      restart_delay: 5000,
      time: true,
    },
  ],
};
