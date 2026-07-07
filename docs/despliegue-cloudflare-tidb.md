# Despliegue Cloudflare + TiDB

## Estado actual

- Frontend publicado en Cloudflare Pages.
- Base `reporte_detenciones` creada en TiDB Cloud.
- Tablas y seeds cargados en TiDB.
- Backend preparado como Cloudflare Worker en `backend/src/worker.ts`.

## Frontend Pages

Configuracion usada:

```text
Framework preset: None
Root directory: frontend
Build command: npm run build
Build output directory: dist
Production branch: main
```

Cuando exista URL publica del Worker, configurar en Pages:

```env
VITE_API_URL=https://URL-DEL-WORKER/api
```

Luego redeploy del frontend.

## Backend Worker

El backend de nube usa:

```text
backend/wrangler.toml
backend/src/worker.ts
```

Configuracion esperada:

```toml
name = "sistema-reporte-diario-api"
main = "src/worker.ts"
compatibility_date = "2026-07-06"
compatibility_flags = ["nodejs_compat"]
```

## Variables del Worker

Hyperdrive no se usa para TiDB en este proyecto porque no soporta el mecanismo de autenticacion `MySQL AuthSwitchRequest` usado por TiDB Cloud.

Configurar estas variables en el Worker:

```text
DB_HOST=gateway01.us-east-1.prod.aws.tidbcloud.com
DB_PORT=4000
DB_USER=usuario TiDB
DB_PASSWORD=password TiDB guardado
DB_NAME=reporte_detenciones
```

Tambien configurar:

```env
FRONTEND_URL=https://sistema-reporte-diario-produccion-detenciones.pages.dev
```

## Pruebas esperadas

Probar:

```text
https://URL-DEL-WORKER/api/health
https://URL-DEL-WORKER/api/health/db
https://URL-DEL-WORKER/api/lineas
https://URL-DEL-WORKER/api/indicadores
https://URL-DEL-WORKER/api/turnos
```

Cuando eso responda correctamente, actualizar `VITE_API_URL` en Cloudflare Pages y redeploy.
