# Sistema Web de Reporte Diario de Produccion y Detenciones

Sistema web para registrar produccion diaria, detenciones por turno, cierres de reporte, informes historicos, PDF y dashboard operacional. Reemplaza la planilla como fuente principal y conserva una arquitectura separada para crecer.

## Stack tecnologico

- Frontend: React, Vite, TypeScript, Tailwind en modo navegador por restriccion local de seguridad.
- Backend local: Node.js, TypeScript, Express y servidor local `standalone`.
- Backend nube: Cloudflare Workers con variables de conexion TiDB.
- Base de datos local: MySQL con XAMPP.
- Base de datos nube: TiDB Cloud compatible con MySQL.
- PDF: `pdfkit`.
- Graficos: `Recharts`.

## Estructura

```text
reporte-detenciones/
├── frontend/
├── backend/
├── database/
├── docs/
├── README.md
└── .gitignore
```

## Requisitos

- XAMPP con MySQL activo.
- Node.js.
- PowerShell.
- Base de datos MySQL `reporte_detenciones`.

## Variables de entorno

Backend: copiar `backend/.env.example` a `backend/.env`.

```env
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=reporte_detenciones
FRONTEND_URL=http://localhost:5173
```

Frontend: copiar `frontend/.env.example` a `frontend/.env`.

```env
VITE_API_URL=http://localhost:4000/api
```

No subir archivos `.env` reales a GitHub.

## Instalacion local

Backend:

```powershell
cd "C:\xampp\htdocs\Sistema Web Reporte Diario\reporte-detenciones\backend"
npm.cmd install
Copy-Item .env.example .env
npm.cmd run build
npm.cmd run start
```

Frontend:

```powershell
cd "C:\xampp\htdocs\Sistema Web Reporte Diario\reporte-detenciones\frontend"
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

Abrir:

```text
http://localhost:5173
```

## Base de datos

Crear la base en MySQL/XAMPP:

```sql
CREATE DATABASE IF NOT EXISTS reporte_detenciones
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE reporte_detenciones;
SOURCE C:/xampp/htdocs/Sistema Web Reporte Diario/reporte-detenciones/database/schema.sql;
SOURCE C:/xampp/htdocs/Sistema Web Reporte Diario/reporte-detenciones/database/seed.sql;
```

Si la base ya existia antes del cierre de reportes:

```sql
SOURCE C:/xampp/htdocs/Sistema Web Reporte Diario/reporte-detenciones/database/migrations/2026_07_03_drop_unique_reporte_fecha_linea.sql;
```

## Modulos disponibles

- Configuracion: lineas, indicadores, turnos, horarios y zonas.
- Reporte del Dia: reporte abierto, autosave, producciones, OPINONA y observacion.
- Imagen del reporte: JPG/PNG obligatoria para finalizar, visible en informe online y excluida del PDF.
- Detenciones: crear, editar, eliminar, zona operacional, calculo de minutos y cruce de medianoche.
- Cajas retenidas/rechazadas: registro opcional por cantidad, producto y turno. Visible en Reporte del Dia e Informes. Pendiente de incorporar al PDF en el bloque final de cambios de PDF.
- Minutos por zona: visible en informes online. Pendiente de incorporar al PDF junto con cajas retenidas/rechazadas.
- Finalizacion: valida campos obligatorios, bloquea detenciones abiertas y congela minutos finales.
- Informes: consulta online de reportes finalizados y descarga de PDF.
- Dashboard: filtros por fecha, linea y turno, graficos y ranking.

## Flujo operativo

1. Configurar lineas, indicadores, turnos, horarios y zonas.
2. Abrir Reporte del Dia.
3. Completar datos generales.
4. Cargar imagen JPG/PNG del reporte.
5. Agregar detenciones cerradas o abiertas indicando zona.
6. Si corresponde, marcar cajas retenidas/rechazadas y registrar sus lineas.
7. Cerrar todas las detenciones antes de finalizar.
8. Presionar `Finalizar reporte`.
9. Descargar el PDF desde `Informes` cuando se necesite.
10. Revisar historicos y dashboard.

## Despliegue Cloudflare

Frontend:

- Cloudflare Pages.
- Root directory: `frontend`.
- Build command: `npm run build`.
- Build output directory: `dist`.

Backend API:

- Cloudflare Worker definido en `backend/wrangler.toml`.
- Entry point: `backend/src/worker.ts`.
- Requiere variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- Requiere variable `FRONTEND_URL` con la URL publica de Cloudflare Pages.

La URL del Worker debe configurarse en Cloudflare Pages como:

```env
VITE_API_URL=https://URL-DEL-WORKER/api
```

Las credenciales reales de TiDB se configuran en Cloudflare como variables/secretos. No deben guardarse en GitHub.

## Validaciones principales

El backend impide finalizar si faltan:

- Linea.
- OPINONA planificada.
- OPINONA real.
- Producciones programadas.
- Producciones realizadas.
- Tipo atraso/adelanto.
- Minutos atraso/adelanto.
- Observacion general.
- Imagen JPG/PNG del reporte.
- Datos obligatorios de detenciones.
- Hora fin en detenciones abiertas.

Los reportes finalizados no se pueden editar desde Reporte del Dia ni modificar sus detenciones.

## Pruebas rapidas

```text
http://localhost:4000/api/health
http://localhost:4000/api/health/db
http://localhost:4000/api/lineas
http://localhost:4000/api/reportes/actual
http://localhost:4000/api/dashboard
```

Builds:

```powershell
cd backend
npm.cmd run typecheck
npm.cmd run build

cd ..\frontend
npm.cmd run typecheck
npm.cmd run build
```

## Preparacion para GitHub

Antes de subir:

```powershell
git status
git add README.md docs database backend frontend .gitignore
git commit -m "Prepara sistema de reporte diario para pruebas funcionales"
git branch -M main
git remote add origin URL_DEL_REPOSITORIO
git push -u origin main
```

No subir:

- `node_modules/`
- `dist/`
- `.env`
- logs
- PDFs descargados
- archivos temporales

## Migracion futura

El proyecto queda documentado y separado para migrar mas adelante a:

- Cloudflare Pages para frontend.
- Cloudflare Workers o servidor interno para API.
- TiDB u otra base MySQL compatible.
- Servidor interno empresarial con MySQL/MariaDB.

La migracion no esta implementada todavia; el objetivo actual es dejar la version local estable para pruebas funcionales.
