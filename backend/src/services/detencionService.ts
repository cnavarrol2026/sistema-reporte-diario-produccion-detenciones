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

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

async function isAfterMidnightForCrossingShift(turnoId: number, hora: string) {
  const [rows] = await pool.query<(RowDataPacket & { hora_fin: string })[]>(
    `SELECT TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin
    FROM turno_horarios
    WHERE turno_id = ? AND activo = 1 AND cruza_medianoche = 1`,
    [turnoId]
  );
  const currentMinutes = timeToMinutes(hora);
  return rows.some((row) => currentMinutes < timeToMinutes(row.hora_fin));
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
    d.zona_id,
    z.nombre AS zona_nombre,
    DATE_FORMAT(d.hora_inicio, '%H:%i') AS hora_inicio,
    DATE_FORMAT(
      CASE
        WHEN DATE(d.hora_inicio) = (SELECT r.fecha_reporte FROM reportes r WHERE r.id = d.reporte_id)
          AND EXISTS (
            SELECT 1
            FROM turno_horarios th
            WHERE th.turno_id = d.turno_id
              AND th.activo = 1
              AND th.cruza_medianoche = 1
              AND TIME(d.hora_inicio) < th.hora_fin
          )
        THEN DATE_ADD(d.hora_inicio, INTERVAL 1 DAY)
        ELSE d.hora_inicio
      END,
      '%Y-%m-%d %H:%i:%s'
    ) AS hora_inicio_orden,
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
  INNER JOIN zonas z ON z.id = d.zona_id
  ${whereClause}`;
}

export async function getDetencionesByReporteId(reporteId: number) {
  const [rows] = await pool.query<DetencionRow[]>(
    `${detencionSelectSql("WHERE d.reporte_id = ?")} ORDER BY hora_inicio_orden ASC, d.id ASC`,
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

async function assertActiveZona(zonaId: number) {
  const [rows] = await pool.query<(RowDataPacket & { id: number })[]>(
    "SELECT id FROM zonas WHERE id = ? AND activo = 1 LIMIT 1",
    [zonaId]
  );
  if (!rows[0]) {
    throw Object.assign(new Error("La zona debe existir y estar activa"), { statusCode: 400 });
  }
}

async function buildDateTimes(fechaReporte: string, input: DetencionInput) {
  const inicio = combineReportDateAndTime(fechaReporte, input.hora_inicio);
  let fin: Date | null = null;

  if (await isAfterMidnightForCrossingShift(input.turno_id, input.hora_inicio)) {
    inicio.setDate(inicio.getDate() + 1);
  }

  if (input.hora_fin) {
    fin = combineReportDateAndTime(fechaReporte, input.hora_fin);
    if (await isAfterMidnightForCrossingShift(input.turno_id, input.hora_fin)) {
      fin.setDate(fin.getDate() + 1);
    }
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
  await assertActiveZona(input.zona_id);

  const { inicio, fin } = await buildDateTimes(reporte.fecha_reporte, input);
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO detenciones
      (reporte_id, indicador_id, turno_id, zona_id, hora_inicio, hora_fin, descripcion, plan_accion, minutos_finales)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      reporteId,
      input.indicador_id,
      input.turno_id,
      input.zona_id,
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
  await assertActiveZona(input.zona_id);

  const { inicio, fin } = await buildDateTimes(reporte.fecha_reporte, input);
  await pool.execute(
    `UPDATE detenciones
    SET indicador_id = ?, turno_id = ?, zona_id = ?, hora_inicio = ?, hora_fin = ?, descripcion = ?, plan_accion = ?, minutos_finales = NULL
    WHERE id = ?`,
    [
      input.indicador_id,
      input.turno_id,
      input.zona_id,
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
