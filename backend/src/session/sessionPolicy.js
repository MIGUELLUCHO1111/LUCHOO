import dotenv from 'dotenv';

dotenv.config();

// Cierre de sesión por INACTIVIDAD (pedido de Julio, 08/10/2026).
//
// Antes el pase (token) vencía 1 hora después de iniciar sesión, aunque la
// persona estuviera trabajando. Ahora dura SESSION_IDLE_MINUTES (30 por
// defecto) y se renueva solo con cada petición: mientras se use la app no
// vence; si pasan 30 minutos sin actividad, la próxima petición da 401 y la
// pantalla manda al login. La pantalla además lleva su propio contador
// (IdleSessionGuard) para cerrar a los 30 minutos aunque no se haga ninguna
// petición, y renueva el pase en segundo plano si la persona sigue activa
// (leyendo, moviendo el mouse) sin pedir nada al servidor.
const parsed = Number.parseInt(process.env.SESSION_IDLE_MINUTES, 10);
export const SESSION_IDLE_MINUTES = Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
export const SESSION_IDLE_MS = SESSION_IDLE_MINUTES * 60 * 1000;
export const TOKEN_EXPIRES_IN = `${SESSION_IDLE_MINUTES}m`;

// Cabecera por la que el servidor entrega el pase renovado.
export const REFRESHED_TOKEN_HEADER = 'X-Auth-Token';

// No se renueva en CADA petición (serían cientos de firmas por minuto con
// varias pantallas abiertas): solo si el pase actual tiene más de 1 minuto.
export const REFRESH_AFTER_SECONDS = 60;
