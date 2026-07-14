import type { Request, Response } from "express";
import { createCaja, deleteCaja, getCajasByReporteId, updateCaja } from "../services/cajaService.js";
import type { CajaRetenidaRechazadaInput, CajaTipo } from "../types/caja.js";

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

function parseCajaInput(body: Record<string, unknown>): CajaRetenidaRechazadaInput {
  const tipo = body.tipo;
  if (tipo !== "Retenida" && tipo !== "Rechazada") {
    throw Object.assign(new Error("tipo solo puede ser Retenida o Rechazada"), { statusCode: 400 });
  }

  const cantidad = Number(body.cantidad);
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw Object.assign(new Error("cantidad debe ser un entero mayor a 0"), { statusCode: 400 });
  }

  return {
    turno_id: parseId(body.turno_id, "turno_id"),
    tipo: tipo as CajaTipo,
    cantidad,
    producto_id: requiredText(body.producto_id, "producto_id"),
    producto_nombre: requiredText(body.producto_nombre, "producto_nombre")
  };
}

export async function listCajasController(request: Request, response: Response) {
  response.json(await getCajasByReporteId(parseId(request.params.id, "reporte_id")));
}

export async function createCajaController(request: Request, response: Response) {
  response.status(201).json(await createCaja(parseId(request.params.id, "reporte_id"), parseCajaInput(request.body)));
}

export async function updateCajaController(request: Request, response: Response) {
  response.json(await updateCaja(parseId(request.params.id, "caja_id"), parseCajaInput(request.body)));
}

export async function deleteCajaController(request: Request, response: Response) {
  response.json({
    message: "Registro eliminado correctamente",
    data: await deleteCaja(parseId(request.params.id, "caja_id"))
  });
}
