import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/mysql.js";
import type {
  Indicador,
  IndicadorInput,
  Linea,
  LineaInput,
  Turno,
  TurnoHorario,
  TurnoHorarioInput,
  TurnoInput,
  Zona,
  ZonaInput
} from "../types/configuration.js";

function activeFilter(column: "activa" | "activo", incluirInactivas: boolean) {
  return incluirInactivas ? "" : `WHERE ${column} = 1`;
}

function toDbBoolean(value: boolean | undefined, defaultValue = true) {
  return (value ?? defaultValue) ? 1 : 0;
}

export async function getLineas(incluirInactivas = false) {
  const [rows] = await pool.query<(Linea & RowDataPacket)[]>(
    `SELECT id, nombre, activa FROM lineas ${activeFilter("activa", incluirInactivas)} ORDER BY activa DESC, nombre`
  );
  return rows;
}

export async function getLineaById(id: number) {
  const [rows] = await pool.query<(Linea & RowDataPacket)[]>(
    "SELECT id, nombre, activa FROM lineas WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] ?? null;
}

export async function createLinea(input: LineaInput) {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO lineas (nombre, activa) VALUES (?, ?)",
    [input.nombre.trim(), toDbBoolean(input.activa)]
  );
  return getLineaById(result.insertId);
}

export async function updateLinea(id: number, input: LineaInput) {
  await pool.execute("UPDATE lineas SET nombre = ?, activa = ? WHERE id = ?", [
    input.nombre.trim(),
    toDbBoolean(input.activa),
    id
  ]);
  return getLineaById(id);
}

export async function deactivateLinea(id: number) {
  await pool.execute("UPDATE lineas SET activa = 0 WHERE id = ?", [id]);
  return getLineaById(id);
}

export async function getIndicadores(incluirInactivas = false) {
  const [rows] = await pool.query<(Indicador & RowDataPacket)[]>(
    `SELECT id, codigo, nombre, color, orden, activo
    FROM indicadores
    ${activeFilter("activo", incluirInactivas)}
    ORDER BY activo DESC, orden, codigo`
  );
  return rows;
}

export async function getIndicadorById(id: number) {
  const [rows] = await pool.query<(Indicador & RowDataPacket)[]>(
    "SELECT id, codigo, nombre, color, orden, activo FROM indicadores WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] ?? null;
}

export async function createIndicador(input: IndicadorInput) {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO indicadores (codigo, nombre, color, orden, activo) VALUES (?, ?, ?, ?, ?)",
    [input.codigo.trim().toUpperCase(), input.nombre.trim(), input.color.trim(), input.orden, toDbBoolean(input.activo)]
  );
  return getIndicadorById(result.insertId);
}

export async function updateIndicador(id: number, input: IndicadorInput) {
  await pool.execute(
    "UPDATE indicadores SET codigo = ?, nombre = ?, color = ?, orden = ?, activo = ? WHERE id = ?",
    [input.codigo.trim().toUpperCase(), input.nombre.trim(), input.color.trim(), input.orden, toDbBoolean(input.activo), id]
  );
  return getIndicadorById(id);
}

export async function deactivateIndicador(id: number) {
  await pool.execute("UPDATE indicadores SET activo = 0 WHERE id = ?", [id]);
  return getIndicadorById(id);
}

export async function getTurnos(incluirInactivas = false) {
  const [rows] = await pool.query<(Turno & RowDataPacket)[]>(
    `SELECT id, codigo, nombre, activo FROM turnos ${activeFilter("activo", incluirInactivas)} ORDER BY activo DESC, codigo`
  );
  return rows;
}

export async function getTurnoById(id: number) {
  const [rows] = await pool.query<(Turno & RowDataPacket)[]>(
    "SELECT id, codigo, nombre, activo FROM turnos WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] ?? null;
}

export async function createTurno(input: TurnoInput) {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO turnos (codigo, nombre, activo) VALUES (?, ?, ?)",
    [input.codigo.trim().toUpperCase(), input.nombre.trim(), toDbBoolean(input.activo)]
  );
  return getTurnoById(result.insertId);
}

