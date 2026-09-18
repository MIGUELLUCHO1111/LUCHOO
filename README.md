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
- **Prisma 6** + SQLite en desarrollo (fácil de cambiar a PostgreSQL en producción)
- **NextAuth (Auth.js) v5** — autenticación por credenciales con roles (Admin / Agente / Solicitante)
- **Socket.IO** sobre un servidor Node personalizado (`server.ts`) para el chat en tiempo real
- **Radix UI + shadcn-style components** para la interfaz

## Requisitos

- Node.js 20.9 o superior
- npm

## Puesta en marcha (desarrollo)

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### Usuarios de prueba (creados por el seed)

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | admin@fullpetro.com | Admin123! |
| Agente de soporte | agente@fullpetro.com | Agente123! |
| Solicitante | usuario@fullpetro.com | Usuario123! |

**Cambia estas contraseñas antes de usar el sistema en producción.**

## Variables de entorno (`.env`)

```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="genera-un-secreto-aleatorio-largo"
NEXTAUTH_URL="http://localhost:3000"
```

Para generar un `AUTH_SECRET` seguro: `openssl rand -base64 32`.

## Despliegue en el servidor interno

Este proyecto usa un servidor Node personalizado (`server.ts`) para poder combinar Next.js con Socket.IO, así que **no es compatible con Vercel/serverless** — está pensado para correr en un servidor propio (Windows Server, Linux, un contenedor Docker, etc.).

1. **Base de datos**: en producción se recomienda **PostgreSQL** en lugar de SQLite.
   - Edita `prisma/schema.prisma` y cambia `provider = "sqlite"` por `provider = "postgresql"`.
   - Actualiza `DATABASE_URL` en `.env` con la cadena de conexión de PostgreSQL.
   - Corre `npx prisma migrate deploy`.
2. Copia `.env` con los valores reales de producción (`AUTH_SECRET` distinto al de desarrollo, `NEXTAUTH_URL` con el dominio/IP real).
3. Instala dependencias y compila:
   ```bash
   npm install
   npm run build
   ```
4. Levanta el servidor:
   ```bash
   npm run start
   ```
   Esto corre `server.ts` (Next.js + Socket.IO) en modo producción. Usa un gestor de procesos como **PM2** o un servicio de Windows para mantenerlo corriendo y reiniciarlo automáticamente.
5. Coloca un proxy inverso (IIS, Nginx, Caddy) delante del puerto 3000 si necesitas HTTPS o un dominio interno.
6. La carpeta `public/uploads/` guarda los archivos adjuntos (actas de entrega, facturas). Asegúrate de que esa carpeta esté en un disco con respaldo/backup.

## Notas de diseño

- Los colores de marca (azul marino y amarillo del logo de Fullpetro, con blanco predominante) están centralizados como variables CSS en `src/app/globals.css`.
- El acceso a los módulos de Inventario, Software, Mantenimiento, Compras y Proveedores está restringido a los roles Admin y Agente. El módulo de Usuarios está restringido solo a Admin.
