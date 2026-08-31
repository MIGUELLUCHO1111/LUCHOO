import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import cors from 'cors';
import Config from '../../config/config.js';
import dotenv from 'dotenv';
import userRouter from '../session/sessionRoutes.js';
import Security from '../security/security.js';
import dispatcherRouter from '../dispatcher/dispatcherRoutes.js';
import authMiddleware from '../auth/authMiddleware.js';

dotenv.config();

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
    this.app.use(
      cors({
        // origin: ['*'],
        origin: ['http://localhost:5173'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      }),
    );
    this.app.use(bodyParser.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(
      session({
        secret: process.env.SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: {
          secure: false,
          httpOnly: true,
          maxAge: 5 * 60 * 1000,
        },
      }),
    );
  }

  routes() {
    this.app.use(authMiddleware);
    this.app.use('/', dispatcherRouter);
    this.app.use('/user', userRouter);
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
