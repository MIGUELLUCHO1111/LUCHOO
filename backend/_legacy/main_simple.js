import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import dispatcherRouter from './controller/dispatcher_controller.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración básica (sin sesiones ni DB)
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/dispatcher', dispatcherRouter);

// Endpoint de prueba
app.get('/', (req, res) => {
    res.json({
        message: 'Servidor de pruebas corriendo',
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor de pruebas corriendo en http://localhost:${PORT}`);
    console.log('📡 Endpoint Dispatcher disponible en: http://localhost:3000/dispatcher');
    console.log('🔍 Status endpoint: http://localhost:3000/dispatcher/status');
});
