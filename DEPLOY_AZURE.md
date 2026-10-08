# Despliegue en Azure — Fullpetro

**Fecha:** 08/10/2026 · Reemplaza al plan de servidor físico de `deploy/DEPLOYMENT.md`.

Todo se hace desde el **portal de Azure** y **Azure Cloud Shell** (la terminal que se abre con el ícono `>_` arriba a la derecha del portal; ya trae `az`, `git` y `psql`). No hace falta instalar Docker ni nada en las computadoras de la oficina.

---

## 1. Arquitectura

```
                 https://app.fullpetro.com   (o https://<app>.azurewebsites.net)
                              │
                 ┌────────────▼─────────────┐
                 │  Azure App Service        │  Linux, contenedor, 1..N instancias
                 │  (imagen "fullpetro")     │  cada instancia: PM2 con 2 procesos
                 │   /        → app (React)  │
                 │   /api/... → backend      │
                 │   /health  → salud        │
                 └──────┬─────────────┬──────┘
                        │             │
     ┌──────────────────▼──┐   ┌──────▼──────────────────────┐
     │ Azure Database for  │   │ Azure Files (share "uploads")│
     │ PostgreSQL Flexible │   │ montado en /data/uploads     │
     │ (datos, sesiones,   │   │ fotos, documentos, reportes  │
     │  límite de login)   │   │ de turno, evidencias         │
     └─────────────────────┘   └──────────────────────────────┘
          Azure Container Registry: guarda las imágenes (versiones) de la app
```

**Un solo dominio** para la app y la API: el mismo contenedor sirve el frontend compilado y la API bajo `/api`. Así no hay CORS ni cookies entre sitios distintos.

### Qué hace que aguante varios usuarios y varias instancias

| Pieza | Cómo está resuelto |
|---|---|
| Sesiones de usuario | En PostgreSQL (`connect-pg-simple`), no en memoria: cualquier instancia atiende a cualquier usuario. |
| Límite de intentos de login | En PostgreSQL; IP real del usuario sin el puerto que agrega Azure (`backend/src/utils/clientIp.js`). |
| Tareas programadas (alertas, Telegram, reportes de turno, preventivas, km del GPS) | **Un solo proceso entre todas las instancias**, elegido con un *advisory lock* de PostgreSQL (`backend/src/scheduler/leader.js`). Si ese proceso se cae, otro toma el relevo en ≤ 1 minuto. |
| Archivos subidos | Azure Files, compartido por todas las instancias y persistente entre despliegues (`UPLOADS_DIR`). |
| Permisos | Cada proceso los vuelve a leer de la base cada minuto. |
| Conexiones a la base | Pool por proceso (`DB_POOL_MAX`) con timeouts; las peticiones de más esperan turno en vez de fallar. |
| Reinicios y escalado | Apagado ordenado con SIGTERM: termina las peticiones en curso, suelta el liderazgo y cierra el pool. Health check en `/health`. |
| Migraciones | `backend/scripts/migrate.mjs`: registra en `schema_migrations` cuáles se aplicaron y corre solo las pendientes, con lock para que dos instancias no migren a la vez. |

**Prueba de carga (08/10/2026, 1 solo proceso, base local):** 300 peticiones simultáneas a la base → 0 errores, ~2.000 req/s. Usuario logueado consultando todos los llenados, el reporte de combustible y el de horas, con 150 simultáneos → 0 errores, 170–550 req/s, p95 < 1 s. En Azure son 2 procesos por instancia y se pueden sumar instancias.

---

## 2. Antes de empezar: decisiones

1. **Base de datos de origen.** Producción arranca con una copia (`pg_dump`) de UNA de las bases locales. Hay que elegir cuál:
   - **Laptop de Luis:** tiene el historial real del Tracker y los suscriptores de Telegram.
   - **PC de Julio:** tiene datos de **prueba generados** en Combustible (27/08–25/09) y Control de Horas (09/09–04/10). **No deben pasar a producción** tal cual.
   - Opción recomendada: restaurar la base de Luis y aplicar encima las migraciones que le falten (paso 6). Si se quiere la de Julio, borrar antes los datos generados.
2. **Región:** `eastus2` (buena latencia desde Venezuela y de las más económicas). `brazilsouth` también sirve, pero es más cara.
3. **Dominio:** sin dominio propio la app queda en `https://<nombre>.azurewebsites.net`, con HTTPS incluido. Con dominio (`app.fullpetro.com`) se agrega al final (paso 10).
4. **Tamaño:** ver la sección 11 (costos).

---

## 3. Variables para Cloud Shell

