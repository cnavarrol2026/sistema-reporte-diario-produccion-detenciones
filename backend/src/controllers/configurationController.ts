import type { Request, Response } from "express";
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
} from "../services/configurationService.js";
import type { IndicadorInput, LineaInput, TurnoHorarioInput, TurnoInput } from "../types/configuration.js";

function shouldIncludeInactive(request: Request) {
  return request.query.incluirInactivas === "true";
}

function parseId(request: Request) {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error("Id invalido"), { statusCode: 400 });
  }
  return id;
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw Object.assign(new Error(`${field} es obligatorio`), { statusCode: 400 });
  }
  return value.trim();
}

function requiredNumber(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw Object.assign(new Error(`${field} debe ser numerico`), { statusCode: 400 });
  }
  return parsed;
}

function requiredInteger(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw Object.assign(new Error(`${field} debe ser un numero entero`), { statusCode: 400 });
  }
  return parsed;
}

function optionalBoolean(value: unknown, defaultValue = true) {
  return typeof value === "boolean" ? value : defaultValue;
}

function parseLineaInput(body: Record<string, unknown>): LineaInput {
  return {
    nombre: requiredText(body.nombre, "nombre"),
    activa: optionalBoolean(body.activa)
  };
}

function parseIndicadorInput(body: Record<string, unknown>): IndicadorInput {
  return {
    codigo: requiredText(body.codigo, "codigo"),
    nombre: requiredText(body.nombre, "nombre"),
    color: requiredText(body.color, "color"),
    orden: requiredNumber(body.orden, "orden"),
    activo: optionalBoolean(body.activo)
  };
}

function parseTurnoInput(body: Record<string, unknown>): TurnoInput {
  return {
    codigo: requiredText(body.codigo, "codigo"),
    nombre: requiredText(body.nombre, "nombre"),
    activo: optionalBoolean(body.activo)
  };
}

function parseTurnoHorarioInput(body: Record<string, unknown>): TurnoHorarioInput {
  const diaSemana = requiredInteger(body.dia_semana, "dia_semana");
  if (diaSemana < 1 || diaSemana > 7) {
    throw Object.assign(new Error("dia_semana debe estar entre 1 y 7"), { statusCode: 400 });
  }

  return {
    turno_id: requiredInteger(body.turno_id, "turno_id"),
    dia_semana: diaSemana,
    hora_inicio: requiredText(body.hora_inicio, "hora_inicio"),
    hora_fin: requiredText(body.hora_fin, "hora_fin"),
    cruza_medianoche: optionalBoolean(body.cruza_medianoche, false),
    activo: optionalBoolean(body.activo)
  };
}

export async function listLineas(request: Request, response: Response) {
  response.json(await getLineas(shouldIncludeInactive(request)));
}

export async function createLineaController(request: Request, response: Response) {
  response.status(201).json(await createLinea(parseLineaInput(request.body)));
}

export async function updateLineaController(request: Request, response: Response) {
  response.json(await updateLinea(parseId(request), parseLineaInput(request.body)));
}

export async function deleteLineaController(request: Request, response: Response) {
  response.json({
    message: "Registro desactivado correctamente",
    data: await deactivateLinea(parseId(request))
  });
}

export async function listIndicadores(request: Request, response: Response) {
  response.json(await getIndicadores(shouldIncludeInactive(request)));
}

export async function createIndicadorController(request: Request, response: Response) {
  response.status(201).json(await createIndicador(parseIndicadorInput(request.body)));
}

export async function updateIndicadorController(request: Request, response: Response) {
  response.json(await updateIndicador(parseId(request), parseIndicadorInput(request.body)));
}

export async function deleteIndicadorController(request: Request, response: Response) {
  response.json({
    message: "Registro desactivado correctamente",
    data: await deactivateIndicador(parseId(request))
  });
}

export async function listTurnos(request: Request, response: Response) {
  response.json(await getTurnos(shouldIncludeInactive(request)));
}

export async function createTurnoController(request: Request, response: Response) {
  response.status(201).json(await createTurno(parseTurnoInput(request.body)));
}

export async function updateTurnoController(request: Request, response: Response) {
  response.json(await updateTurno(parseId(request), parseTurnoInput(request.body)));
}

export async function deleteTurnoController(request: Request, response: Response) {
  response.json({
    message: "Registro desactivado correctamente",
    data: await deactivateTurno(parseId(request))
  });
}

export async function listTurnoHorarios(request: Request, response: Response) {
  response.json(await getTurnoHorarios(shouldIncludeInactive(request)));
}

export async function createTurnoHorarioController(request: Request, response: Response) {
  response.status(201).json(await createTurnoHorario(parseTurnoHorarioInput(request.body)));
}

export async function updateTurnoHorarioController(request: Request, response: Response) {
  response.json(await updateTurnoHorario(parseId(request), parseTurnoHorarioInput(request.body)));
}

export async function deleteTurnoHorarioController(request: Request, response: Response) {
  response.json({
    message: "Registro desactivado correctamente",
    data: await deactivateTurnoHorario(parseId(request))
  });
}
