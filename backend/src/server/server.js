import express from 'express';
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
import trackerAttachmentRouter from '../tracker/trackerAttachmentRoutes.js';
import trackerReportFileRouter from '../tracker/trackerReportFileRoutes.js';
import authMiddleware from '../auth/authMiddleware.js';
import { startTrackerScheduler } from '../tracker/scheduler.js';

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
    if (process.env.NODE_ENV === 'production') {
      this.app.set('trust proxy', 1);
    }
    this.PORT = process.env.PORT || 3000;
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
    this.app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }),
    );
    this.app.use(
      cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
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
        cookie: {
          secure: process.env.COOKIE_SECURE === 'true',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 2 * 60 * 60 * 1000,
        },
      }),
    );
  }

  routes() {
    this.app.use(authMiddleware);
    this.app.use('/', dispatcherRouter);
    this.app.use('/user', userRouter);
    this.app.use('/fuel', fuelPhotoRouter);
    this.app.use('/tracker', trackerAttachmentRouter);
    this.app.use('/tracker', trackerReportFileRouter);
  }

  async init() {
    await this.config.init();
    await this.security.syncPermissions();
    await this.security.syncTransactions();
    await this.security.syncUserProfiles();
    startTrackerScheduler();

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
        this.app.listen(this.PORT, () => {
          console.log(
            `${this.config.getMessage(this.config.LANGUAGE, 'server_running')} http://localhost:${this.PORT}`,
          );
        });
      })
      .catch((error) => {
        console.error('Error al iniciar servidor:', error?.message || error);
        process.exit(1);
      });
  }
}

export default Server;
