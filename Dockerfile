# Imagen única de Fullpetro para Azure (08/10/2026): el backend Express sirve
# también el frontend compilado, en el mismo dominio (la API queda en /api).
# Ver DEPLOY_AZURE.md para cómo se construye y publica (az acr build).

ARG NODE_VERSION=24
ARG PNPM_VERSION=12.5.1

# ---------- 1. Frontend (vite build) ----------
FROM node:${NODE_VERSION}-bookworm-slim AS frontend
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /src/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
# La app llama a la API en el mismo dominio, bajo /api.
ENV VITE_API_URL=/api
RUN pnpm run build

# ---------- 2. Dependencias de producción del backend ----------
FROM node:${NODE_VERSION}-bookworm-slim AS backend-deps
ARG PNPM_VERSION
# bcrypt compila su módulo nativo si no hay binario precompilado.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /src/backend
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---------- 3. Imagen final ----------
FROM node:${NODE_VERSION}-bookworm-slim
# chromium: PDF/imagen de los reportes de turno (puppeteer-core no trae navegador).
# fonts-*: que esos PDF tengan tildes, ñ y emojis bien dibujados.
# tzdata: la hora del negocio es America/Caracas (fechas "de hoy", turnos).
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation fonts-dejavu-core fonts-noto-color-emoji tzdata ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pm2@6

ENV NODE_ENV=production \
    TZ=America/Caracas \
    PORT=8080 \
    FRONTEND_DIST_DIR=/app/frontend-dist \
    API_AT_ROOT=false \
    UPLOADS_DIR=/data/uploads \
    PDF_CHROME_PATH=/usr/bin/chromium \
    MIGRATIONS_DIR=/app/db/migrations \
    WEB_CONCURRENCY=2

WORKDIR /app/backend
COPY --from=backend-deps /src/backend/node_modules ./node_modules
COPY backend/ ./
COPY db/migrations /app/db/migrations
# Base de una instalación desde cero (base vacía en producción): ver
# backend/scripts/migrate.mjs.
COPY db/schema.sql db/seed.sql /app/db/
COPY --from=frontend /src/frontend/dist /app/frontend-dist
COPY deploy/azure/ecosystem.azure.config.cjs deploy/azure/docker-entrypoint.sh /app/

# sed: por si la imagen se construye desde una copia de Windows con fin de
# línea CRLF (el script no arrancaría en Linux).
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh \
    && chmod +x /app/docker-entrypoint.sh \
    && mkdir -p /data/uploads \
    && chown -R node:node /app /data

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
