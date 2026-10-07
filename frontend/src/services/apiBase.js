// Direccion del backend para toda la app.
//
// En la laptop de la oficina la app corre con el servidor de desarrollo de
// Vite (PM2). Ahi el backend se pide por "/api" y Vite lo reenvia a
// localhost:3000 (vite.config.js -> server.proxy). Asi la app funciona igual
// desde OTRA computadora de la red de la oficina (http://IP-de-la-laptop:5173)
// sin abrir el puerto 3000 ni tocar CORS -- pedido de Lguerra, 07/10/2026.
// En un build de produccion se usa VITE_API_URL como antes.
export const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "/api" : "http://localhost:3000");
