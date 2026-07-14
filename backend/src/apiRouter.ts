import { URL } from "node:url";
import { testDatabaseConnection } from "./db/mysql.js";
import { generateDatabaseBackupSql } from "./services/databaseBackupService.js";
import { getDashboardResumen } from "./services/dashboardService.js";
import { createCaja, deleteCaja, getCajasByReporteId, updateCaja } from "./services/cajaService.js";
import {
  createIndicador,
  createLinea,
  createTurno,
  createTurnoHorario,
  deactivateIndicador,
  deactivateLinea,
  deactivateTurno,
  deactivateTurnoHorario,
  getIndicadores,
  getLineas,
  getTurnoHorarios,
  getTurnos,
  updateIndicador,
  updateLinea,
  updateTurno,
  updateTurnoHorario
} from "./services/configurationService.js";
import { createDetencion, deleteDetencion, getDetencionesByReporteId, updateDetencion } from "./services/detencionService.js";
import { generateReportePdfBuffer } from "./services/pdfService.js";
import {
  finalizarReporte,
  getInformeReporte,
  getReporteActual,
  getReporteResumen,
  getReportesFinalizados,
  iniciarReporteActual,
  updateReporte
} from "./services/reporteService.js";
import type { DashboardFilters } from "./types/dashboard.js";
import type { DetencionInput } from "./types/detencion.js";
import type { CajaRetenidaRechazadaInput, CajaTipo } from "./types/caja.js";
import type { IndicadorInput, LineaInput, TurnoHorarioInput, TurnoInput } from "./types/configuration.js";
import type { ReporteFinalizadoFilters, ReporteUpdateInput, TipoAtrasoAdelanto } from "./types/reporte.js";

export type Method = "GET" | "POST" | "PATCH" | "DELETE";
export type RouteResult =
  | { statusCode: number; payload: unknown }
  | { statusCode: number; body: Buffer; contentType: string; filename?: string };

function parseId(value: string | undefined, name = "id") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error(`${name} invalido`), { statusCode: 400 });
  }
  return id;
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw Object.assign(new Error(`${field} es obligatorio`), { statusCode: 400 });
  }
  return value.trim();
}

function optionalBool(value: unknown, defaultValue = true) {
  return typeof value === "boolean" ? value : defaultValue;
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const number = Number(typeof value === "string" ? value.replace(",", ".") : value);
  if (!Number.isFinite(number) || number < 0) {
    throw Object.assign(new Error("Valor numerico invalido"), { statusCode: 400 });
  }
  return number;
}

function parseLinea(body: Record<string, unknown>): LineaInput {
  return {
    nombre: requiredText(body.nombre, "nombre"),
    activa: optionalBool(body.activa)
  };
}

function parseIndicador(body: Record<string, unknown>): IndicadorInput {
  return {
    codigo: requiredText(body.codigo, "codigo"),
    nombre: requiredText(body.nombre, "nombre"),
    color: requiredText(body.color, "color"),
    orden: Number(optionalNumber(body.orden) ?? 0),
    activo: optionalBool(body.activo)
  };
}

function parseTurno(body: Record<string, unknown>): TurnoInput {
  return {
    codigo: requiredText(body.codigo, "codigo"),
    nombre: requiredText(body.nombre, "nombre"),
    activo: optionalBool(body.activo)
  };
}

function parseTurnoHorario(body: Record<string, unknown>): TurnoHorarioInput {
  return {
    turno_id: parseId(String(body.turno_id), "turno_id"),
    dia_semana: parseId(String(body.dia_semana), "dia_semana"),
    hora_inicio: requiredText(body.hora_inicio, "hora_inicio"),
    hora_fin: requiredText(body.hora_fin, "hora_fin"),
    cruza_medianoche: optionalBool(body.cruza_medianoche, false),
    activo: optionalBool(body.activo)
  };
}

