import type { Request, Response } from "express";
import {
  finalizarReporte,
  getInformeReporte,
  getReporteActual,
  getReporteResumen,
  getReportesFinalizados,
  iniciarReporteActual,
  updateReporte
} from "../services/reporteService.js";
import { generateReportePdfBuffer } from "../services/pdfService.js";
import type { ReporteFinalizadoFilters, ReporteUpdateInput, TipoAtrasoAdelanto } from "../types/reporte.js";

function parseId(request: Request) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error("Id invalido"), { statusCode: 400 });
  }
  return id;
}

function parseOptionalNumber(value: unknown, field: string) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const parsed = Number(typeof value === "string" ? value.replace(",", ".") : value);
  if (!Number.isFinite(parsed)) {
    throw Object.assign(new Error(`${field} debe ser numerico`), { statusCode: 400 });
  }
  return parsed;
}

function parsePositiveNumber(value: unknown, field: string) {
  const parsed = parseOptionalNumber(value, field);
  if (parsed === null) return 0;
  if (parsed < 0) {
    throw Object.assign(new Error(`${field} debe ser positivo o cero`), { statusCode: 400 });
  }
  return parsed;
}

function parsePercent(value: unknown, field: string) {
  const parsed = parsePositiveNumber(value, field);
  if (parsed > 100) {
    throw Object.assign(new Error(`${field} debe ser menor o igual a 100`), { statusCode: 400 });
  }
  return parsed;
}

function parseLineaId(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error("linea_id debe ser un entero valido"), { statusCode: 400 });
  }
  return parsed;
}

function parseTipo(value: unknown): TipoAtrasoAdelanto | undefined {
  if (value === "" || value === null || typeof value === "undefined") return undefined;
  if (value !== "Atraso" && value !== "Adelanto") {
    throw Object.assign(new Error("tipo_atraso_adelanto solo puede ser Atraso o Adelanto"), { statusCode: 400 });
  }
  return value;
}

function parseDateFilter(value: unknown, field: string) {
  if (typeof value === "undefined" || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error(`${field} debe tener formato YYYY-MM-DD`), { statusCode: 400 });
  }
  return value;
}

function parseOptionalDateBody(value: unknown, field: string) {
  if (typeof value === "undefined" || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error(`${field} debe tener formato YYYY-MM-DD`), { statusCode: 400 });
  }
  return value;
}

function parseReportesFinalizadosFilters(query: Request["query"]): ReporteFinalizadoFilters {
  const filters: ReporteFinalizadoFilters = {
    fecha_inicio: parseDateFilter(query.fecha_inicio, "fecha_inicio"),
    fecha_fin: parseDateFilter(query.fecha_fin, "fecha_fin")
  };

  if (typeof query.linea_id !== "undefined" && query.linea_id !== "") {
    const parsed = Number(query.linea_id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw Object.assign(new Error("linea_id debe ser un entero valido"), { statusCode: 400 });
    }
    filters.linea_id = parsed;
  }

  return filters;
}

function parseReporteUpdate(body: Record<string, unknown>): ReporteUpdateInput {
  const input: ReporteUpdateInput = {};

  if ("fecha_reporte" in body) input.fecha_reporte = parseOptionalDateBody(body.fecha_reporte, "fecha_reporte");
  if ("linea_id" in body) input.linea_id = parseLineaId(body.linea_id);
  if ("opinona_planificada" in body) input.opinona_planificada = parsePercent(body.opinona_planificada, "opinona_planificada");
  if ("opinona_real" in body) input.opinona_real = parsePercent(body.opinona_real, "opinona_real");
  if ("producciones_programadas" in body) input.producciones_programadas = parsePositiveNumber(body.producciones_programadas, "producciones_programadas");
  if ("producciones_realizadas" in body) input.producciones_realizadas = parsePositiveNumber(body.producciones_realizadas, "producciones_realizadas");
  if ("tipo_atraso_adelanto" in body) input.tipo_atraso_adelanto = parseTipo(body.tipo_atraso_adelanto);
  if ("minutos_atraso_adelanto" in body) input.minutos_atraso_adelanto = parsePositiveNumber(body.minutos_atraso_adelanto, "minutos_atraso_adelanto");
  if ("observacion_general" in body) {
    input.observacion_general = typeof body.observacion_general === "string" && body.observacion_general.trim()
      ? body.observacion_general.trim()
      : null;
  }
  if ("imagen_reporte_data" in body) {
    input.imagen_reporte_data = typeof body.imagen_reporte_data === "string" && body.imagen_reporte_data.trim()
      ? body.imagen_reporte_data.trim()
      : null;
  }
  if ("imagen_reporte_mime" in body) {
    const mime = typeof body.imagen_reporte_mime === "string" ? body.imagen_reporte_mime : null;
    if (mime && mime !== "image/jpeg" && mime !== "image/png") {
      throw Object.assign(new Error("La imagen del reporte debe ser JPG o PNG"), { statusCode: 400 });
    }
    input.imagen_reporte_mime = mime;
  }
  if ("imagen_reporte_nombre" in body) {
    input.imagen_reporte_nombre = typeof body.imagen_reporte_nombre === "string" && body.imagen_reporte_nombre.trim()
      ? body.imagen_reporte_nombre.trim()
      : null;
  }

  return input;
}

export async function getReporteActualController(_request: Request, response: Response) {
  response.json(await getReporteActual());
}

export async function iniciarReporteController(request: Request, response: Response) {
  response.status(201).json(await iniciarReporteActual({
    fecha_reporte: parseOptionalDateBody(request.body?.fecha_reporte, "fecha_reporte")
  }));
}

export async function updateReporteController(request: Request, response: Response) {
  response.json(await updateReporte(parseId(request), parseReporteUpdate(request.body)));
}

export async function getReporteResumenController(request: Request, response: Response) {
  response.json(await getReporteResumen(parseId(request)));
}

export async function listReportesFinalizadosController(request: Request, response: Response) {
  response.json(await getReportesFinalizados(parseReportesFinalizadosFilters(request.query)));
}

export async function getInformeReporteController(request: Request, response: Response) {
  response.json(await getInformeReporte(parseId(request)));
}

export async function finalizarReporteController(request: Request, response: Response) {
  response.json(await finalizarReporte(parseId(request)));
}

export async function downloadReportePdfController(request: Request, response: Response) {
  const reporteId = parseId(request);
  const pdfBuffer = await generateReportePdfBuffer(reporteId);
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename="reporte-diario-${reporteId}.pdf"`);
  response.send(pdfBuffer);
}
