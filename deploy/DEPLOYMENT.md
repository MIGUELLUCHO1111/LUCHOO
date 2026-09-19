# Guía de despliegue — Fullpetro (servidor 24/7)

Esta guía asume un servidor Ubuntu 22.04+ (VPS o físico) al que tienes acceso
por SSH como usuario con permisos `sudo`. No importa el proveedor (DigitalOcean,
Hetzner, Linode, AWS Lightsail, o el servidor físico R730xd de la empresa) —
los pasos son los mismos.

Todo lo marcado con `TODO:` hay que reemplazarlo con tus valores reales antes
de ejecutar.

---

## 0. Requisitos mínimos

- Ubuntu 22.04 LTS o más nuevo
- 2 vCPU / 2 GB RAM como mínimo (con el volumen actual de la flota sobra por
  mucho; el servidor físico de la empresa tiene 28 núcleos / 128 GB, ver
  sección de dimensionamiento más abajo)
- Un dominio propio con acceso para crear registros DNS (para HTTPS con
  Let's Encrypt). Sin dominio también funciona por IP + HTTP, pero sin
  candado verde.

---

## 1. Preparar el servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### Node.js 24

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # debe mostrar v24.x
```

### pnpm y PM2

```bash
sudo npm install -g pnpm pm2
```

### PostgreSQL 17

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

### NGINX + Certbot (HTTPS)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 2. Clonar el proyecto

```bash
sudo mkdir -p /var/www/fullpetro
sudo chown $USER:$USER /var/www/fullpetro
git clone https://github.com/juliomoran10/API-Fullpetro.git /var/www/fullpetro
cd /var/www/fullpetro
git checkout main   # o la rama que corresponda a producción
```

---

## 3. Base de datos

```bash
sudo -u postgres psql -c "CREATE DATABASE fullpetro;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'TODO: contraseña segura';"
```

Aplicar el esquema y todas las migraciones **en orden**:

```bash
cd /var/www/fullpetro/db
PGPASSWORD='TODO: la misma de arriba' psql -U postgres -h localhost -d fullpetro -f schema.sql
PGPASSWORD='TODO: la misma de arriba' psql -U postgres -h localhost -d fullpetro -f seed.sql
for f in migrations/*.sql; do
  PGPASSWORD='TODO: la misma de arriba' psql -U postgres -h localhost -d fullpetro -f "$f"
done
```

> El usuario `admin01` (creado por `seed.sql`) queda disponible con la
> contraseña que se generó al rotar la anterior (que estaba expuesta en texto
> plano en este archivo y en `seed.sql` — ver el comentario ahí). Esa
> contraseña se entregó fuera del repo; **cámbiala** desde la app en tu
> primer login antes de dar acceso real, o bórralo y crea un usuario real
> desde Seguridad → Usuarios.

---

## 4. Variables de entorno del backend

```bash
cd /var/www/fullpetro/backend
cp .env.example .env
nano .env
```

Checklist completo de lo que hay que llenar (todo lo que construimos hasta
ahora depende de esto):

| Variable | Qué poner |
|---|---|
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | la contraseña que pusiste en el paso 3 |
| `DB_NAME` | `fullpetro` |
| `SECRET` | cadena aleatoria larga (`openssl rand -base64 48`) |
| `JWT_SECRET` | otra cadena aleatoria distinta (`openssl rand -base64 48`) — **obligatoria**, el backend no arranca sin ella |
| `PORT` | `3000` |
| `COOKIE_SECURE` | `true` (ya hay HTTPS por NGINX/certbot) |
| `FRONTEND_URL` | `https://app.tudominio.com` (ver sección de NGINX) |
| `FORESIGHT_API_URL`, `FORESIGHT_BASIC_USER`, `FORESIGHT_BASIC_PASSWORD`, `FORESIGHT_CONNCODE`, `FORESIGHT_WSUSER`, `FORESIGHT_WSPASSWORD` | los mismos valores que ya tienes en tu `.env` local (spec de ForesightFlexAPIv3) |
| `TRACKER_AUTO_SYNC` | `true` |
| `TRACKER_SYNC_CRON` | `*/10 * * * *` (cada 10 min; ajustar si el proveedor lo requiere) |
| `TRACKER_STALE_HOURS` | `24` |
| `TRACKER_CURFEW_HOUR` | `20` (8:00 p.m., ajustable) |
| `TRACKER_RETENTION_MONTHS` | `6` |
| `TRACKER_ARCHIVE_CRON` | `0 3 * * *` |
| `TRACKER_API_CALL_DELAY_MS` | `1200` (ver nota de límite de peticiones más abajo) |
| `TELEGRAM_BOT_TOKEN` | el mismo que ya tienes configurado |
| `TELEGRAM_CHAT_ID` | opcional (puede quedar vacío) -- quien le escriba `/start` al bot queda suscrito solo, no hace falta llenarlo a mano |
| `TRACKER_NOTIFY_MATUTINO_CRON` / `_VESPERTINO_CRON` / `_NOCTURNO_CRON` | opcional, por defecto `5 10 * * *` / `5 15 * * *` / `5 22 * * *` |
| `TRACKER_NOTIFY_ANEXO_CRON` | opcional, por defecto `15 22 * * *` |

> **Nota sobre el límite de peticiones de la API de Foresight**: se comprobó
> en la práctica que el proveedor corta el acceso si se le pega muy rápido
> (ver conversación del 07/09/2026). `TRACKER_API_CALL_DELAY_MS` ya está
> puesto en un valor conservador; si "Generar análisis del día" sigue
> devolviendo errores de límite, subir este valor (ej. `2000`) antes que
> nada más.

```bash
pnpm install --prod
```

---

## 5. Build del frontend

```bash
cd /var/www/fullpetro/frontend
echo "VITE_API_URL=https://api.tudominio.com" > .env.production
pnpm install
pnpm build
```

Esto genera `frontend/dist/` — es lo que NGINX va a servir como archivos
estáticos (paso 7).

---

## 6. Arrancar el backend con PM2

Desde la raíz del repo (`/var/www/fullpetro`):

```bash
sudo mkdir -p /var/log/fullpetro
sudo chown $USER:$USER /var/log/fullpetro
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup   # imprime un comando "sudo env PATH=... pm2 startup ..." -- copialo y ejecútalo
```

`pm2 startup` + `pm2 save` es lo que hace que todo vuelva a arrancar solo si
el servidor se reinicia (luz, mantenimiento, etc.) — sin esto, un reinicio
apaga todo hasta que alguien entre a arrancarlo a mano.

Verificar que arrancó bien:

```bash
pm2 status
pm2 logs fullpetro-backend --lines 50
```

Deberías ver las mismas líneas que en desarrollo:
`[Tracker] Sincronización automática programada...`, etc. — pero **solo una
vez**, no 8 veces (eso confirma que el chequeo de `NODE_APP_INSTANCE` en
`scheduler.js` está funcionando).

---

## 7. NGINX

```bash
sudo cp /var/www/fullpetro/deploy/nginx-fullpetro.conf /etc/nginx/sites-available/fullpetro
sudo nano /etc/nginx/sites-available/fullpetro   # reemplazar "tudominio.com"
sudo ln -s /etc/nginx/sites-available/fullpetro /etc/nginx/sites-enabled/
sudo nginx -t   # debe decir "syntax is ok" / "test is successful"
sudo systemctl reload nginx
```

Antes de esto, crea en tu proveedor de dominio dos registros DNS tipo A
apuntando a la IP del servidor:

```
app.tudominio.com   ->  IP_DEL_SERVIDOR
api.tudominio.com   ->  IP_DEL_SERVIDOR
```

### HTTPS (Let's Encrypt, gratis)

```bash
sudo certbot --nginx -d app.tudominio.com -d api.tudominio.com
```

Certbot edita el archivo de NGINX automáticamente (agrega `listen 443 ssl`
y el redirect de 80 a 443) y renueva solo cada ~60 días.

---

## 8. Firewall

```bash
sudo ufw allow 22/tcp    # SSH -- restringir a tu IP si es posible
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

PostgreSQL (5432) y el backend (3000) **no** deben abrirse al exterior — solo
se acceden por `localhost`, que ya funciona sin tocar el firewall.

---

## 9. Verificación final

1. Entra a `https://app.tudominio.com` — debe cargar el login.
2. Inicia sesión y entra a Tracker GPS → Estado y Alertas → "Sincronizar
   ahora" — confirma que trae datos reales.
3. Espera a la siguiente marca de 10 minutos y revisa `pm2 logs
   fullpetro-backend` — debe aparecer la sincronización automática sola.
4. Revisa que llegó el mensaje de prueba a Telegram si generaste un reporte
   o notificación a mano.

---

## 10. Mantenimiento

**Actualizar el código** (después de hacer cambios y subirlos a GitHub):

```bash
cd /var/www/fullpetro
git pull
cd backend && pnpm install --prod
cd ../frontend && pnpm install && pnpm build
pm2 reload fullpetro-backend
```

**Ver logs en vivo:**

```bash
pm2 logs fullpetro-backend
```

**Backup de la base de datos** (ejecutar como cron diario, ej. `0 4 * * *`):

```bash
PGPASSWORD='...' pg_dump -U postgres -h localhost fullpetro | gzip > /var/backups/fullpetro-$(date +%Y%m%d).sql.gz
```

Conservar backups fuera del mismo servidor (ej. subirlos a un bucket S3/B2,
o copiarlos a otra máquina) — un backup que vive en el mismo disco no
protege contra una falla de disco.

---

## Dimensionamiento (servidor físico R730xd de la empresa)

Si esto se despliega en el servidor físico de la empresa (28 núcleos, 128 GB
RAM, discos HDD SAS 10K) en vez de un VPS:

- `ecosystem.config.cjs` ya usa `instances: 8` — no subir a 28; Postgres y
  el sistema también necesitan CPU. Se puede subir gradualmente si hace
  falta, midiendo antes.
- Ajustar `postgresql.conf`: `shared_buffers` a ~25-30% de la RAM (32 GB es
  razonable de partida), y revisar `max_connections` (debe ser mayor a
  `8 procesos × pool.max` con margen — ver `backend/config/db.js`).
- El cuello de botella real serán los discos HDD, no CPU/RAM — vigilar si
  se agregan reportes pesados sobre telemetría histórica.
