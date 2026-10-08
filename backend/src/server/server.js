import express from 'express';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import bodyParser from 'body-parser';
import cors from 'cors';
import Config from '../../config/config.js';
import dotenv from 'dotenv';
import pool from '../../config/db.js';
import userRouter from '../session/sessionRoutes.js';
import Security from '../security/security.js';
import dispatcherRouter from '../dispatcher/dispatcherRoutes.js';
import fuelPhotoRouter from '../fuel/fuelPhotoRoutes.js';
import fleetPhotoRouter from '../fleet/fleetPhotoRoutes.js';
import fleetSheetRouter from '../fleet/fleetSheetRoutes.js';
import trackerAttachmentRouter from '../tracker/trackerAttachmentRoutes.js';
import trackerReportFileRouter from '../tracker/trackerReportFileRoutes.js';
import authMiddleware from '../auth/authMiddleware.js';
import { startTrackerScheduler } from '../tracker/scheduler.js';
import { startMaintenanceScheduler } from '../maintenance/scheduler.js';
import mntFileRouter from '../maintenance/mntFileRoutes.js';
import { resyncSectionPermissions } from '../bo/sub_system/classes/option.js';
import { runAsLeader, releaseLeadership, schedulerIsLeader } from '../scheduler/leader.js';
import { SESSION_IDLE_MS, REFRESHED_TOKEN_HEADER } from '../session/sessionPolicy.js';
import { startAuditCleanup, flushActivity } from '../security/activityTracker.js';

dotenv.config();

const PgSessionStore = pgSession(session);

class Server {
  constructor() {
    if (Server.instance) {
      return Server.instance;
    }

    this.app = express();
    // En producción, NGINX hace de proxy inverso delante de este proceso
    // (ver deploy/nginx-fullpetro.conf). Sin esto, Express ve TODAS las
    // peticiones viniendo de 127.0.0.1 (la IP de NGINX, no la del usuario
    // real) -- req.ip siempre sería la misma para todo el mundo, y el rate
    // limiter de login/registro (keyGenerator basado en req.ip) trataría a
    // TODOS los usuarios como una sola IP compartiendo un único cupo de 20
    // intentos cada 15 minutos, en vez de 20 por persona. 'trust proxy: 1'
    // confía solo en el primer salto (NGINX, en la misma máquina) y lee la
    // IP real del header X-Forwarded-For que NGINX ya reenvía. Solo en
    // producción: en desarrollo no hay proxy real delante, así que confiar
    // en X-Forwarded-For dejaría que cualquiera lo mande a mano y falsee su
    // propia IP para saltarse el rate limit localmente.
    // Azure (08/10/2026): delante hay un balanceador (App Service / Container
    // Apps) en vez de NGINX; también es UN salto, así que el valor por defecto
    // sigue sirviendo. TRUST_PROXY permite ajustarlo sin tocar código si se
    // agrega otro proxy (ej. Front Door delante = 2).
    if (process.env.NODE_ENV === 'production') {
      const hops = Number.parseInt(process.env.TRUST_PROXY ?? '1', 10);
      this.app.set('trust proxy', Number.isFinite(hops) ? hops : 1);
    }
    this.PORT = process.env.PORT || 3000;
    // Carpeta del frontend compilado (vite build) si este proceso también lo
    // sirve (Azure). Si la variable apunta a algo sin index.html se ignora.
    const dist = process.env.FRONTEND_DIST_DIR ? path.resolve(process.env.FRONTEND_DIST_DIR) : null;
    this.frontendDist = dist && fs.existsSync(path.join(dist, 'index.html')) ? dist : null;
    if (dist && !this.frontendDist) console.warn(`[Server] FRONTEND_DIST_DIR=${dist} no tiene index.html: no se sirve el frontend`);
    this.configuration();
    this.routes();
    this.config = new Config();
    this.security = new Security();
    Server.instance = this;
  }

  configuration() {
    // FRONTEND_URL admite una lista separada por comas (ej. para probar desde
    // localhost y desde una IP de red a la vez). localhost:5173 siempre queda
    // permitido de base, así no hay que tocar .env para alternar entre los dos.
    const extraOrigins = (process.env.FRONTEND_URL || '')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);
    const allowedOrigins = [...new Set(['http://localhost:5173', ...extraOrigins])];