Abre Cloud Shell (modo **Bash**) y pega esto. Cambia los nombres que llevan `<...>`: deben ser **únicos en todo Azure**, solo minúsculas y números.

```bash
RG=rg-fullpetro
LOC=eastus2
PG=<fullpetropg01>            # servidor PostgreSQL
PG_ADMIN=fpadmin
PG_PASS='<una contraseña larga y fuerte>'
ST=<fullpetrofiles01>         # cuenta de almacenamiento (3-24 letras/números)
ACR=<fullpetroacr01>          # registro de imágenes
PLAN=plan-fullpetro
APP=<fullpetro-app>           # la app quedará en https://$APP.azurewebsites.net

az group create -n $RG -l $LOC
```

> Si Cloud Shell se cierra, estas variables se pierden: vuelve a pegar el bloque.

---

## 4. Crear los recursos

### 4.1 PostgreSQL
```bash
az postgres flexible-server create -g $RG -n $PG -l $LOC \
  --tier Burstable --sku-name Standard_B2s --version 17 --storage-size 32 \
  --admin-user $PG_ADMIN --admin-password "$PG_PASS" \
  --public-access 0.0.0.0 --backup-retention 14

az postgres flexible-server db create -g $RG -s $PG -d fullpetro
```
- `--public-access 0.0.0.0` deja entrar **solo a servicios de Azure** (la app). Para restaurar la base desde la oficina, más adelante se agrega una regla para la IP pública de la oficina (paso 6).
- Si en el portal ya aparece la versión **18** (la local es 18.6), se puede usar `--version 18`.
- Revisa `max_connections` del servidor (Portal → servidor → *Server parameters*) para la cuenta de la sección 9.

### 4.2 Azure Files (archivos subidos)
```bash
az storage account create -g $RG -n $ST -l $LOC --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2
az storage share-rm create -g $RG --storage-account $ST -n uploads --quota 100
ST_KEY=$(az storage account keys list -g $RG -n $ST --query "[0].value" -o tsv)
```

### 4.3 Registro de imágenes y primera imagen
```bash
az acr create -g $RG -n $ACR --sku Basic

# El repo es privado: usa un token de GitHub (Settings → Developer settings →
# Personal access tokens, permiso "repo" de solo lectura).
git clone https://<usuario>:<token>@github.com/juliomoran10/API-Fullpetro.git
cd API-Fullpetro
git checkout produccion   # Azure SIEMPRE se despliega desde la rama produccion

az acr build -r $ACR -t fullpetro:$(git rev-parse --short HEAD) -t fullpetro:latest .
```
La imagen se construye **en Azure** (unos 5–8 minutos) con el `Dockerfile` de la raíz. Cada imagen queda etiquetada con el commit, lo que permite volver atrás (sección 8).

### 4.4 App Service
```bash
az appservice plan create -g $RG -n $PLAN --is-linux --sku P1v3

az webapp create -g $RG -p $PLAN -n $APP --container-image-name $ACR.azurecr.io/fullpetro:latest

# La app baja la imagen del registro con su propia identidad (sin contraseñas)
az webapp identity assign -g $RG -n $APP
PRINCIPAL=$(az webapp identity show -g $RG -n $APP --query principalId -o tsv)
az role assignment create --assignee $PRINCIPAL --role AcrPull --scope $(az acr show -n $ACR --query id -o tsv)
az webapp config set -g $RG -n $APP --generic-configurations '{"acrUseManagedIdentityCreds": true}'

# Siempre encendida, salud en /health, solo HTTPS
az webapp config set -g $RG -n $APP --always-on true --generic-configurations '{"healthCheckPath": "/health"}'
az webapp update -g $RG -n $APP --https-only true

# Montar Azure Files en /data/uploads
az webapp config storage-account add -g $RG -n $APP --custom-id uploads \
  --storage-type AzureFiles --account-name $ST --share-name uploads \
  --access-key "$ST_KEY" --mount-path /data/uploads

# Logs del contenedor visibles en "Log stream"
az webapp log config -g $RG -n $APP --docker-container-logging filesystem
```
> En versiones viejas de `az`, `webapp create` usa `--deployment-container-image-name` en vez de `--container-image-name`.

---

## 5. Configuración (variables de entorno)

La lista completa, con qué poner en cada una, está en **`deploy/azure/app-settings.example.env`**. Se cargan una sola vez; los secretos quedan cifrados en Azure y nunca en el repositorio.

