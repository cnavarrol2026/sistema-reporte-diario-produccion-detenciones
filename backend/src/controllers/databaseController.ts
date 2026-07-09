import type { Request, Response } from "express";
import { generateDatabaseBackupSql } from "../services/databaseBackupService.js";

export async function downloadDatabaseBackupController(_request: Request, response: Response) {
  const backupBuffer = await generateDatabaseBackupSql();
  response.setHeader("Content-Type", "application/sql; charset=utf-8");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="respaldo-reporte-detenciones-${new Date().toISOString().slice(0, 10)}.sql"`
  );
  response.send(backupBuffer);
}