    // CSP desactivada: esta API no sirve HTML, solo JSON y archivos (fotos de
    // combustible/tracker) -- el CSP de helmet es para paginas renderizadas.
    // crossOriginResourcePolicy en 'cross-origin' porque el frontend vive en
    // un subdominio distinto al backend (app.tudominio.com vs
    // api.tudominio.com, ver DEPLOYMENT.md) y necesita poder cargar esos
    // archivos; el default de helmet ('same-origin') los bloquearía.
    // Política de contenido (CSP, seguridad 08/10/2026): cuando este proceso
    // sirve la app (Azure, FRONTEND_DIST_DIR), el navegador solo ejecuta código
    // de este mismo sitio; si algún día apareciera una inyección de HTML no
    // podría cargar scripts de afuera ni mandar datos a otro servidor. Fuentes
    // externas reales: solo las teselas del mapa (OpenStreetMap). Estilos en
    // línea permitidos (React y las animaciones los usan). blob:/data: para las
    // vistas previas de fotos y PDF. Sin la app (desarrollo, API sola) queda
    // apagada como antes. upgrade-insecure-requests solo con HTTPS real.
    const csp = this.frontendDist
      ? {
          useDefaults: false,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org'],
            fontSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            frameSrc: ["'self'", 'blob:'],
            workerSrc: ["'self'", 'blob:'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            ...(process.env.COOKIE_SECURE === 'true' ? { upgradeInsecureRequests: [] } : {}),
          },
        }
      : false;
    this.app.use(
      helmet({
        contentSecurityPolicy: csp,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }),
    );

