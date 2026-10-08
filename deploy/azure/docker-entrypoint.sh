#!/bin/sh
# Arranque del contenedor de Fullpetro en Azure.
set -e

# 1) La carpeta de archivos subidos tiene que existir y poder escribirse (en
#    Azure es un recurso compartido de Azure Files montado en UPLOADS_DIR). Si
#    no, se avisa claro en el log en vez de fallar recién cuando alguien sube
#    una foto.
mkdir -p "$UPLOADS_DIR" 2>/dev/null || true
if ! ( touch "$UPLOADS_DIR/.write-test" && rm -f "$UPLOADS_DIR/.write-test" ) 2>/dev/null; then
  echo "[entrypoint] ATENCION: no se puede escribir en UPLOADS_DIR=$UPLOADS_DIR -- las fotos y documentos NO se van a guardar. Revisa el montaje de Azure Files (ver DEPLOY_AZURE.md)."
fi

# 2) Migraciones pendientes (opcional). Varias instancias arrancando juntas no
#    se pisan: el script toma un lock en la base y las demás esperan.
if [ "$RUN_MIGRATIONS_ON_START" = "true" ]; then
  echo "[entrypoint] Aplicando migraciones pendientes..."
  node /app/backend/scripts/migrate.mjs
fi

# 3) Backend con PM2 (WEB_CONCURRENCY procesos). Las tareas programadas corren
#    en uno solo entre todas las instancias (advisory lock, ver
#    backend/src/scheduler/leader.js).
exec pm2-runtime /app/ecosystem.azure.config.cjs