function parseReporte(body: Record<string, unknown>): ReporteUpdateInput {
  const tipo = body.tipo_atraso_adelanto;
  if (typeof tipo !== "undefined" && tipo !== "Atraso" && tipo !== "Adelanto") {
    throw Object.assign(new Error("tipo_atraso_adelanto solo puede ser Atraso o Adelanto"), { statusCode: 400 });
  }
  const imagenMime = typeof body.imagen_reporte_mime === "string" ? body.imagen_reporte_mime : null;
  if (imagenMime && imagenMime !== "image/jpeg" && imagenMime !== "image/png") {
    throw Object.assign(new Error("La imagen del reporte debe ser JPG o PNG"), { statusCode: 400 });
  }

  return {
    fecha_reporte: "fecha_reporte" in body ? parseOptionalDateBody(body.fecha_reporte, "fecha_reporte") : undefined,
    linea_id: typeof body.linea_id === "undefined" ? undefined : parseId(String(body.linea_id), "linea_id"),
    opinona_planificada: "opinona_planificada" in body ? optionalNumber(body.opinona_planificada) : undefined,
    opinona_real: "opinona_real" in body ? optionalNumber(body.opinona_real) : undefined,
    producciones_programadas: "producciones_programadas" in body ? optionalNumber(body.producciones_programadas) : undefined,
    producciones_realizadas: "producciones_realizadas" in body ? optionalNumber(body.producciones_realizadas) : undefined,
    tipo_atraso_adelanto: tipo as TipoAtrasoAdelanto | undefined,
    minutos_atraso_adelanto: "minutos_atraso_adelanto" in body ? Number(optionalNumber(body.minutos_atraso_adelanto) ?? 0) : undefined,
    observacion_general: typeof body.observacion_general === "string" && body.observacion_general.trim() ? body.observacion_general.trim() : null,
    imagen_reporte_data: "imagen_reporte_data" in body && typeof body.imagen_reporte_data === "string" && body.imagen_reporte_data.trim()
      ? body.imagen_reporte_data.trim()
      : "imagen_reporte_data" in body ? null : undefined,
    imagen_reporte_mime: "imagen_reporte_mime" in body ? imagenMime : undefined,
    imagen_reporte_nombre: "imagen_reporte_nombre" in body && typeof body.imagen_reporte_nombre === "string" && body.imagen_reporte_nombre.trim()
      ? body.imagen_reporte_nombre.trim()
      : "imagen_reporte_nombre" in body ? null : undefined
  };
}

function parseDetencion(body: Record<string, unknown>): DetencionInput {
  return {
    indicador_id: parseId(String(body.indicador_id), "indicador_id"),
    turno_id: parseId(String(body.turno_id), "turno_id"),
    hora_inicio: requiredText(body.hora_inicio, "hora_inicio"),
    hora_fin: typeof body.hora_fin === "string" && body.hora_fin.trim() ? body.hora_fin.trim() : null,
    descripcion: requiredText(body.descripcion, "descripcion"),
    plan_accion: typeof body.plan_accion === "string" && body.plan_accion.trim() ? body.plan_accion.trim() : null
  };
}

function parseDateFilter(value: string | null, field: string) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error(`${field} debe tener formato YYYY-MM-DD`), { statusCode: 400 });
  }
  return value;
}

function parseCaja(body: Record<string, unknown>): CajaRetenidaRechazadaInput {
  const tipo = body.tipo;
  if (tipo !== "Retenida" && tipo !== "Rechazada") {
    throw Object.assign(new Error("tipo solo puede ser Retenida o Rechazada"), { statusCode: 400 });
  }

  const cantidad = Number(body.cantidad);
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw Object.assign(new Error("cantidad debe ser un entero mayor a 0"), { statusCode: 400 });
  }

  return {
    turno_id: parseId(String(body.turno_id), "turno_id"),
    tipo: tipo as CajaTipo,
    cantidad,
    producto_id: requiredText(body.producto_id, "producto_id"),
    producto_nombre: requiredText(body.producto_nombre, "producto_nombre")
  };
}

function parseOptionalDateBody(value: unknown, field: string) {
  if (typeof value === "undefined" || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error(`${field} debe tener formato YYYY-MM-DD`), { statusCode: 400 });
  }
  return value;
}