export async function updateTurno(id: number, input: TurnoInput) {
  await pool.execute("UPDATE turnos SET codigo = ?, nombre = ?, activo = ? WHERE id = ?", [
    input.codigo.trim().toUpperCase(),
    input.nombre.trim(),
    toDbBoolean(input.activo),
    id
  ]);
  return getTurnoById(id);
}

export async function deactivateTurno(id: number) {
  await pool.execute("UPDATE turnos SET activo = 0 WHERE id = ?", [id]);
  return getTurnoById(id);
}

export async function getZonas(incluirInactivas = false) {
  const [rows] = await pool.query<(Zona & RowDataPacket)[]>(
    `SELECT id, nombre, activo FROM zonas ${activeFilter("activo", incluirInactivas)} ORDER BY activo DESC, nombre`
  );
  return rows;
}

export async function getZonaById(id: number) {
  const [rows] = await pool.query<(Zona & RowDataPacket)[]>(
    "SELECT id, nombre, activo FROM zonas WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] ?? null;
}

export async function createZona(input: ZonaInput) {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO zonas (nombre, activo) VALUES (?, ?)",
    [input.nombre.trim(), toDbBoolean(input.activo)]
  );
  return getZonaById(result.insertId);
}

export async function updateZona(id: number, input: ZonaInput) {
  await pool.execute("UPDATE zonas SET nombre = ?, activo = ? WHERE id = ?", [
    input.nombre.trim(),
    toDbBoolean(input.activo),
    id
  ]);
  return getZonaById(id);
}

export async function deactivateZona(id: number) {
  await pool.execute("UPDATE zonas SET activo = 0 WHERE id = ?", [id]);
  return getZonaById(id);
}

export async function getTurnoHorarios(incluirInactivas = false) {
  const where = incluirInactivas ? "" : "WHERE th.activo = 1 AND t.activo = 1";
  const [rows] = await pool.query<(TurnoHorario & RowDataPacket)[]>(
    `SELECT
      th.id,
      th.turno_id,
      t.codigo AS turno_codigo,
      t.nombre AS turno_nombre,
      th.dia_semana,
      TIME_FORMAT(th.hora_inicio, '%H:%i') AS hora_inicio,
      TIME_FORMAT(th.hora_fin, '%H:%i') AS hora_fin,
      th.cruza_medianoche,
      th.activo
    FROM turno_horarios th
    INNER JOIN turnos t ON t.id = th.turno_id
    ${where}
    ORDER BY th.activo DESC, th.dia_semana, t.codigo`
  );
  return rows;
}

export async function getTurnoHorarioById(id: number) {
  const [rows] = await pool.query<(TurnoHorario & RowDataPacket)[]>(
    `SELECT
      th.id,
      th.turno_id,
      t.codigo AS turno_codigo,
      t.nombre AS turno_nombre,
      th.dia_semana,
      TIME_FORMAT(th.hora_inicio, '%H:%i') AS hora_inicio,
      TIME_FORMAT(th.hora_fin, '%H:%i') AS hora_fin,
      th.cruza_medianoche,
      th.activo
    FROM turno_horarios th
    INNER JOIN turnos t ON t.id = th.turno_id
    WHERE th.id = ?
    LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createTurnoHorario(input: TurnoHorarioInput) {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO turno_horarios
      (turno_id, dia_semana, hora_inicio, hora_fin, cruza_medianoche, activo)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.turno_id,
      input.dia_semana,
      input.hora_inicio,
      input.hora_fin,
      toDbBoolean(input.cruza_medianoche, false),
      toDbBoolean(input.activo)
    ]
  );
  return getTurnoHorarioById(result.insertId);
}

export async function updateTurnoHorario(id: number, input: TurnoHorarioInput) {
  await pool.execute(
    `UPDATE turno_horarios
    SET turno_id = ?, dia_semana = ?, hora_inicio = ?, hora_fin = ?, cruza_medianoche = ?, activo = ?
    WHERE id = ?`,
    [
      input.turno_id,
      input.dia_semana,
      input.hora_inicio,
      input.hora_fin,
      toDbBoolean(input.cruza_medianoche, false),
      toDbBoolean(input.activo),
      id
    ]
  );
  return getTurnoHorarioById(id);
}

export async function deactivateTurnoHorario(id: number) {
  await pool.execute("UPDATE turno_horarios SET activo = 0 WHERE id = ?", [id]);
  return getTurnoHorarioById(id);
}
