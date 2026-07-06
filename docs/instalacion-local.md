# Instalacion local

## Requisitos

- XAMPP con MySQL activo.
- Node.js instalado.
- PowerShell o terminal equivalente.

## 1. Crear base de datos y tablas

Abrir MySQL desde XAMPP y ejecutar:

```sql
SOURCE C:/xampp/htdocs/Sistema Web Reporte Diario/reporte-detenciones/database/schema.sql;
```

Luego cargar datos iniciales:

```sql
SOURCE C:/xampp/htdocs/Sistema Web Reporte Diario/reporte-detenciones/database/seed.sql;
```

Tambien puedes ejecutar ambos archivos desde phpMyAdmin importandolos en este orden:

1. `database/schema.sql`
2. `database/seed.sql`

Si la base ya existia antes del modulo de finalizacion, ejecutar una vez:

```sql
SOURCE C:/xampp/htdocs/Sistema Web Reporte Diario/reporte-detenciones/database/migrations/2026_07_03_drop_unique_reporte_fecha_linea.sql;
```

Esta migracion quita la restriccion unica por `fecha_reporte + linea_id`, porque al finalizar un reporte el sistema debe poder crear un nuevo reporte abierto en blanco.

## 2. Configurar backend

Entrar a la carpeta backend:

```powershell
cd "C:\xampp\htdocs\Sistema Web Reporte Diario\reporte-detenciones\backend"
```

Instalar dependencias:

```powershell
npm install
```

En PowerShell de Windows, si la politica de ejecucion bloquea scripts, usar:

```powershell
npm.cmd install
```

Crear el archivo `.env` copiando `.env.example`:

```powershell
Copy-Item .env.example .env
```

Valores iniciales esperados:

```env
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=reporte_detenciones
FRONTEND_URL=http://localhost:5173
```

Levantar backend:

```powershell
npm run dev
```

Si se usa el servidor local sin Express por restricciones del entorno:

```powershell
npm.cmd start
```

Probar salud del backend:

```text
http://localhost:4000/api/health
```

Probar conexion a MySQL:

```text
http://localhost:4000/api/health/db
```

Probar datos maestros:

```text
http://localhost:4000/api/lineas
http://localhost:4000/api/indicadores
http://localhost:4000/api/turnos
http://localhost:4000/api/turno-horarios
```

Probar reporte actual:

```text
http://localhost:4000/api/reportes/actual
```

Para incluir registros inactivos:

```text
http://localhost:4000/api/lineas?incluirInactivas=true
http://localhost:4000/api/indicadores?incluirInactivas=true
http://localhost:4000/api/turnos?incluirInactivas=true
http://localhost:4000/api/turno-horarios?incluirInactivas=true
```

## 3. Configurar frontend

Abrir otra terminal y entrar a frontend:

```powershell
cd "C:\xampp\htdocs\Sistema Web Reporte Diario\reporte-detenciones\frontend"
```

Instalar dependencias:

```powershell
npm install
```

En PowerShell de Windows, si la politica de ejecucion bloquea scripts, usar:

```powershell
npm.cmd install
```

Crear el archivo `.env` copiando `.env.example`:

```powershell
Copy-Item .env.example .env
```

Levantar frontend:

```powershell
npm run dev
```

O con el ejecutable CMD:

```powershell
npm.cmd run dev
```

Abrir:

```text
http://localhost:5173
```

Nota sobre Tailwind en este entorno:

En algunos equipos corporativos, la seguridad bloquea `source-map-js/lib/util.js`, usado por PostCSS/Tailwind local. Para evitar ese bloqueo, el proyecto deja desactivado `postcss.config.js` como `postcss.config.disabled.js` y carga Tailwind en modo navegador desde `index.html`.

Esto permite ejecutar Vite sin el error de `Cannot find module './util'`.

Si en el futuro el equipo permite ese archivo o se usa un entorno sin bloqueo, se puede volver al pipeline local renombrando `postcss.config.disabled.js` a `postcss.config.js` y reinstalando:

```powershell
npm.cmd install tailwindcss postcss autoprefixer
```

## 4. Validacion esperada

La pantalla inicial debe mostrar:

- Estado del backend funcionando.
- Cantidad de lineas activas.
- Cantidad de indicadores activos.
- Cantidad de turnos activos.
- Listado de lineas, indicadores y horarios consultados desde MySQL.

Si los datos no aparecen, revisar en este orden:

1. MySQL activo en XAMPP.
2. Base de datos `reporte_detenciones` creada.
3. `schema.sql` ejecutado antes que `seed.sql`.
4. Archivo `backend/.env` con credenciales correctas.
5. Backend activo en `http://localhost:4000`.

## Administrar configuracion

Entrar al frontend y abrir la seccion `Configuracion`.

Desde esa pantalla se puede:

- Ver lineas, indicadores, turnos y horarios.
- Agregar registros.
- Editar registros.
- Desactivar registros.
- Mostrar inactivos.
- Reactivar registros cambiando su estado a activo.

Los botones de desactivar no borran fisicamente los datos. El backend solo cambia `activa` o `activo` a falso para conservar historial.

Los dias de semana se guardan como numero ISO:

- 1 lunes
- 2 martes
- 3 miercoles
- 4 jueves
- 5 viernes
- 6 sabado
- 7 domingo

El turno C cruza medianoche y sus horarios deben tener `cruza_medianoche` activo.

## Usar Reporte del Dia

