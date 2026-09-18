# Fullpetro TI — Tickets e Inventario

Sistema interno del departamento de TI de Fullpetro para:

- **Tickets y chat**: registro, asignación, seguimiento y chat en tiempo real de solicitudes/incidencias.
- **Inventario de equipos**: laptops, desktops, impresoras y otros dispositivos, con acta de entrega adjunta y asignación a empleados.
- **Software licenciado**: control de licencias, asientos y vencimientos.
- **Mantenimiento preventivo**: calendario de mantenimientos por equipo.
- **Compras de TI**: registro de compras con proveedor, costo y comprobante.
- **Proveedores de TI**: directorio de proveedores.
- **Usuarios**: gestión de accesos por rol (solo Admin).

## Stack técnico

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS 4
- **Prisma 6** + **PostgreSQL**
- **NextAuth (Auth.js) v5** — autenticación por credenciales con roles (Admin / Agente / Solicitante)
- **Socket.IO** sobre un servidor Node personalizado (`server.ts`) para el chat en tiempo real
- **Radix UI + shadcn-style components** para la interfaz

## Requisitos

- Node.js 20.9 o superior
- npm
- PostgreSQL 14+ corriendo localmente (o accesible por red)

## Puesta en marcha (desarrollo)

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Abre [http://localhost:3001](http://localhost:3001).

> **Nota**: este proyecto corre en el **puerto 3001**, no el 3000 — en la máquina de desarrollo el puerto 3000 ya lo usa otro proyecto (API-Fullpetro, gestionado con PM2). Cambia `PORT` en los scripts de `package.json` y `NEXTAUTH_URL` en `.env` si necesitas otro puerto.

### Usuarios de prueba (creados por el seed)

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | admin@fullpetro.com | Admin123! |
| Agente de soporte | agente@fullpetro.com | Agente123! |
| Solicitante | usuario@fullpetro.com | Usuario123! |

**Cambia estas contraseñas antes de usar el sistema en producción.**

## Variables de entorno (`.env`)

```
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/sistema_tickets"
AUTH_SECRET="genera-un-secreto-aleatorio-largo"
NEXTAUTH_URL="http://localhost:3001"
```

Para generar un `AUTH_SECRET` seguro: `openssl rand -base64 32` (o `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).

En esta máquina de desarrollo, PostgreSQL ya estaba instalado (compartido con el proyecto API-Fullpetro, mismo usuario `postgres`) y se creó una base de datos separada llamada `sistema_tickets` para no interferir con esa otra app.

## Despliegue en el servidor interno

Este proyecto usa un servidor Node personalizado (`server.ts`) para poder combinar Next.js con Socket.IO, así que **no es compatible con Vercel/serverless** — está pensado para correr en un servidor propio (Windows Server, Linux, un contenedor Docker, etc.).

1. Instala PostgreSQL en el servidor de producción (o usa uno ya existente) y crea una base de datos para este proyecto.
2. Copia `.env` con los valores reales de producción (`DATABASE_URL` de producción, `AUTH_SECRET` distinto al de desarrollo, `NEXTAUTH_URL` con el dominio/IP real).
3. Instala dependencias, aplica las migraciones y compila:
   ```bash
   npm install
   npx prisma migrate deploy
   npm run build
   ```
4. Levanta el servidor con PM2 (recomendado, para que se reinicie solo si el proceso falla). Usa el `ecosystem.config.cjs` incluido — en Windows, `pm2 start npm -- run start` falla porque PM2 no puede ejecutar `npm.cmd` directamente:
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save
   ```
   Sin PM2, `npm run start` también funciona pero no se reinicia solo si el proceso falla. En Windows, `pm2 save` no hace que PM2 arranque solo al reiniciar el servidor — para eso hace falta configurar `pm2` como servicio de Windows (ej. con `pm2-installer`) o una Tarea Programada que corra `pm2 resurrect` al iniciar sesión.
5. Coloca un proxy inverso (IIS, Nginx, Caddy) delante del puerto de la app si necesitas HTTPS o un dominio interno.
6. **Importante**: `src/lib/auth.ts` tiene `trustHost: true` porque la app corre detrás de un dominio/IP propio, no en Vercel. Sin esto, NextAuth rechaza todas las peticiones en modo producción con un error "UntrustedHost".
7. La carpeta `public/uploads/` guarda los archivos adjuntos (actas de entrega, facturas). Asegúrate de que esa carpeta esté en un disco con respaldo/backup.

## Notas de diseño

- Los colores de marca (azul marino y amarillo del logo de Fullpetro, con blanco predominante) están centralizados como variables CSS en `src/app/globals.css`.
- El acceso a los módulos de Inventario, Software, Mantenimiento, Compras y Proveedores está restringido a los roles Admin y Agente. El módulo de Usuarios está restringido solo a Admin.
