# Plan maestro inicial

## Proyecto

Sistema Web de Reporte Diario de Produccion y Detenciones.

## Objetivo general

Reemplazar la planilla actual usada para registrar produccion diaria y detenciones por turno en una linea productiva, con una base web profesional, modular y preparada para crecer.

## Stack definido

- Frontend: React, Vite, TypeScript y Tailwind CSS.
- Backend: Node.js, Express y TypeScript.
- Base de datos inicial: MySQL local usando XAMPP.
- Repositorio: GitHub.
- Arquitectura futura: preparada para migrar a Cloudflare Pages/Workers con MySQL compatible como TiDB, o a servidor interno empresarial.

## Alcance de este primer avance

Este avance crea solo la estructura profesional inicial:

- Carpeta `frontend` con React, Vite, TypeScript y Tailwind.
- Carpeta `backend` con Express, TypeScript, dotenv, cors y mysql2.
- Carpeta `database` con `schema.sql`, `seed.sql` y `migrations`.
- Carpeta `docs` con documentacion local.
- Endpoints iniciales de salud y lectura de datos maestros activos.
- Primera pantalla funcional para validar frontend, backend y MySQL.

## Fuera de alcance por ahora

- Login.
- Usuarios.
- Permisos.
- CRUD completo.
- Logica completa de reporte del dia.
- Google Sheets.
- Apps Script.

## Decisiones de datos iniciales

- `dia_semana` usa numeracion ISO: 1=lunes, 2=martes, 3=miercoles, 4=jueves, 5=viernes, 6=sabado, 7=domingo.
- Los horarios de turno se guardan en `turno_horarios`; no quedan quemados en codigo.
- El turno C cruza medianoche y se marca con `cruza_medianoche = 1`.
- No se agrega indicador PP en los seeds iniciales.

## Siguiente paso recomendado

## Avance agregado: modulo de configuracion

El sistema ya incluye CRUD funcional para:

- Lineas.
- Indicadores.
- Turnos.
- Horarios de turnos.

Reglas aplicadas:

- Los datos se leen y guardan mediante API backend.
- No hay datos maestros quemados en frontend.
- No existen usuarios, login ni permisos.
- La eliminacion visible es desactivacion logica: `activa = 0` o `activo = 0`.
- La pantalla permite mostrar inactivos y reactivarlos mediante edicion.

## Avance agregado: modulo Reporte del Dia

El sistema ya incluye una pantalla operativa inicial para el reporte actual:

- Obtiene o crea automaticamente un reporte abierto con `GET /api/reportes/actual`.
- Permite seleccionar linea.
- Permite registrar OPINONA planificada y real.
- Permite registrar producciones programadas y realizadas.
- Permite registrar atraso o adelanto y minutos asociados.
- Permite registrar observacion general.
- Guarda automaticamente con debounce, sin boton Guardar.
- Muestra estado visual de guardado y ultima actualizacion.
- Calcula cumplimiento como `producciones_realizadas / producciones_programadas * 100`.
- Detecta turno actual usando horarios desde MySQL.
- Mantiene detenciones en 0 hasta construir el siguiente modulo.

Reglas aplicadas:

- Solo se edita un reporte en estado `abierto`.
- Los reportes `finalizado` quedan bloqueados desde el endpoint PATCH.
- No hay usuarios, login ni permisos.
- No se agregan detenciones todavia.

## Avance agregado: modulo de Detenciones

El sistema ya permite registrar detenciones dentro del Reporte del Dia:

- Crear detenciones con indicador, turno, hora inicio, hora fin opcional, descripcion y plan de accion opcional.
- Editar detenciones.
- Eliminar detenciones fisicamente.
- Calcular minutos automaticamente.
- Mantener detenciones abiertas sin hora fin.
- Actualizar minutos abiertos en vivo desde frontend cada 30 segundos.
- Detectar turno automatico usando horarios configurados en MySQL.
- Permitir editar manualmente el turno detectado.
- Validar cruce de medianoche cuando hora fin es menor que hora inicio.
- Mostrar tabla en escritorio y tarjetas en celular.
- Resaltar en rojo detenciones abiertas cuando faltan 50 minutos o menos para el fin del turno.

## Avance agregado: calculos y resumen superior

El sistema ya consolida calculos del reporte:

- Total general de minutos del dia.
- Total de detenciones.
- Total de detenciones abiertas.
- Cumplimiento de producciones.
- OPINONA planificada y real.
- Producciones programadas y realizadas.
- Minutos por indicador.
- Minutos por turno.

