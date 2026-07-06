import type { Request, Response } from "express";
import { testDatabaseConnection } from "../db/mysql.js";

export function getHealth(_request: Request, response: Response) {
  response.json({
    status: "ok",
    message: "Backend funcionando correctamente"
  });
}

export async function getDatabaseHealth(_request: Request, response: Response) {
  try {
    await testDatabaseConnection();
    response.json({
      status: "ok",
      message: "Conexion a MySQL funcionando correctamente"
    });
  } catch (error) {
    response.status(500).json({
      status: "error",
      message: "No fue posible conectar con MySQL",
      detail: error instanceof Error ? error.message : "Error desconocido"
    });
  }
}
