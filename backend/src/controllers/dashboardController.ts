import type { Request, Response } from "express";
import { getDashboardResumen } from "../services/dashboardService.js";
import type { DashboardFilters } from "../types/dashboard.js";

function parseDateFilter(value: unknown, field: string) {
  if (typeof value === "undefined" || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error(`${field} debe tener formato YYYY-MM-DD`), { statusCode: 400 });
  }
  return value;
}

function parseOptionalId(value: unknown, field: string) {
  if (typeof value === "undefined" || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${field} debe ser un entero valido`), { statusCode: 400 });
  }
  return parsed;
}

function parseDashboardFilters(query: Request["query"]): DashboardFilters {
  return {
    fecha_inicio: parseDateFilter(query.fecha_inicio, "fecha_inicio"),
    fecha_fin: parseDateFilter(query.fecha_fin, "fecha_fin"),
    linea_id: parseOptionalId(query.linea_id, "linea_id"),
    turno_id: parseOptionalId(query.turno_id, "turno_id")
  };
}

export async function getDashboardController(request: Request, response: Response) {
  response.json(await getDashboardResumen(parseDashboardFilters(request.query)));
}
