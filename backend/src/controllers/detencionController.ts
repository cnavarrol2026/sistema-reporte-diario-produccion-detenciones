import type { Request, Response } from "express";
import { createDetencion, deleteDetencion, getDetencionesByReporteId, updateDetencion } from "../services/detencionService.js";
import type { DetencionInput } from "../types/detencion.js";

function parseId(value: unknown, field: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error(`${field} invalido`), { statusCode: 400 });
  }
  return id;
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw Object.assign(new Error(`${field} es obligatorio`), { statusCode: 400 });
  }
  return value.trim();
}

function optionalText(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value.trim();
}

function optionalTime(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  return requiredText(value, "hora_fin");
}

function parseDetencionInput(body: Record<string, unknown>): DetencionInput {
  return {
    indicador_id: parseId(body.indicador_id, "indicador_id"),
    turno_id: parseId(body.turno_id, "turno_id"),
    hora_inicio: requiredText(body.hora_inicio, "hora_inicio"),
    hora_fin: optionalTime(body.hora_fin),
    descripcion: requiredText(body.descripcion, "descripcion"),
    plan_accion: optionalText(body.plan_accion)
  };
}

export async function listDetencionesController(request: Request, response: Response) {
  response.json(await getDetencionesByReporteId(parseId(request.params.id, "reporte_id")));
}

export async function createDetencionController(request: Request, response: Response) {
  response.status(201).json(await createDetencion(parseId(request.params.id, "reporte_id"), parseDetencionInput(request.body)));
}

export async function updateDetencionController(request: Request, response: Response) {
  response.json(await updateDetencion(parseId(request.params.id, "detencion_id"), parseDetencionInput(request.body)));
}

export async function deleteDetencionController(request: Request, response: Response) {
  response.json({
    message: "Detencion eliminada correctamente",
    data: await deleteDetencion(parseId(request.params.id, "detencion_id"))
  });
}
