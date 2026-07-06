import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/mysql.js";
import { getReporteById } from "./reporteService.js";
import type { Detencion, DetencionInput } from "../types/detencion.js";

type DetencionRow = Detencion & RowDataPacket;

function assertOpenReporte(estado: string) {
  if (estado === "finalizado") {
    throw Object.assign(new Error("No se pueden modificar detenciones de un reporte finalizado"), { statusCode: 409 });
  }
}

function parseDateTime(value: string) {
  const parsed = new Date(value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) {
    throw Object.assign(new Error("Fecha u hora invalida"), { statusCode: 400 });
  }
  return parsed;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateTime(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function combineReportDateAndTime(fechaReporte: string, hora: string) {
  if (!/^\d{2}:\d{2}$/.test(hora)) {
    throw Object.assign(new Error("La hora debe tener formato HH:mm"), { statusCode: 400 });
  }
  return parseDateTime(`${fechaReporte} ${hora}:00`);
}

export function calculateMinutes(horaInicio: string | Date, horaFin?: string | Date | null) {
  const start = typeof horaInicio === "string" ? parseDateTime(horaInicio) : horaInicio;
  const end = horaFin ? (typeof horaFin === "string" ? parseDateTime(horaFin) : horaFin) : new Date();
  const diff = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  return diff;
}

function detencionSelectSql(whereClause: string) {
  return `SELECT
    d.id,
    d.reporte_id,
    d.indicador_id,
    i.codigo AS indicador_codigo,
    i.nombre AS indicador_nombre,
    i.color AS indicador_color,
    d.turno_id,
    t.codigo AS turno_codigo,
    t.nombre AS turno_nombre,
    DATE_FORMAT(d.hora_inicio, '%H:%i') AS hora_inicio,
    DATE_FORMAT(d.hora_fin, '%H:%i') AS hora_fin,
    d.descripcion,
    d.plan_accion,
    d.minutos_finales,
    CASE
      WHEN d.hora_fin IS NULL THEN TIMESTAMPDIFF(MINUTE, d.hora_inicio, NOW())
      ELSE TIMESTAMPDIFF(MINUTE, d.hora_inicio, d.hora_fin)
    END AS minutos_calculados,
    CASE WHEN d.hora_fin IS NULL THEN 'abierta' ELSE 'cerrada' END AS estado_calculado,
    DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    DATE_FORMAT(d.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
  FROM detenciones d
  INNER JOIN indicadores i ON i.id = d.indicador_id
  INNER JOIN turnos t ON t.id = d.turno_id
  ${whereClause}`;
}

export async function getDetencionesByReporteId(reporteId: number) {
  const [rows] = await pool.query<DetencionRow[]>(
    `${detencionSelectSql("WHERE d.reporte_id = ?")} ORDER BY d.hora_inicio ASC, d.id ASC`,
    [reporteId]
  );
  return rows.map((row) => ({
    ...row,
    minutos_calculados: Math.max(0, Number(row.minutos_calculados ?? 0))
  }));
}

async function getDetencionById(id: number) {
  const [rows] = await pool.query<DetencionRow[]>(`${detencionSelectSql("WHERE d.id = ?")} LIMIT 1`, [id]);
  return rows[0] ?? null;
}

async function assertActiveIndicador(indicadorId: number) {
  const [rows] = await pool.query<(RowDataPacket & { id: number })[]>(
    "SELECT id FROM indicadores WHERE id = ? AND activo = 1 LIMIT 1",
    [indicadorId]
  );
  if (!rows[0]) {
    throw Object.assign(new Error("El indicador debe existir y estar activo"), { statusCode: 400 });
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

function buildDateTimes(fechaReporte: string, input: DetencionInput) {
  const inicio = combineReportDateAndTime(fechaReporte, input.hora_inicio);
  let fin: Date | null = null;

  if (input.hora_fin) {
    fin = combineReportDateAndTime(fechaReporte, input.hora_fin);
    if (fin.getTime() < inicio.getTime()) {
      fin.setDate(fin.getDate() + 1);
    }
  }

  return {
    inicio,
    fin
  };
}

async function touchReporte(reporteId: number) {
  await pool.execute("UPDATE reportes SET ultima_actualizacion = NOW() WHERE id = ?", [reporteId]);
}

export async function createDetencion(reporteId: number, input: DetencionInput) {
  const reporte = await getReporteById(reporteId);
  if (!reporte) {
    throw Object.assign(new Error("Reporte no encontrado"), { statusCode: 404 });
  }
  assertOpenReporte(reporte.estado);
  await assertActiveIndicador(input.indicador_id);
  await assertActiveTurno(input.turno_id);

  const { inicio, fin } = buildDateTimes(reporte.fecha_reporte, input);
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO detenciones
      (reporte_id, indicador_id, turno_id, hora_inicio, hora_fin, descripcion, plan_accion, minutos_finales)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      reporteId,
      input.indicador_id,
      input.turno_id,
      formatDateTime(inicio),
      fin ? formatDateTime(fin) : null,
      input.descripcion.trim(),
      input.plan_accion?.trim() || null
    ]
  );
  await touchReporte(reporteId);
  return getDetencionById(result.insertId);
}

export async function updateDetencion(id: number, input: DetencionInput) {
  const current = await getDetencionById(id);
  if (!current) {
    throw Object.assign(new Error("Detencion no encontrada"), { statusCode: 404 });
  }

  const reporte = await getReporteById(current.reporte_id);
  if (!reporte) {
    throw Object.assign(new Error("Reporte no encontrado"), { statusCode: 404 });
  }
  assertOpenReporte(reporte.estado);
  await assertActiveIndicador(input.indicador_id);
  await assertActiveTurno(input.turno_id);

  const { inicio, fin } = buildDateTimes(reporte.fecha_reporte, input);
  await pool.execute(
    `UPDATE detenciones
    SET indicador_id = ?, turno_id = ?, hora_inicio = ?, hora_fin = ?, descripcion = ?, plan_accion = ?, minutos_finales = NULL
    WHERE id = ?`,
    [
      input.indicador_id,
      input.turno_id,
      formatDateTime(inicio),
      fin ? formatDateTime(fin) : null,
      input.descripcion.trim(),
      input.plan_accion?.trim() || null,
      id
    ]
  );
  await touchReporte(current.reporte_id);
  return getDetencionById(id);
}

export async function deleteDetencion(id: number) {
  const current = await getDetencionById(id);
  if (!current) {
    throw Object.assign(new Error("Detencion no encontrada"), { statusCode: 404 });
  }

  const reporte = await getReporteById(current.reporte_id);
  if (!reporte) {
    throw Object.assign(new Error("Reporte no encontrado"), { statusCode: 404 });
  }
  assertOpenReporte(reporte.estado);

  await pool.execute("DELETE FROM detenciones WHERE id = ?", [id]);
  await touchReporte(current.reporte_id);
  return current;
}
