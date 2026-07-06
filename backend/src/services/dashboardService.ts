import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db/mysql.js";
import type { DashboardBreakdownItem, DashboardFilters, DashboardRankingItem, DashboardResumen } from "../types/dashboard.js";

type TotalRow = RowDataPacket & {
  total_minutos: number | string | null;
  total_detenciones: number | string | null;
  producciones_programadas_total: number | string | null;
  producciones_realizadas_total: number | string | null;
  opinona_planificada_promedio: number | string | null;
  opinona_real_promedio: number | string | null;
};

type BreakdownRow = DashboardBreakdownItem & RowDataPacket;
type RankingRow = DashboardRankingItem & RowDataPacket;

function buildDashboardWhere(filters: DashboardFilters, alias = "r") {
  const where = [`${alias}.estado IN ('abierto', 'finalizado')`];
  const values: Array<string | number> = [];

  if (filters.fecha_inicio) {
    where.push(`${alias}.fecha_reporte >= ?`);
    values.push(filters.fecha_inicio);
  }
  if (filters.fecha_fin) {
    where.push(`${alias}.fecha_reporte <= ?`);
    values.push(filters.fecha_fin);
  }
  if (filters.linea_id) {
    where.push(`${alias}.linea_id = ?`);
    values.push(filters.linea_id);
  }

  return { where, values };
}

function buildDetencionesWhere(filters: DashboardFilters) {
  const base = buildDashboardWhere(filters, "r");
  const where = [...base.where];
  const values = [...base.values];

  if (filters.turno_id) {
    where.push("d.turno_id = ?");
    values.push(filters.turno_id);
  }

  return { where, values };
}

function minutesExpression() {
  return "GREATEST(0, COALESCE(d.minutos_finales, TIMESTAMPDIFF(MINUTE, d.hora_inicio, COALESCE(d.hora_fin, NOW()))))";
}

function toNumber(value: number | string | null | undefined) {
  return value === null || typeof value === "undefined" ? 0 : Number(value);
}

function toNullableNumber(value: number | string | null | undefined) {
  return value === null || typeof value === "undefined" ? null : Number(value);
}

export async function getDashboardResumen(filters: DashboardFilters = {}): Promise<DashboardResumen> {
  const reporteFilter = buildDashboardWhere(filters);
  const detencionFilter = buildDetencionesWhere(filters);

  const [totalRows] = await pool.query<TotalRow[]>(
    `SELECT
      COALESCE((SELECT SUM(${minutesExpression()})
        FROM detenciones d
        INNER JOIN reportes r ON r.id = d.reporte_id
        WHERE ${detencionFilter.where.join(" AND ")}), 0) AS total_minutos,
      COALESCE((SELECT COUNT(d.id)
        FROM detenciones d
        INNER JOIN reportes r ON r.id = d.reporte_id
        WHERE ${detencionFilter.where.join(" AND ")}), 0) AS total_detenciones,
      COALESCE(SUM(r.producciones_programadas), 0) AS producciones_programadas_total,
      COALESCE(SUM(r.producciones_realizadas), 0) AS producciones_realizadas_total,
      ROUND(AVG(r.opinona_planificada), 1) AS opinona_planificada_promedio,
      ROUND(AVG(r.opinona_real), 1) AS opinona_real_promedio
    FROM reportes r
    WHERE ${reporteFilter.where.join(" AND ")}`,
    [...detencionFilter.values, ...detencionFilter.values, ...reporteFilter.values]
  );

  const totals = totalRows[0];
  const programadas = toNumber(totals?.producciones_programadas_total);
  const realizadas = toNumber(totals?.producciones_realizadas_total);

  const [indicadores] = await pool.query<BreakdownRow[]>(
    `SELECT
      i.id,
      i.codigo,
      i.nombre,
      i.color,
      COALESCE(metricas.minutos, 0) AS minutos
    FROM indicadores i
    LEFT JOIN (
      SELECT d.indicador_id, SUM(${minutesExpression()}) AS minutos
      FROM detenciones d
      INNER JOIN reportes r ON r.id = d.reporte_id
      WHERE ${detencionFilter.where.join(" AND ")}
      GROUP BY d.indicador_id
    ) metricas ON metricas.indicador_id = i.id
    WHERE i.activo = 1
    ORDER BY minutos DESC, i.codigo ASC`,
    detencionFilter.values
  );

  const [turnos] = await pool.query<BreakdownRow[]>(
    `SELECT
      t.id,
      t.codigo,
      t.nombre,
      COALESCE(metricas.minutos, 0) AS minutos
    FROM turnos t
    LEFT JOIN (
      SELECT d.turno_id, SUM(${minutesExpression()}) AS minutos
      FROM detenciones d
      INNER JOIN reportes r ON r.id = d.reporte_id
      WHERE ${detencionFilter.where.join(" AND ")}
      GROUP BY d.turno_id
    ) metricas ON metricas.turno_id = t.id
    WHERE t.activo = 1 ${filters.turno_id ? "AND t.id = ?" : ""}
    ORDER BY t.codigo ASC`,
    filters.turno_id ? [...detencionFilter.values, filters.turno_id] : detencionFilter.values
  );

  const [ranking] = await pool.query<RankingRow[]>(
    `SELECT
      d.id,
      DATE_FORMAT(r.fecha_reporte, '%Y-%m-%d') AS fecha,
      l.nombre AS linea,
      i.nombre AS indicador,
      i.codigo AS indicador_codigo,
      t.nombre AS turno,
      ${minutesExpression()} AS minutos,
      d.descripcion
    FROM detenciones d
    INNER JOIN reportes r ON r.id = d.reporte_id
    INNER JOIN lineas l ON l.id = r.linea_id
    INNER JOIN indicadores i ON i.id = d.indicador_id
    INNER JOIN turnos t ON t.id = d.turno_id
    WHERE ${detencionFilter.where.join(" AND ")}
    ORDER BY minutos DESC, d.id DESC
    LIMIT 10`,
    detencionFilter.values
  );

  return {
    total_minutos: toNumber(totals?.total_minutos),
    total_detenciones: toNumber(totals?.total_detenciones),
    cumplimiento_promedio_o_calculado: programadas > 0 ? Number(((realizadas / programadas) * 100).toFixed(1)) : null,
    opinona_planificada_promedio: toNullableNumber(totals?.opinona_planificada_promedio),
    opinona_real_promedio: toNullableNumber(totals?.opinona_real_promedio),
    producciones_programadas_total: programadas,
    producciones_realizadas_total: realizadas,
    minutos_por_indicador: indicadores.map((item) => ({ ...item, minutos: toNumber(item.minutos) })),
    minutos_por_turno: turnos.map((item) => ({ ...item, minutos: toNumber(item.minutos) })),
    ranking_detenciones_largas: ranking.map((item) => ({ ...item, minutos: toNumber(item.minutos) }))
  };
}