El backend expone `GET /api/reportes/:id/resumen` como respuesta consistente. El frontend recalcula en vivo los minutos de detenciones abiertas para mantener el resumen actualizado sin saturar el backend.

Reglas aplicadas:

- No hay estados manuales de detencion.
- Sin hora fin significa `abierta`.
- Con hora fin significa `cerrada`.
- No se agregan area responsable, estado manual ni producto/formato.
- No se pueden modificar detenciones de reportes finalizados.

## Finalizacion y PDF ejecutivo

- El reporte abierto se finaliza desde `POST /api/reportes/:id/finalizar`.
- Antes de finalizar se validan datos generales obligatorios.
- Si hay detenciones, ninguna puede quedar abierta sin hora fin.
- Al finalizar se congela `minutos_finales` en cada detencion.
- El reporte queda bloqueado para edicion.
- El PDF se genera desde `GET /api/reportes/:id/pdf` usando `pdfkit`.
- La seccion Informes lista reportes finalizados y permite descargar nuevamente el PDF.

## Informes historicos

- `GET /api/reportes/finalizados` lista reportes finalizados con filtros por fecha inicio, fecha fin y linea.
- `GET /api/reportes/:id/informe` devuelve la vista online completa de un reporte finalizado.
- Los informes online son solo lectura.
- El PDF no se guarda como archivo permanente; se regenera desde los datos guardados.
- La interfaz usa tabla en PC y tarjetas en celular.

## Dashboard historico

- `GET /api/dashboard` entrega metricas agregadas para reportes abiertos y finalizados.
- Los filtros disponibles son fecha inicio, fecha fin, linea y turno.
- El cumplimiento se calcula desde producciones totales.
- OPINONA planificada y real se muestran como promedio del rango.
- Los minutos se agrupan por indicador y turno.
- El ranking muestra las detenciones mas largas del periodo.
- El frontend usa `Recharts` para graficos responsivos.

## Avance agregado: cajas retenidas/rechazadas

El Reporte del Dia permite registrar opcionalmente cajas retenidas o rechazadas:

- La seccion se despliega mediante checkbox cuando aplica.
- Cada linea registra tipo, cantidad de cajas, ID de producto, nombre de producto y turno.
- Los datos se guardan en MySQL en `cajas_retenidas_rechazadas`.
- Los registros se pueden crear, editar y eliminar mientras el reporte esta abierto.
- Los informes online muestran las cajas en modo solo lectura.
- Pendiente para el cierre de PDF: incluir esta seccion en el PDF ejecutivo cuando se agrupen los cambios finales del PDF.

## Avance agregado: zonas de detenciones

Las detenciones ahora deben indicar la zona operacional donde ocurrieron:

- Zonas iniciales: Zona 1, Zona 2, Zona 3, Zona 4, Zona 5, Transporte General y Sala de Pulmones.
- Las zonas se administran desde Configuracion y se desactivan sin borrado fisico.
- El modal de detenciones exige seleccionar una zona activa.
- Los informes online muestran zona por detencion y resumen de minutos por zona.
- Pendiente para el cierre de PDF: incluir zona en el detalle de detenciones y resumen de minutos por zona junto con cajas retenidas/rechazadas.

## Siguiente paso recomendado

## Pulido final y preparacion para pruebas

El sistema queda preparado para pruebas funcionales completas:

- Interfaz clara, corporativa e industrial.
- Tablas en escritorio y tarjetas/listas en celular.
- Mensajes de guardado, carga y error entendibles para operador.
- Validaciones de cierre de reporte en backend.
- PDF regenerado desde datos guardados y descargable desde Informes.
- Variables de entorno separadas para frontend y backend.
- `.gitignore` preparado para evitar subir dependencias, builds, logs, `.env` y PDFs.
- Documentacion local actualizada.

## Migracion futura

La arquitectura conserva separacion entre frontend, backend y base de datos para migrar mas adelante a:

- Cloudflare Pages.
- Cloudflare Workers.
- TiDB u otra base MySQL compatible.
- Servidor interno empresarial.

No se implementa migracion todavia. Primero se recomienda validar operacion local con usuarios reales.

## Siguiente paso recomendado

Despues de validar esta version local, el siguiente avance natural es robustecer analitica:

- Comparativos por linea, turno e indicador.
- Exportacion adicional si el negocio la necesita.
