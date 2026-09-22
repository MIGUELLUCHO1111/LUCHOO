# Cómo montar una copia completa e independiente en otra computadora

Esta guía es para cuando de verdad se necesita que el Tracker GPS de Flota
funcione **solo, sin depender de esta máquina** — backend, base de datos y
todo — en otra computadora. Es un trabajo de instalación real, no algo que
Claude pueda hacer a distancia (Claude Code solo puede ejecutar comandos en
la máquina donde corre esa sesión).

**Antes de seguir**: si lo que hace falta es solo *consultar* reportes/alertas
desde otro lugar de vez en cuando, Control Remoto de Claude Code a la sesión
que ya corre aquí es mucho más rápido y no requiere nada de esto.

## Qué necesita esa computadora

- **Node.js** (misma versión que aquí, v24 o compatible) — https://nodejs.org
- **PostgreSQL** instalado y corriendo
- **Git**
- **PM2**: `npm install -g pm2`

## Paso 1 — Traer el código
```bash
git clone https://github.com/juliomoran10/API-Fullpetro.git
cd API-Fullpetro
git checkout Luis
```

## Paso 2 — Crear la base de datos
Con PostgreSQL corriendo ahí, crear una base de datos vacía y cargar el
esquema (está en el repo, en `db/`):
```bash
createdb fullpetro   # o el nombre que se use en DB_NAME
psql -d fullpetro -f db/schema.sql
# aplicar las migraciones, en orden, desde db/migrations/
for f in db/migrations/*.sql; do psql -d fullpetro -f "$f"; done
```
Esto deja la ESTRUCTURA de las tablas — no trae el historial real de
alertas/lecturas de esta máquina (esas quedarían vacías hasta que la nueva
copia empiece a sincronizar sola con la API del GPS).

## Paso 3 — El archivo `.env` (la parte sensible — NUNCA por chat ni GitHub)

`backend/.env` no está en git (por seguridad) — hay que copiarlo **a mano,
directo entre las dos computadoras** (USB, cable, o algún método propio),
nunca pegándolo en un chat ni subiéndolo a ningún lado. Contiene, entre
otras cosas: la contraseña de la base de datos, las credenciales de la API
del proveedor GPS, y el token del bot de Telegram — si alguna de estas
llega a manos equivocadas, cualquiera podría mandar mensajes como si fuera
el bot oficial o leer datos de la flota.

Variables que trae ese archivo (los valores reales solo los tiene el
usuario, aquí solo se listan los nombres):
```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
JWT_SECRET, SECRET, COOKIE_SECURE
FORESIGHT_BASIC_USER, FORESIGHT_BASIC_PASSWORD, FORESIGHT_CONNCODE
FORESIGHT_PLATFORM_API_URL, FORESIGHT_USERID, FORESIGHT_COMPANYID
FORESIGHT_REPORT_ID_COMPORTAMIENTO
TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
TRACKER_SYNC_CRON, TRACKER_ARCHIVE_CRON, TRACKER_CURFEW_HOUR,
TRACKER_STALE_HOURS, TRACKER_RETENTION_MONTHS,
TRACKER_AUTO_SYNC, TRACKER_AUTO_REPORTS, TRACKER_AUTO_REPORTES_TURNO
PORT
```
En esa nueva computadora, cambiar `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/
`DB_PASSWORD` para que apunten a SU PROPIO PostgreSQL local — el resto
(credenciales de Foresight y Telegram) se copian igual, porque son la MISMA
cuenta/flota real.

**Dos backends con el mismo `TELEGRAM_BOT_TOKEN` corriendo sus propios
sync a la vez van a duplicar las alertas y los reportes que llegan al
chat.** Si se monta esta copia independiente, hay que decidir cuál de las
dos queda con la sincronización automática prendida (`TRACKER_AUTO_SYNC`)
y dejar la otra apagada, o coordinar para que no compitan.

## Paso 4 — Instalar dependencias
```bash
cd backend && npm install
cd ../frontend && npm install
```

## Paso 5 — Arrancar con PM2 (igual que aquí)
```bash
cd backend && pm2 start main.js --name fullpetro-backend
cd ../frontend && pm2 start npm --name fullpetro-frontend -- run dev
pm2 save
```

## Paso 6 — Verificar
- Abrir `http://localhost:5173` (o el puerto que use el frontend ahí) e
  iniciar sesión.
- Revisar los logs: `pm2 logs fullpetro-backend` — debería sincronizar la
  flota sin errores.

## Nota sobre `CLAUDE.md`
Ese archivo sí viaja solo con `git pull` (está en el repo) y le da a
cualquier sesión de Claude Code el conocimiento de cómo funciona todo esto
— pero el conocimiento no reemplaza tener el backend y la base de datos de
verdad corriendo. Esta guía es el paso que falta para que ese conocimiento
tenga algo real que ejecutar.