```bash
az webapp config appsettings set -g $RG -n $APP --settings \
  WEBSITES_PORT=8080 \
  NODE_ENV=production \
  DB_HOST=$PG.postgres.database.azure.com DB_PORT=5432 DB_NAME=fullpetro \
  DB_USER=$PG_ADMIN DB_PASSWORD="$PG_PASS" DB_SSL=true \
  DB_POOL_MAX=8 DB_STATEMENT_TIMEOUT_MS=30000 \
  COOKIE_SECURE=true \
  FRONTEND_URL=https://$APP.azurewebsites.net \
  SECRET="$(openssl rand -hex 32)" JWT_SECRET="$(openssl rand -hex 32)" \
  RUN_MIGRATIONS_ON_START=true \
  SCHEDULER_ENABLED=false
```
Después, en **Portal → la app → Configuration → Application settings**, agrega a mano los secretos y ajustes del Tracker que hoy están en `backend/.env` de la laptop de Luis: `FORESIGHT_*`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TRACKER_*`, `FLEET_*`, `MNT_*`, `RESEND_API_KEY`, `EMAIL`. Cópialos **tal cual** desde ese `.env` (nunca los pegues en el chat ni en un archivo del repo).

`SCHEDULER_ENABLED=false` por ahora: así Azure **no manda nada a Telegram** mientras se prueba. Se enciende en el paso 7.

---

## 6. Datos: base y archivos

### 6.1 Copiar la base de datos
En la computadora de origen (la elegida en el paso 2), en PowerShell:
```powershell
# 1. Respaldo (formato SQL plano: se restaura bien aunque el origen sea PostgreSQL 18 y Azure 17)
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h localhost -U postgres -d fullpetro --no-owner --no-privileges -f fullpetro.sql
```
En Cloud Shell, dale permiso temporal a la IP pública de la oficina (búscala en https://ifconfig.me desde esa computadora):
```bash
az postgres flexible-server firewall-rule create -g $RG -n $PG --rule-name oficina-temporal \
  --start-ip-address <IP_OFICINA> --end-ip-address <IP_OFICINA>
```
De vuelta en la computadora de origen:
```powershell
$env:PGPASSWORD = '<la contraseña PG_PASS>'
$env:PGSSLMODE = 'require'
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h <PG>.postgres.database.azure.com -U fpadmin -d fullpetro -v ON_ERROR_STOP=1 -f fullpetro.sql
Remove-Item Env:PGPASSWORD
```
Luego, **marca las migraciones** y aplica las que falten (desde la carpeta `backend` del proyecto, con un `.env` temporal que apunte a Azure, o desde Cloud Shell con Node):
```bash
node scripts/migrate.mjs --baseline   # solo si la base de origen tenía TODAS las migraciones aplicadas
node scripts/migrate.mjs --status
```
Si no estás seguro de que el origen las tenga todas, **no uses `--baseline`**: deja `RUN_MIGRATIONS_ON_START=true` y revisa en el Log stream qué aplica y si alguna falla. Las que traen `IF NOT EXISTS` se pueden repetir sin daño.

Al terminar, borra la regla temporal:
```bash
az postgres flexible-server firewall-rule delete -g $RG -n $PG --rule-name oficina-temporal --yes
```

### 6.2 Copiar los archivos subidos
Portal → cuenta de almacenamiento `$ST` → **File shares** → `uploads` → **Upload**: sube **el contenido** de `backend\uploads` de la computadora de origen, conservando las carpetas `fleet`, `fuel`, `maintenance` y `tracker`. Hoy son ~10 MB. Para cargas grandes se puede usar *Azure Storage Explorer*.

### 6.3 Reiniciar y verificar
```bash
az webapp restart -g $RG -n $APP
az webapp log tail -g $RG -n $APP      # Ctrl+C para salir
```
Abre `https://$APP.azurewebsites.net/health`. Tiene que decir `"status":"ok","db":"ok"`. Después entra a la app, inicia sesión y revisa: Estado de Flota, una ficha con foto, el reporte de combustible y el Control de Horas.

---

## 7. Encender las tareas programadas (go-live)

Las alertas, los reportes de turno y Telegram tienen que salir **de un solo lugar**. Hoy salen de la laptop de Luis, y a veces también de la PC de Julio: eso causa el error 409 de Telegram y los avisos duplicados.

1. En la **laptop de Luis** y en la **PC de Julio**, agrega al `backend/.env`:
   ```
   SCHEDULER_ENABLED=false
   ```
   y reinicia el backend (`pm2 restart fullpetro-backend`, o Ctrl+C y `pnpm run dev`). En el log tiene que aparecer *"Tareas programadas desactivadas en esta máquina"*.
2. En Azure:
   ```bash
   az webapp config appsettings set -g $RG -n $APP --settings SCHEDULER_ENABLED=true
   ```