function parseFinalizadosFilters(url: URL): ReporteFinalizadoFilters {
  const filters: ReporteFinalizadoFilters = {
    fecha_inicio: parseDateFilter(url.searchParams.get("fecha_inicio"), "fecha_inicio"),
    fecha_fin: parseDateFilter(url.searchParams.get("fecha_fin"), "fecha_fin")
  };
  const lineaId = url.searchParams.get("linea_id");
  if (lineaId) filters.linea_id = parseId(lineaId, "linea_id");
  return filters;
}

function parseDashboardFilters(url: URL): DashboardFilters {
  const filters: DashboardFilters = {
    fecha_inicio: parseDateFilter(url.searchParams.get("fecha_inicio"), "fecha_inicio"),
    fecha_fin: parseDateFilter(url.searchParams.get("fecha_fin"), "fecha_fin")
  };
  const lineaId = url.searchParams.get("linea_id");
  const turnoId = url.searchParams.get("turno_id");
  if (lineaId) filters.linea_id = parseId(lineaId, "linea_id");
  if (turnoId) filters.turno_id = parseId(turnoId, "turno_id");
  return filters;
}

export async function routeApi(method: Method, url: URL, body: Record<string, unknown>): Promise<RouteResult> {
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const includeInactive = url.searchParams.get("incluirInactivas") === "true";

  if (method === "GET" && parts.join("/") === "health") {
    return { statusCode: 200, payload: { status: "ok", message: "Backend funcionando correctamente" } };
  }
  if (method === "GET" && parts.join("/") === "health/db") {
    await testDatabaseConnection();
    return { statusCode: 200, payload: { status: "ok", message: "Conexion a MySQL funcionando correctamente" } };
  }
  if (method === "GET" && parts.join("/") === "dashboard") {
    return { statusCode: 200, payload: await getDashboardResumen(parseDashboardFilters(url)) };
  }
  if (method === "GET" && parts.join("/") === "database/backup") {
    return {
      statusCode: 200,
      body: await generateDatabaseBackupSql(),
      contentType: "application/sql; charset=utf-8",
      filename: `respaldo-reporte-detenciones-${new Date().toISOString().slice(0, 10)}.sql`
    };
  }

  if (parts[0] === "lineas") {
    if (method === "GET") return { statusCode: 200, payload: await getLineas(includeInactive) };
    if (method === "POST") return { statusCode: 201, payload: await createLinea(parseLinea(body)) };
    if (method === "PATCH") return { statusCode: 200, payload: await updateLinea(parseId(parts[1]), parseLinea(body)) };
    if (method === "DELETE") return { statusCode: 200, payload: { message: "Registro desactivado correctamente", data: await deactivateLinea(parseId(parts[1])) } };
  }

  if (parts[0] === "indicadores") {
    if (method === "GET") return { statusCode: 200, payload: await getIndicadores(includeInactive) };
    if (method === "POST") return { statusCode: 201, payload: await createIndicador(parseIndicador(body)) };
    if (method === "PATCH") return { statusCode: 200, payload: await updateIndicador(parseId(parts[1]), parseIndicador(body)) };
    if (method === "DELETE") return { statusCode: 200, payload: { message: "Registro desactivado correctamente", data: await deactivateIndicador(parseId(parts[1])) } };
  }

  if (parts[0] === "turnos") {
    if (method === "GET") return { statusCode: 200, payload: await getTurnos(includeInactive) };
    if (method === "POST") return { statusCode: 201, payload: await createTurno(parseTurno(body)) };
    if (method === "PATCH") return { statusCode: 200, payload: await updateTurno(parseId(parts[1]), parseTurno(body)) };
    if (method === "DELETE") return { statusCode: 200, payload: { message: "Registro desactivado correctamente", data: await deactivateTurno(parseId(parts[1])) } };
  }

  if (parts[0] === "turno-horarios") {
    if (method === "GET") return { statusCode: 200, payload: await getTurnoHorarios(includeInactive) };
    if (method === "POST") return { statusCode: 201, payload: await createTurnoHorario(parseTurnoHorario(body)) };
    if (method === "PATCH") return { statusCode: 200, payload: await updateTurnoHorario(parseId(parts[1]), parseTurnoHorario(body)) };
    if (method === "DELETE") return { statusCode: 200, payload: { message: "Registro desactivado correctamente", data: await deactivateTurnoHorario(parseId(parts[1])) } };
  }

  if (parts[0] === "reportes" && parts[1] === "actual" && method === "GET") {
    return { statusCode: 200, payload: await getReporteActual() };
  }
  if (parts[0] === "reportes" && parts[1] === "iniciar" && method === "POST") {
    return { statusCode: 201, payload: await iniciarReporteActual({ fecha_reporte: parseOptionalDateBody(body.fecha_reporte, "fecha_reporte") }) };
  }
  if (parts[0] === "reportes" && parts[1] === "finalizados" && method === "GET") {
    return { statusCode: 200, payload: await getReportesFinalizados(parseFinalizadosFilters(url)) };
  }
  if (parts[0] === "reportes" && parts.length === 1 && method === "GET") {
    return { statusCode: 200, payload: await getReportesFinalizados(parseFinalizadosFilters(url)) };
  }
  if (parts[0] === "reportes" && parts[2] === "informe" && method === "GET") {
    return { statusCode: 200, payload: await getInformeReporte(parseId(parts[1], "reporte_id")) };
  }
  if (parts[0] === "reportes" && parts[2] === "resumen" && method === "GET") {
    return { statusCode: 200, payload: await getReporteResumen(parseId(parts[1], "reporte_id")) };
  }
  if (parts[0] === "reportes" && parts[2] === "pdf" && method === "GET") {
    const reporteId = parseId(parts[1], "reporte_id");
    return {
      statusCode: 200,
      body: await generateReportePdfBuffer(reporteId),
      contentType: "application/pdf",
      filename: `reporte-diario-${reporteId}.pdf`
    };
  }
  if (parts[0] === "reportes" && parts[2] === "finalizar" && method === "POST") {
    return { statusCode: 200, payload: await finalizarReporte(parseId(parts[1], "reporte_id")) };
  }
  if (parts[0] === "reportes" && parts[2] === "detenciones") {
    const reporteId = parseId(parts[1], "reporte_id");
    if (method === "GET") return { statusCode: 200, payload: await getDetencionesByReporteId(reporteId) };
    if (method === "POST") return { statusCode: 201, payload: await createDetencion(reporteId, parseDetencion(body)) };
  }
  if (parts[0] === "reportes" && parts[2] === "cajas") {
    const reporteId = parseId(parts[1], "reporte_id");
    if (method === "GET") return { statusCode: 200, payload: await getCajasByReporteId(reporteId) };
    if (method === "POST") return { statusCode: 201, payload: await createCaja(reporteId, parseCaja(body)) };
  }
  if (parts[0] === "reportes" && method === "PATCH") {
    return { statusCode: 200, payload: await updateReporte(parseId(parts[1], "reporte_id"), parseReporte(body)) };
  }
  if (parts[0] === "detenciones") {
    if (method === "PATCH") return { statusCode: 200, payload: await updateDetencion(parseId(parts[1], "detencion_id"), parseDetencion(body)) };
    if (method === "DELETE") return { statusCode: 200, payload: { message: "Detencion eliminada correctamente", data: await deleteDetencion(parseId(parts[1], "detencion_id")) } };
  }
  if (parts[0] === "cajas") {
    if (method === "PATCH") return { statusCode: 200, payload: await updateCaja(parseId(parts[1], "caja_id"), parseCaja(body)) };
    if (method === "DELETE") return { statusCode: 200, payload: { message: "Registro eliminado correctamente", data: await deleteCaja(parseId(parts[1], "caja_id")) } };
  }

  return { statusCode: 404, payload: { status: "error", message: "Ruta no encontrada" } };
}