Entrar al frontend y abrir `Reporte del dia`.

Al cargar la pantalla:

- El backend busca un reporte abierto.
- Si no existe, crea uno automaticamente en estado `abierto`.
- Usa la primera linea activa como linea inicial.

La pantalla permite modificar:

- Linea.
- OPINONA planificada.
- OPINONA real.
- Producciones programadas.
- Producciones realizadas.
- Tipo de atraso/adelanto.
- Minutos atraso/adelanto.
- Observacion general.
- Imagen JPG/PNG del reporte.

No hay boton Guardar. El sistema guarda automaticamente despues de una pausa breve al escribir.

Estados visuales:

- `Guardando...`
- `Guardado correctamente`
- `Error al guardar`

El cumplimiento se calcula en frontend:

```text
producciones_realizadas / producciones_programadas * 100
```

Si producciones programadas esta vacio o es 0, se muestra `Pendiente`.

El turno actual se calcula con los horarios activos desde MySQL. Para horarios que cruzan medianoche, como el turno C, se considera el dia de inicio y la madrugada del dia siguiente.

## Usar Detenciones

Dentro de `Reporte del dia`, presionar `Agregar detencion`.

El modal permite registrar:

- Indicador.
- Hora inicio.
- Turno detectado automaticamente, editable.
- Hora fin opcional.
- Descripcion.
- Plan de accion opcional.

Reglas de minutos:

- Si hay hora inicio y hora fin, se calcula la diferencia.
- Si hora fin es menor que hora inicio, se asume cruce de medianoche.
- Si no hay hora fin, la detencion queda abierta y los minutos se actualizan en vivo desde frontend.

Ejemplos:

```text
10:20 a 10:45 = 25 minutos
22:50 a 00:20 = 90 minutos
```

Endpoints:

```text
GET    /api/reportes/:id/resumen
GET    /api/reportes/:id/detenciones
POST   /api/reportes/:id/detenciones
PATCH  /api/detenciones/:id
DELETE /api/detenciones/:id
```

Las detenciones se pueden eliminar fisicamente. No se usa borrado logico para este modulo.

Una detencion abierta se resalta en rojo cuando faltan 50 minutos o menos para terminar el turno correspondiente.

## Resumen y calculos

El endpoint de resumen es:

```text
GET /api/reportes/:id/resumen
```

Devuelve:

- `total_minutos`
- `total_detenciones`
- `total_detenciones_abiertas`
- `cumplimiento`
- `total_por_indicador`
- `total_por_turno`
- OPINONA y producciones del reporte.

En pantalla, los minutos de detenciones abiertas se actualizan en vivo cada 30 segundos usando la hora actual del equipo.

## Finalizar reporte

En `Reporte del dia`, presionar `Finalizar reporte`.

El backend valida:

- Linea seleccionada.
- OPINONA planificada y real.
- Producciones programadas y realizadas.
- Tipo atraso/adelanto.
- Minutos atraso/adelanto.
- Observacion general.
- Imagen JPG/PNG del reporte.
- Detenciones con indicador, turno, hora inicio y descripcion.
- Ninguna detencion abierta sin hora fin.

Si falta algo, la pantalla muestra el detalle y no finaliza el reporte.

Si todo esta correcto:

- Se congelan los `minutos_finales`.
- El reporte pasa a `finalizado`.
- El PDF queda disponible para descarga desde la seccion `Informes`.
- `GET /api/reportes/actual` abre un nuevo reporte en blanco.

Endpoints:

```text
POST /api/reportes/:id/finalizar
GET  /api/reportes/:id/pdf
GET  /api/reportes
```

La seccion `Informes` muestra reportes finalizados y permite descargar nuevamente el PDF.
La imagen del reporte se muestra en el informe online debajo de detenciones, pero no se incluye en el PDF.

## Usar Informes Historicos

Entrar al frontend y abrir `Informes`.

La pantalla permite:

- Ver reportes finalizados.
- Filtrar por fecha inicio.
- Filtrar por fecha fin.
- Filtrar por linea.
- Abrir la vista online de un informe.
- Descargar nuevamente el PDF.

Endpoints:

```text
GET /api/reportes/finalizados
GET /api/reportes/finalizados?fecha_inicio=2026-07-01&fecha_fin=2026-07-31&linea_id=2
GET /api/reportes/:id/informe
GET /api/reportes/:id/pdf
```

La vista online del informe es solo lectura. No muestra formularios ni permite editar datos finalizados.

Si un reporte no tiene detenciones, la vista muestra:

```text
Este reporte no registro detenciones.
```

## Usar Dashboard Historico

Entrar al frontend y abrir `Dashboard`.

La pantalla permite:

- Ver datos del dia actual.
- Seleccionar semana completa.
- Usar rango personalizado.
- Filtrar por linea.
- Filtrar por turno.
- Ver minutos por indicador.
- Ver minutos por turno.
- Ver ranking de detenciones mas largas.
- Comparar cumplimiento, OPINONA y producciones.

Endpoint:

```text
GET /api/dashboard
GET /api/dashboard?fecha_inicio=2026-07-01&fecha_fin=2026-07-31&linea_id=2&turno_id=1
```

El dashboard incluye reportes abiertos y finalizados. En reportes finalizados usa `minutos_finales`; en reportes abiertos calcula minutos desde hora inicio y hora fin, o desde hora inicio hasta la hora actual si la detencion esta abierta.

Los graficos del frontend usan `Recharts`.
