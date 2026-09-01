import express from 'express';
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
import authMiddleware from '../auth/authMiddleware.js';

dotenv.config();

const PgSessionStore = pgSession(session);

class Server {
  constructor() {
    if (Server.instance) {
      return Server.instance;
    }

    this.app = express();
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
  }

  async init() {
    await this.config.init();
    await this.security.syncPermissions();
    await this.security.syncTransactions();
    await this.security.syncUserProfiles();
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
