import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/mysql.js";
import { getCajasByReporteId } from "./cajaService.js";
import { getDetencionesByReporteId } from "./detencionService.js";
import type {
  Reporte,
  ReporteFinalizadoFilters,
  ReporteFinalizadoListItem,
  ReporteUpdateInput,
  TipoAtrasoAdelanto
} from "../types/reporte.js";

type ReporteRow = Reporte & RowDataPacket;
type DetencionFinalizacionRow = RowDataPacket & {
  id: number;
  indicador_id: number | null;
  turno_id: number | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  descripcion: string | null;
};
type ReporteFinalizadoListRow = ReporteFinalizadoListItem & RowDataPacket;
type TurnoHorarioCalculoRow = RowDataPacket & {
  turno_id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  cruza_medianoche: number | boolean;
};

function toDbTipo(tipo: TipoAtrasoAdelanto) {
  return tipo === "Adelanto" ? "adelanto" : "atraso";
}

function validateDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error("fecha_reporte debe tener formato YYYY-MM-DD"), { statusCode: 400 });
  }
  return value;
}

function getSantiagoDateValue() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Santiago",
    year: "numeric"
  });
  return formatter.format(new Date());
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateTime(fecha: string, hora: string) {
  const parsed = new Date(`${fecha}T${hora}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function nextDate(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + 1);
  return copy;
}

function previousDate(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - 1);
  return copy;
}

function getIsoDay(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function getDetencionInterval(fechaReporte: string, detencion: { hora_inicio: string | null; hora_fin: string | null; estado_calculado?: string }) {
  if (!detencion.hora_inicio) return null;
  let start = parseDateTime(fechaReporte, detencion.hora_inicio);
  if (!start) return null;
  const now = new Date();

  if (!detencion.hora_fin) {
    if (detencion.estado_calculado === "abierta" && start.getTime() > now.getTime()) {
      start = previousDate(start);
    }
    return { start, end: now };
  }

  let end = parseDateTime(fechaReporte, detencion.hora_fin);
  if (!end) return null;
  if (end.getTime() < start.getTime()) {
    end = nextDate(end);
  }
  return { start, end };
}

function splitMinutesByTurno(
  fechaReporte: string,
  detencion: { turno_id: number; hora_inicio: string | null; hora_fin: string | null; estado_calculado?: string },
  horarios: TurnoHorarioCalculoRow[]
) {
  const interval = getDetencionInterval(fechaReporte, detencion);
  const result = new Map<number, number>();
  if (!interval || interval.end.getTime() <= interval.start.getTime()) return result;

  const cursor = new Date(interval.start);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - 1);

  for (let dayOffset = 0; dayOffset < 4; dayOffset += 1) {
    const currentDate = new Date(cursor);
    currentDate.setDate(cursor.getDate() + dayOffset);
    const isoDay = getIsoDay(currentDate);

    for (const horario of horarios) {
      if (Number(horario.dia_semana) !== isoDay) continue;

      const shiftStart = parseDateTime(dateInputValue(currentDate), horario.hora_inicio);
      let shiftEnd = parseDateTime(dateInputValue(currentDate), horario.hora_fin);
      if (!shiftStart || !shiftEnd) continue;
      if (Number(horario.cruza_medianoche) === 1 || shiftEnd.getTime() <= shiftStart.getTime()) {
        shiftEnd = nextDate(shiftEnd);
      }

      const overlapStart = new Date(Math.max(interval.start.getTime(), shiftStart.getTime()));
      const overlapEnd = new Date(Math.min(interval.end.getTime(), shiftEnd.getTime()));
      const minutes = minutesBetween(overlapStart, overlapEnd);
      if (minutes > 0) {
        result.set(horario.turno_id, (result.get(horario.turno_id) ?? 0) + minutes);
      }
    }
  }

  return result;
}

function reporteSelectSql(whereClause: string) {
  return `SELECT
    r.id,
    DATE_FORMAT(r.fecha_reporte, '%Y-%m-%d') AS fecha_reporte,
    r.linea_id,
    l.nombre AS linea_nombre,
    r.opinona_planificada,
    r.opinona_real,
    r.producciones_programadas,
    r.producciones_realizadas,
    CASE r.tipo_atraso_adelanto
      WHEN 'adelanto' THEN 'Adelanto'
      ELSE 'Atraso'
    END AS tipo_atraso_adelanto,
    r.minutos_atraso_adelanto,
    r.observacion_general,
    r.imagen_reporte_data,
    r.imagen_reporte_mime,
    r.imagen_reporte_nombre,
    r.estado,
    DATE_FORMAT(r.finalizado_at, '%Y-%m-%d %H:%i:%s') AS finalizado_at,
    DATE_FORMAT(r.ultima_actualizacion, '%Y-%m-%d %H:%i:%s') AS ultima_actualizacion,
    DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
    DATE_FORMAT(r.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
  FROM reportes r
  INNER JOIN lineas l ON l.id = r.linea_id
  ${whereClause}`;
}

export async function getReporteById(id: number) {
  const [rows] = await pool.query<ReporteRow[]>(`${reporteSelectSql("WHERE r.id = ?")} LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function getReportesFinalizados(filters: ReporteFinalizadoFilters = {}) {
  const where = ["r.estado = 'finalizado'"];
  const values: Array<string | number> = [];

  if (filters.fecha_inicio) {
    where.push("r.fecha_reporte >= ?");
    values.push(filters.fecha_inicio);
  }
  if (filters.fecha_fin) {
    where.push("r.fecha_reporte <= ?");
    values.push(filters.fecha_fin);
  }
  if (filters.linea_id) {
    where.push("r.linea_id = ?");
    values.push(filters.linea_id);
  }

  const [rows] = await pool.query<ReporteFinalizadoListRow[]>(
    `SELECT
      r.id,
      DATE_FORMAT(r.fecha_reporte, '%Y-%m-%d') AS fecha_reporte,
      r.linea_id,
      l.nombre AS linea_nombre,
      r.opinona_real,
      r.producciones_programadas,
      r.producciones_realizadas,
      CASE
        WHEN r.producciones_programadas > 0 THEN ROUND((r.producciones_realizadas / r.producciones_programadas) * 100, 1)
        ELSE NULL
      END AS cumplimiento,
      COALESCE(SUM(COALESCE(d.minutos_finales, TIMESTAMPDIFF(MINUTE, d.hora_inicio, d.hora_fin))), 0) AS total_minutos,
      COUNT(d.id) AS total_detenciones,
      DATE_FORMAT(r.finalizado_at, '%Y-%m-%d %H:%i:%s') AS finalizado_at
    FROM reportes r
    INNER JOIN lineas l ON l.id = r.linea_id
    LEFT JOIN detenciones d ON d.reporte_id = r.id
    WHERE ${where.join(" AND ")}
    GROUP BY r.id, r.fecha_reporte, r.linea_id, l.nombre, r.opinona_real, r.producciones_programadas,
      r.producciones_realizadas, r.finalizado_at
    ORDER BY r.finalizado_at DESC, r.id DESC`,
    values
  );

  return rows.map((row) => ({
    ...row,
    total_minutos: Number(row.total_minutos ?? 0),
    total_detenciones: Number(row.total_detenciones ?? 0),
    cumplimiento: row.cumplimiento === null ? null : Number(row.cumplimiento)
  }));
}

async function getPrimerLineaActivaId() {
  const [rows] = await pool.query<(RowDataPacket & { id: number })[]>(
    "SELECT id FROM lineas WHERE activa = 1 ORDER BY id LIMIT 1"
  );

  if (!rows[0]) {
    throw Object.assign(new Error("Debe existir al menos una linea activa para crear el reporte actual"), {
      statusCode: 400
    });
  }

  return rows[0].id;
}

export async function getReporteActual() {
  const [openRows] = await pool.query<ReporteRow[]>(
    `${reporteSelectSql("WHERE r.estado = 'abierto'")} ORDER BY r.created_at DESC LIMIT 1`
  );

  return openRows[0] ?? null;
}

export async function iniciarReporteActual(input: { fecha_reporte?: string } = {}) {
  const current = await getReporteActual();
  if (current) return current;

  const fechaReporte = input.fecha_reporte ? validateDateInput(input.fecha_reporte) : getSantiagoDateValue();
  const lineaId = await getPrimerLineaActivaId();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO reportes (
      fecha_reporte,
      linea_id,
      opinona_planificada,
      opinona_real,
      producciones_programadas,
      producciones_realizadas,
      tipo_atraso_adelanto,
      minutos_atraso_adelanto,
      observacion_general,
      estado,
      ultima_actualizacion
    ) VALUES (?, ?, 0, 0, 0, 0, 'atraso', 0, NULL, 'abierto', NOW())`,
    [fechaReporte, lineaId]
  );

  if (result.insertId) {
    const created = await getReporteById(result.insertId);
    if (created) return created;
  }

  const created = await getReporteActual();
  if (!created) {
    throw Object.assign(new Error("El reporte fue creado, pero no fue posible recuperarlo"), { statusCode: 500 });
  }
  return created;
}

export async function updateReporte(id: number, input: ReporteUpdateInput) {
  const current = await getReporteById(id);

  if (!current) {
    throw Object.assign(new Error("Reporte no encontrado"), { statusCode: 404 });
  }

  if (current.estado === "finalizado") {
    throw Object.assign(new Error("No se puede modificar un reporte finalizado"), { statusCode: 409 });
  }

  const fields: string[] = [];
  const values: Array<string | number | null> = [];

  if ("fecha_reporte" in input && input.fecha_reporte) {
    fields.push("fecha_reporte = ?");
    values.push(validateDateInput(input.fecha_reporte));
  }
  if ("linea_id" in input) {
    fields.push("linea_id = ?");
    values.push(input.linea_id ?? current.linea_id);
  }
  if ("opinona_planificada" in input) {
    fields.push("opinona_planificada = ?");
    values.push(input.opinona_planificada ?? 0);
  }
  if ("opinona_real" in input) {
    fields.push("opinona_real = ?");
    values.push(input.opinona_real ?? 0);
  }
  if ("producciones_programadas" in input) {
    fields.push("producciones_programadas = ?");
    values.push(input.producciones_programadas ?? 0);
  }
  if ("producciones_realizadas" in input) {
    fields.push("producciones_realizadas = ?");
    values.push(input.producciones_realizadas ?? 0);
  }
  if ("tipo_atraso_adelanto" in input && input.tipo_atraso_adelanto) {
    fields.push("tipo_atraso_adelanto = ?");
    values.push(toDbTipo(input.tipo_atraso_adelanto));
  }
  if ("minutos_atraso_adelanto" in input) {
    fields.push("minutos_atraso_adelanto = ?");
    values.push(input.minutos_atraso_adelanto ?? 0);
  }
  if ("observacion_general" in input) {
    fields.push("observacion_general = ?");
    values.push(input.observacion_general ?? null);
  }
  if ("imagen_reporte_data" in input) {
    fields.push("imagen_reporte_data = ?");
    values.push(input.imagen_reporte_data ?? null);
  }
  if ("imagen_reporte_mime" in input) {
    fields.push("imagen_reporte_mime = ?");
    values.push(input.imagen_reporte_mime ?? null);
  }
  if ("imagen_reporte_nombre" in input) {
    fields.push("imagen_reporte_nombre = ?");
    values.push(input.imagen_reporte_nombre ?? null);
  }

  if (fields.length === 0) {
    return current;
  }

  fields.push("ultima_actualizacion = NOW()");
  values.push(id);

  await pool.execute(`UPDATE reportes SET ${fields.join(", ")} WHERE id = ?`, values);
  return getReporteById(id);
}

export async function getReporteResumen(id: number) {
  const reporte = await getReporteById(id);

  if (!reporte) {
    throw Object.assign(new Error("Reporte no encontrado"), { statusCode: 404 });
  }

  const [indicadores] = await pool.query<(RowDataPacket & { id: number; codigo: string; nombre: string; color: string })[]>(
    "SELECT id, codigo, nombre, color FROM indicadores WHERE activo = 1 ORDER BY orden, codigo"
  );
  const [turnos] = await pool.query<(RowDataPacket & { id: number; codigo: string; nombre: string })[]>(
    "SELECT id, codigo, nombre FROM turnos WHERE activo = 1 ORDER BY codigo"
  );
  const [horarios] = await pool.query<TurnoHorarioCalculoRow[]>(
    `SELECT turno_id, dia_semana, TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
      TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin, cruza_medianoche
    FROM turno_horarios
    WHERE activo = 1`
  );
  const detenciones = await getDetencionesByReporteId(id);

  const minutosPorIndicador = new Map(indicadores.map((indicador) => [indicador.id, 0]));
  const minutosPorTurno = new Map(turnos.map((turno) => [turno.id, 0]));

  let totalMinutos = 0;
  let abiertas = 0;

  for (const detencion of detenciones) {
    const minutos =
      reporte.estado === "finalizado" && detencion.minutos_finales !== null
        ? Number(detencion.minutos_finales)
        : Number(detencion.minutos_calculados ?? 0);
    totalMinutos += minutos;
    minutosPorIndicador.set(detencion.indicador_id, (minutosPorIndicador.get(detencion.indicador_id) ?? 0) + minutos);
    const minutosRepartidos = splitMinutesByTurno(reporte.fecha_reporte, detencion, horarios);
    if (minutosRepartidos.size === 0) {
      minutosPorTurno.set(detencion.turno_id, (minutosPorTurno.get(detencion.turno_id) ?? 0) + minutos);
    } else {
      for (const [turnoId, turnoMinutos] of minutosRepartidos) {
        minutosPorTurno.set(turnoId, (minutosPorTurno.get(turnoId) ?? 0) + turnoMinutos);
      }
    }
    if (detencion.estado_calculado === "abierta") abiertas += 1;
  }

  const programadas = Number(reporte.producciones_programadas ?? 0);
  const realizadas = Number(reporte.producciones_realizadas ?? 0);

  return {
    reporte_id: reporte.id,
    total_minutos: totalMinutos,
    total_detenciones: detenciones.length,
    total_detenciones_abiertas: abiertas,
    cumplimiento: programadas > 0 ? Number(((realizadas / programadas) * 100).toFixed(1)) : null,
    total_por_indicador: indicadores.map((indicador) => ({
      id: indicador.id,
      codigo: indicador.codigo,
      nombre: indicador.nombre,
      color: indicador.color,
      minutos: minutosPorIndicador.get(indicador.id) ?? 0
    })),
    total_por_turno: turnos.map((turno) => ({
      id: turno.id,
      codigo: turno.codigo,
      nombre: turno.nombre,
      minutos: minutosPorTurno.get(turno.id) ?? 0
    })),
    opinona_planificada: reporte.opinona_planificada,
    opinona_real: reporte.opinona_real,
    producciones_programadas: reporte.producciones_programadas,
    producciones_realizadas: reporte.producciones_realizadas
  };
}

export async function getInformeReporte(id: number) {
  const reporte = await getReporteById(id);

  if (!reporte) {
    throw Object.assign(new Error("Reporte no encontrado"), { statusCode: 404 });
  }

  if (reporte.estado !== "finalizado") {
    throw Object.assign(new Error("Solo se pueden consultar informes finalizados"), { statusCode: 409 });
  }

  const [resumen, detenciones, cajas] = await Promise.all([
    getReporteResumen(id),
    getDetencionesByReporteId(id),
    getCajasByReporteId(id)
  ]);

  return {
    reporte,
    resumen,
    detenciones,
    cajas,
    total_por_indicador: resumen.total_por_indicador,
    total_por_turno: resumen.total_por_turno,
    observacion_general: reporte.observacion_general
  };
}

function isBlank(value: unknown) {
  return value === null || typeof value === "undefined" || (typeof value === "string" && value.trim().length === 0);
}

function validateReporteForFinalization(reporte: Reporte, detenciones: DetencionFinalizacionRow[]) {
  const missing: string[] = [];

  if (isBlank(reporte.fecha_reporte)) missing.push("Fecha del reporte");
  if (isBlank(reporte.linea_id)) missing.push("Linea seleccionada");
  if (isBlank(reporte.opinona_planificada)) missing.push("OPINONA planificada");
  if (isBlank(reporte.opinona_real)) missing.push("OPINONA real");
  if (isBlank(reporte.producciones_programadas)) missing.push("Producciones programadas");
  if (isBlank(reporte.producciones_realizadas)) missing.push("Producciones realizadas");
  if (isBlank(reporte.tipo_atraso_adelanto)) missing.push("Tipo atraso/adelanto");
  if (isBlank(reporte.minutos_atraso_adelanto)) missing.push("Minutos atraso/adelanto");
  if (isBlank(reporte.observacion_general)) missing.push("Observacion general");
  if (isBlank(reporte.imagen_reporte_data)) missing.push("Imagen JPG/PNG del reporte");

  let abiertas = 0;
  detenciones.forEach((detencion, index) => {
    const label = `Detencion ${index + 1}`;
    if (isBlank(detencion.indicador_id)) missing.push(`${label}: indicador`);
    if (isBlank(detencion.turno_id)) missing.push(`${label}: turno`);
    if (isBlank(detencion.hora_inicio)) missing.push(`${label}: hora inicio`);
    if (isBlank(detencion.descripcion)) missing.push(`${label}: descripcion`);
    if (isBlank(detencion.hora_fin)) abiertas += 1;
  });

  if (abiertas > 0) {
    missing.push(`${abiertas} detencion${abiertas === 1 ? "" : "es"} abierta${abiertas === 1 ? "" : "s"} sin hora final`);
  }

  if (missing.length > 0) {
    throw Object.assign(
      new Error(`No se puede finalizar el reporte. Faltan datos obligatorios:\n- ${missing.join("\n- ")}`),
      { statusCode: 400 }
    );
  }
}

async function getReporteByIdForConnection(connection: PoolConnection, id: number) {
  const [rows] = await connection.query<ReporteRow[]>(`${reporteSelectSql("WHERE r.id = ?")} LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function finalizarReporte(id: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const reporte = await getReporteByIdForConnection(connection, id);
    if (!reporte) {
      throw Object.assign(new Error("Reporte no encontrado"), { statusCode: 404 });
    }
    if (reporte.estado === "finalizado") {
      throw Object.assign(new Error("No se puede finalizar dos veces el mismo reporte"), { statusCode: 409 });
    }

    const [detenciones] = await connection.query<DetencionFinalizacionRow[]>(
      `SELECT id, indicador_id, turno_id, hora_inicio, hora_fin, descripcion
      FROM detenciones
      WHERE reporte_id = ?
      ORDER BY hora_inicio ASC, id ASC`,
      [id]
    );

    validateReporteForFinalization(reporte, detenciones);

    await connection.execute(
      `UPDATE detenciones
      SET minutos_finales = GREATEST(0, TIMESTAMPDIFF(MINUTE, hora_inicio, hora_fin))
      WHERE reporte_id = ?`,
      [id]
    );

    await connection.execute(
      `UPDATE reportes
      SET estado = 'finalizado',
          finalizado_at = NOW(),
          ultima_actualizacion = NOW()
      WHERE id = ?`,
      [id]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const reporteFinalizado = await getReporteById(id);
  if (!reporteFinalizado) {
    throw Object.assign(new Error("Reporte no encontrado"), { statusCode: 404 });
  }

  return {
    reporte: reporteFinalizado,
    resumen: await getReporteResumen(id),
    pdf_url: `/api/reportes/${id}/pdf`
  };
}