3. Revisa `/health`: alguna instancia tiene que mostrar `"scheduler":"leader"`. En el Log stream aparece *"Este proceso es el líder"*.

---

## 8. Actualizar la app (cada vez que haya cambios)

**Flujo de ramas (08/10/2026):** cada uno trabaja en su rama (`Julio`, `Luis`) → se integra en **`desarrollo`** y se prueba ahí → cuando está estable, `desarrollo` se pasa a **`produccion`** → Azure se actualiza desde `produccion`. Nunca se sube directo a `produccion` sin pasar por `desarrollo`.

En Cloud Shell:
```bash
cd ~/API-Fullpetro && git checkout produccion && git pull
TAG=$(git rev-parse --short HEAD)
az acr build -r $ACR -t fullpetro:$TAG -t fullpetro:latest .
az webapp config container set -g $RG -n $APP --container-image-name $ACR.azurecr.io/fullpetro:$TAG
```
Las migraciones nuevas se aplican solas al arrancar (`RUN_MIGRATIONS_ON_START=true`).

**Volver a la versión anterior:** repite el último comando con la etiqueta (commit) anterior. `az acr repository show-tags -n $ACR --repository fullpetro -o table` lista las disponibles.
**Ojo:** volver atrás la imagen no deshace migraciones. Las migraciones nuevas deben ser compatibles con la versión anterior (agregar columnas o tablas, no borrarlas en el mismo despliegue).

---

## 9. Escalar y conexiones a la base

- **Más procesos por instancia:** `WEB_CONCURRENCY` (por defecto 2, uno por vCPU del plan P1v3).
- **Más instancias:** Portal → la app → **Scale out**. Regla sugerida: CPU > 70 % durante 10 min → +1 instancia, máximo 3.
- **Conexiones:** total = `DB_POOL_MAX × WEB_CONCURRENCY × instancias + 2` (líder y migraciones). Con 8 × 2 × 3 = 48, lejos del `max_connections` de un B2s. Si se sube a más instancias, recalcula contra el `max_connections` del servidor (paso 4.1).
- **Tareas programadas:** no importa cuántas instancias haya; siempre corren en una sola.

---

## 10. Dominio propio (opcional)

Portal → la app → **Custom domains** → *Add custom domain* (`app.fullpetro.com`): Azure indica dos registros DNS (CNAME + TXT) para crear donde esté el DNS de fullpetro.com. Después, **Add binding** con *App Service Managed Certificate* (HTTPS gratis y renovación automática). Por último:
```bash
az webapp config appsettings set -g $RG -n $APP --settings FRONTEND_URL=https://app.fullpetro.com
```
(`FRONTEND_URL` arma el enlace del correo de "olvidé mi contraseña".)

---

## 11. Costos aproximados (USD/mes, octubre 2026; confirmar en la calculadora de Azure)

| Recurso | Arranque recomendado | Mínimo para probar |
|---|---|---|
| App Service | P1v3 (2 vCPU, 8 GB, autoescalado) ≈ 115 | B2 (2 vCPU, 3,5 GB, sin autoescalado) ≈ 26 |
| PostgreSQL Flexible | B2s + 32 GB ≈ 30 | B1ms ≈ 15 (max_connections bajo: bajar `DB_POOL_MAX` a 4) |
| Azure Files 100 GB | ≈ 6 | ≈ 6 |
| Container Registry Basic | ≈ 5 | ≈ 5 |
| **Total** | **≈ 155** | **≈ 52** |

---

## 12. Respaldos y monitoreo

- **Base:** respaldos automáticos de Flexible Server, 14 días (se puede restaurar a cualquier minuto). Portal → servidor → *Backup and restore*.
- **Archivos:** Portal → cuenta de almacenamiento → `uploads` → *Snapshots* (o una *Backup policy* diaria con Azure Backup).
- **Monitoreo:** *Log stream* para ver en vivo; *Health check* avisa si una instancia falla. Opcional: Application Insights para tiempos de respuesta y errores.

---

## 13. Lista de verificación final

- [ ] `/health` responde `ok` y `db: ok`.
- [ ] Login funciona (cookie `Secure`, solo HTTPS).
- [ ] Una foto subida se ve después de `az webapp restart` (Azure Files montado).
- [ ] Generar un reporte de turno en PDF funciona (Chromium dentro de la imagen).
- [ ] Solo Azure tiene `SCHEDULER_ENABLED=true`; las máquinas locales tienen `false`.
- [ ] Llega un solo aviso por Telegram por evento (no duplicados).
- [ ] La regla temporal del firewall de PostgreSQL se borró.
