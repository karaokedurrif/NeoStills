# NeoStills

NeoStills es una plataforma para destiladores artesanales y homedistillers orientada a cubrir el flujo completo grain-to-glass: inventario, recetas, fermentacion, destilacion, barricas, analitica e IA.

Estado actual del repo:
- Backend API en FastAPI + SQLAlchemy + Alembic.
- Frontend en React 19 + TypeScript + Vite.
- PostgreSQL y Redis para persistencia y colas.
- Celery para tareas asicronas.
- Integracion de voz y proyectos ESP32 en carpetas separadas.

## Stack tecnico

- Backend: FastAPI, SQLAlchemy async, Alembic, Celery.
- Frontend: React, TanStack Router, TanStack Query, Tailwind, Framer Motion.
- Base de datos: PostgreSQL 16.
- Cache/colas: Redis 7.
- IA: Anthropic, OpenAI, Together, Ollama.
- Despliegue: Docker Compose + Nginx.

## Estructura principal

- `backend/`: API, modelos, schemas, servicios, workers y migraciones.
- `frontend/`: SPA principal de NeoStills.
- `voice-gateway/`: gateway de voz para integraciones de audio y asistentes.
- `esp32/`: firmware, experimentos y componentes para hardware integrado.
- `tests/`: pruebas del backend y logica de negocio.
- `data-backup/`: datos heredados y respaldos JSON usados para migracion.
- `.github/`: instrucciones de Copilot, agentes y prompts del repo.

## Desarrollo local

### 1. Variables de entorno

```bash
cp .env.example .env
```

Rellena las claves necesarias en `.env` antes de arrancar servicios que dependan de IA, correo o webhooks.

### 2. Levantar backend + base de datos + redis

```bash
docker compose up -d postgres redis backend
```

Servicios de desarrollo expuestos por defecto:
- Backend API: `http://localhost:8010`
- Healthcheck: `http://localhost:8010/api/health`
- Swagger: `http://localhost:8010/api/docs`
- PostgreSQL: `localhost:5435`
- Redis: `localhost:6380`

### 3. Levantar el frontend

El `docker-compose.yml` de desarrollo no arranca el frontend; se ejecuta aparte:

```bash
cd frontend
npm ci
npm run dev
```

Frontend local por defecto:
- `http://localhost:5173`

## Comandos utiles

### Backend

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend pytest
docker compose logs -f backend
```

### Frontend

```bash
cd frontend
npm run build
npm run lint
```

Si no tienes Node instalado en host, puedes validar el frontend con Docker:

```bash
docker build -f frontend/Dockerfile.prod -t neostills-frontend-test ./frontend
```

## Produccion

La guia operativa esta en `DEPLOYMENT.md`.

Comandos base de produccion:

```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml exec backend alembic upgrade head
```

El frontend de produccion se construye con `frontend/Dockerfile.prod` y sirve los assets compilados desde Nginx.

## Dominio y visibilidad de cambios

El objetivo de produccion en esta version es:
- `https://neostills.com`
- `https://www.neostills.com`

Importante: cambiar archivos en este repo no publica automaticamente nada en la web. Para que un cambio visual aparezca en `www.neostills.com` hace falta reconstruir y redeplegar el servicio `frontend` en el entorno de produccion.

Comando minimo para publicar cambios de UI ya compilables:

```bash
docker compose -f docker-compose.production.yml up -d --build frontend
```

Despues del redeploy normalmente basta con:
- esperar a que el contenedor nuevo quede arriba,
- hacer hard refresh en el navegador,
- y, si hay cache externa, purgar cache de Cloudflare/Nginx si aplica.

## Estado del rediseño actual

Ya aplicado en este repo:
- nueva paleta cobre/roble para NeoStills,
- logo placeholder de alambique,
- dashboard principal orientado a destilacion,
- cambio de copy visible de BeerGate a NeoStills en la capa principal,
- renombrado del asistente a Genio Destilador / Master Distiller.

Pendiente en siguientes fases:
- onboarding homedistiller vs craft distillery,
- renombrado de secciones internas heredadas como `keezer` a `aging room` a nivel de rutas y componentes,
- modelos de datos de destilacion y barrel management.

## Referencias del proyecto

- Prompt de producto y dominio: `.github/copilot-instructions.md`
- Guia de despliegue: `DEPLOYMENT.md`
- Compose de desarrollo: `docker-compose.yml`
- Compose de produccion: `docker-compose.production.yml`
