import express from 'express';
import Dispatcher from './dispatcher.js';

const router = express.Router();
const dispatcher = new Dispatcher();

router.post('/', async (req, res) => {
    try {
        const result = await dispatcher.toProccess(req);
        const statusCode = result?.statusCode || 200;
        return res.status(statusCode).json(result);

    } catch (error) {
        console.error('Error crítico en el endpoint del Dispatcher:', error);
        return res.status(500).json({
            statusCode: 500,
            message: 'Error interno del servidor en el manejador de rutas'
        });
    }
});

export default router;