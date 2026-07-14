import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/mysql.js";
import type { CajaRetenidaRechazada, CajaRetenidaRechazadaInput, CajaTipo } from "../types/caja.js";

type CajaRow = CajaRetenidaRechazada & RowDataPacket;

function assertOpenReporte(estado: string) {
  if (estado === "finalizado") {
    throw Object.assign(new Error("No se pueden modificar cajas de un reporte finalizado"), { statusCode: 409 });
  }
}

function toDbTipo(tipo: CajaTipo) {
  return tipo === "Rechazada" ? "rechazada" : "retenida";
}

function validateCajaInput(input: CajaRetenidaRechazadaInput) {
  if (input.tipo !== "Retenida" && input.tipo !== "Rechazada") {
    throw Object.assign(new Error("tipo solo puede ser Retenida o Rechazada"), { statusCode: 400 });
  }
  if (!Number.isInteger(input.cantidad) || input.cantidad <= 0) {
    throw Object.assign(new Error("La cantidad de cajas debe ser mayor a 0"), { statusCode: 400 });
  }
  if (!input.producto_id.trim()) {
    throw Object.assign(new Error("El ID del producto es obligatorio"), { statusCode: 400 });
  }
  if (!input.producto_nombre.trim()) {
    throw Object.assign(new Error("El nombre del producto es obligatorio"), { statusCode: 400 });
  }
}

async function assertActiveTurno(turnoId: number) {
  const [rows] = await pool.query<(RowDataPacket & { id: number })[]>(
    "SELECT id FROM turnos WHERE id = ? AND activo = 1 LIMIT 1",
    [turnoId]
  );
  if (!rows[0]) {
    throw Object.assign(new Error("El turno debe existir y estar activo"), { statusCode: 400 });
  }
}

async function getReporteState(reporteId: number) {
  const [rows] = await pool.query<(RowDataPacket & { id: number; estado: string })[]>(
    "SELECT id, estado FROM reportes WHERE id = ? LIMIT 1",
    [reporteId]
  );
  return rows[0] ?? null;
}

function cajaSelectSql(whereClause: string) {
  return `SELECT
    c.id,
    c.reporte_id,
    c.turno_id,
    t.codigo AS turno_codigo,
    t.nombre AS turno_nombre,
    CASE c.tipo
      WHEN 'rechazada' THEN 'Rechazada'
      ELSE 'Retenida'
    END AS tipo,
    c.cantidad,
    c.producto_id,
    c.producto_nombre,
    DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    DATE_FORMAT(c.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
  FROM cajas_retenidas_rechazadas c
  INNER JOIN turnos t ON t.id = c.turno_id
  ${whereClause}`;
}

export async function getCajasByReporteId(reporteId: number) {
  const [rows] = await pool.query<CajaRow[]>(
    `${cajaSelectSql("WHERE c.reporte_id = ?")} ORDER BY c.created_at ASC, c.id ASC`,
    [reporteId]
  );
  return rows.map((row) => ({
    ...row,
    cantidad: Number(row.cantidad)
  }));
}

async function getCajaById(id: number) {
  const [rows] = await pool.query<CajaRow[]>(`${cajaSelectSql("WHERE c.id = ?")} LIMIT 1`, [id]);
  const row = rows[0];
  return row ? { ...row, cantidad: Number(row.cantidad) } : null;
}

async function touchReporte(reporteId: number) {
  await pool.execute("UPDATE reportes SET ultima_actualizacion = NOW() WHERE id = ?", [reporteId]);
}

export async function createCaja(reporteId: number, input: CajaRetenidaRechazadaInput) {
  const reporte = await getReporteState(reporteId);
  if (!reporte) {
    throw Object.assign(new Error("Reporte no encontrado"), { statusCode: 404 });
  }
  assertOpenReporte(reporte.estado);
  validateCajaInput(input);
  await assertActiveTurno(input.turno_id);

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO cajas_retenidas_rechazadas
      (reporte_id, turno_id, tipo, cantidad, producto_id, producto_nombre)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      reporteId,
      input.turno_id,
      toDbTipo(input.tipo),
      input.cantidad,
      input.producto_id.trim(),
      input.producto_nombre.trim()
    ]
  );
  await touchReporte(reporteId);
  return getCajaById(result.insertId);
}

export async function updateCaja(id: number, input: CajaRetenidaRechazadaInput) {
  const current = await getCajaById(id);
  if (!current) {
    throw Object.assign(new Error("Registro de cajas no encontrado"), { statusCode: 404 });
  }

  const reporte = await getReporteState(current.reporte_id);
  if (!reporte) {
    throw Object.assign(new Error("Reporte no encontrado"), { statusCode: 404 });
  }
  assertOpenReporte(reporte.estado);
  validateCajaInput(input);
  await assertActiveTurno(input.turno_id);

  await pool.execute(
    `UPDATE cajas_retenidas_rechazadas
    SET turno_id = ?, tipo = ?, cantidad = ?, producto_id = ?, producto_nombre = ?
    WHERE id = ?`,
    [
      input.turno_id,
      toDbTipo(input.tipo),
      input.cantidad,
      input.producto_id.trim(),
      input.producto_nombre.trim(),
      id
    ]
  );
  await touchReporte(current.reporte_id);
  return getCajaById(id);
}

export async function deleteCaja(id: number) {
  const current = await getCajaById(id);
  if (!current) {
    throw Object.assign(new Error("Registro de cajas no encontrado"), { statusCode: 404 });
  }

  const reporte = await getReporteState(current.reporte_id);
  if (!reporte) {
    throw Object.assign(new Error("Reporte no encontrado"), { statusCode: 404 });
  }
  assertOpenReporte(reporte.estado);

  await pool.execute("DELETE FROM cajas_retenidas_rechazadas WHERE id = ?", [id]);
  await touchReporte(current.reporte_id);
  return current;
}
