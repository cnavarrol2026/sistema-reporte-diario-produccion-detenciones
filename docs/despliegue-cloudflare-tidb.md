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

## Hyperdrive

Crear un Hyperdrive en Cloudflare conectado a TiDB:

```text
Host: gateway01.us-east-1.prod.aws.tidbcloud.com
Port: 4000
Database: reporte_detenciones
Username: usuario TiDB
Password: password TiDB guardado
```

En el Worker agregar binding:

```text
Variable name: HYPERDRIVE
Type: Hyperdrive
Value: configuracion Hyperdrive creada
```

Tambien agregar variable:

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