    // Salud para Azure (health check / probes) y monitoreo. Va antes de CORS,
    // sesión y auth: no necesita nada de eso y no debe tocar la tabla de
    // sesiones en cada sondeo. /health/live = el proceso responde;
    // /health = además la base contesta (si no, 503 y Azure saca la
    // instancia del balanceo hasta que se recupere).
    this.app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
    this.app.get('/health', async (req, res) => {
      const started = Date.now();
      try {
        await pool.query('SELECT 1');
        res.json({
          status: 'ok',
          db: 'ok',
          dbMs: Date.now() - started,
          scheduler: process.env.SCHEDULER_ENABLED === 'false' ? 'disabled' : schedulerIsLeader() ? 'leader' : 'follower',
          // Estado del pool de ESTE proceso (08/10/2026): si "waiting" sube
          // seguido, faltan conexiones (subir DB_POOL_MAX o la base); si
          // "inUse" se queda en el máximo sin carga, algo no las devuelve.
          pool: {
            max: pool.options.max,
            total: pool.totalCount,
            inUse: pool.totalCount - pool.idleCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
          uptimeS: Math.round(process.uptime()),
        });
      } catch (err) {
        res.status(503).json({ status: 'error', db: 'down', error: err?.message || String(err) });
      }
    });

    // Frontend compilado servido por este mismo proceso (Azure: un solo
    // dominio para app y API -- sin CORS ni cookies entre sitios distintos,
    // que los navegadores bloquean cada vez más). Solo si FRONTEND_DIST_DIR
    // está definido; en desarrollo sigue Vite en :5173 como siempre. Va antes
    // de la sesión para que los .js/.css no consulten la tabla de sesiones.
    if (this.frontendDist) {
      this.app.use(
        '/assets',
        express.static(path.join(this.frontendDist, 'assets'), { immutable: true, maxAge: '1y', index: false }),
      );
      this.app.use(express.static(this.frontendDist, { index: false, maxAge: '1h' }));
    }
    this.app.use(
      cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        // La pantalla lee el pase renovado (cierre por inactividad).
        exposedHeaders: [REFRESHED_TOKEN_HEADER],
      }),
    );
    this.app.use(bodyParser.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(
      session({
        store: new PgSessionStore({
          pool,
          tableName: 'session',
          createTableIfMissing: true,
        }),
        secret: process.env.SECRET,
        resave: false,
        saveUninitialized: false,
        // Cierre por inactividad (08/10/2026): la cookie se renueva con cada
        // respuesta y vence a los SESSION_IDLE_MINUTES sin actividad (antes 2 h
        // fijas desde el login).
        rolling: true,
        cookie: {
          secure: process.env.COOKIE_SECURE === 'true',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: SESSION_IDLE_MS,
        },
      }),
    );
  }

  routes() {
    this.app.use(authMiddleware);

    // La API completa vive en un router propio que se monta en /api (lo que
    // usa el frontend en Azure, VITE_API_URL=/api) y, salvo que se apague con
    // API_AT_ROOT=false, también en / como siempre (desarrollo y cualquier
    // cliente viejo). En producción con el frontend servido aquí conviene
    // API_AT_ROOT=false: así ninguna ruta de la API (GET /fleet/..., /tracker/...)
    // puede pisar una pantalla de la app al recargar la página.
    const api = express.Router();
    api.use('/', dispatcherRouter);
    api.use('/user', userRouter);
    api.use('/fuel', fuelPhotoRouter);
    api.use('/fleet', fleetPhotoRouter);
    api.use('/fleet', fleetSheetRouter);
    api.use('/maintenance', mntFileRouter);
    api.use('/tracker', trackerAttachmentRouter);
    api.use('/tracker', trackerReportFileRouter);

    this.app.use('/api', api);
    if (process.env.API_AT_ROOT !== 'false') {
      this.app.use('/', api);
    }

    // Cualquier otra ruta GET que pida HTML es una pantalla de la app (React
    // Router): se responde con index.html. Sin caché para que un redeploy se
    // vea apenas se recarga.
    if (this.frontendDist) {
      const indexHtml = path.join(this.frontendDist, 'index.html');
      this.app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api/') || !req.accepts('html')) return next();
        res.set('Cache-Control', 'no-cache');
        res.sendFile(indexHtml);
      });
    }
  }

  async init() {
    await this.config.init();
    await this.security.syncPermissions();
    await this.security.alignTransactionIds();
    // Perfiles con secciones asignadas reciben las funciones que esas
    // secciones usen hoy (ver resyncSectionPermissions en option.js). Si
    // agregó alguna, se recarga el mapa de permisos en memoria.
    await this.security.dbmsReady;
    const sectionPermsAdded = await resyncSectionPermissions(this.security.dbms);
    if (sectionPermsAdded > 0) {
      console.log(`[Security] ${sectionPermsAdded} permiso(s) de sección agregados a perfiles existentes`);
      await this.security.syncPermissions();
    }
    await this.security.syncTransactions();
    await this.security.syncUserProfiles();
    // Solo UN proceso entre todas las instancias corre las tareas programadas
    // (ver src/scheduler/leader.js). No se espera: si otro ya es líder, este
    // queda reintentando en segundo plano por si aquel se cae.
    runAsLeader(() => {
      startTrackerScheduler();
      startMaintenanceScheduler();
      startAuditCleanup();
    }).catch((err) => console.error('[Scheduler] Error en la elección de líder:', err?.message || err));

    // Bajo PM2 cluster cada proceso tiene su propia instancia de Security
    // (singleton por proceso, no compartido) -- si un admin cambia el perfil
    // de un usuario o los permisos de un perfil, solo el proceso que atendió
    // esa petición actualiza su copia en memoria; los otros 7 quedan con
    // datos viejos hasta que reinicien. Sin esto, "revocar" un acceso podía
    // seguir funcionando en otro proceso durante horas. Se repite cada minuto
    // en vez de solo al arrancar -- una consulta liviana (permission.csv +
    // un par de tablas chicas) es un precio bajo por no depender de
    // reiniciar PM2 a mano cada vez que se toca Seguridad.
    setInterval(() => {
      this.security.syncPermissions().catch((err) => {
        console.error('[Security] Error re-sincronizando permisos:', err?.message || err);
      });
      this.security.syncUserProfiles().catch((err) => {
        console.error('[Security] Error re-sincronizando perfiles de usuario:', err?.message || err);
      });
    }, 60 * 1000);
  }

  start() {
    this.init()
      .then(() => {
        this.httpServer = this.app.listen(this.PORT, () => {
          console.log(
            `${this.config.getMessage(this.config.LANGUAGE, 'server_running')} http://localhost:${this.PORT}`,
          );
        });
        // Azure manda SIGTERM al reiniciar, escalar o redeplegar: se dejan de
        // aceptar peticiones nuevas, se terminan las que están en curso, se
        // suelta el liderazgo (otro proceso toma las tareas programadas al
        // instante en vez de esperar al reintento) y se cierra el pool. Si
        // algo se cuelga, a los 10 s se sale igual.
        const shutdown = (signal) => {
          if (this.shuttingDown) return;
          this.shuttingDown = true;
          console.log(`[Server] ${signal} recibido: apagando ordenadamente`);
          setTimeout(() => process.exit(0), 10_000).unref();
          this.httpServer.close(async () => {
            await flushActivity().catch(() => {});
            await releaseLeadership().catch(() => {});
            await pool.end().catch(() => {});
            process.exit(0);
          });
        };
        process.once('SIGTERM', () => shutdown('SIGTERM'));
        process.once('SIGINT', () => shutdown('SIGINT'));
      })
      .catch((error) => {
        console.error('Error al iniciar servidor:', error?.message || error);
        process.exit(1);
      });
  }
}

export default Server;
