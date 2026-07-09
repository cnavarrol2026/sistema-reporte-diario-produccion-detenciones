import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db/mysql.js";

const backupTables = [
  "lineas",
  "indicadores",
  "turnos",
  "turno_horarios",
  "reportes",
  "detenciones"
] as const;

function quoteIdentifier(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

function formatDateTime(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function sqlValue(value: unknown) {
  if (value === null || typeof value === "undefined") return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return `'${formatDateTime(value)}'`;
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;

  return `'${String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\0/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z")
    .replace(/'/g, "''")}'`;
}

async function getCreateTableSql(table: string) {
  const [rows] = await pool.query<(RowDataPacket & { "Create Table": string })[]>(`SHOW CREATE TABLE ${quoteIdentifier(table)}`);
  return rows[0]?.["Create Table"] ?? "";
}

async function getInsertStatements(table: string) {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${quoteIdentifier(table)}`);
  if (rows.length === 0) return [`-- Sin datos en ${table}`];

  return rows.map((row) => {
    const columns = Object.keys(row);
    const columnSql = columns.map(quoteIdentifier).join(", ");
    const valueSql = columns.map((column) => sqlValue(row[column])).join(", ");
    return `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES (${valueSql});`;
  });
}

export async function generateDatabaseBackupSql() {
  const lines: string[] = [
    "-- Respaldo Sistema Web de Reporte Diario de Produccion y Detenciones",
    `-- Generado: ${formatDateTime(new Date())}`,
    "",
    "SET FOREIGN_KEY_CHECKS = 0;",
    ""
  ];

  for (const table of [...backupTables].reverse()) {
    lines.push(`DROP TABLE IF EXISTS ${quoteIdentifier(table)};`);
  }

  lines.push("");

  for (const table of backupTables) {
    const createTableSql = await getCreateTableSql(table);
    lines.push(`-- Estructura ${table}`);
    lines.push(`${createTableSql};`);
    lines.push("");
  }

  for (const table of backupTables) {
    lines.push(`-- Datos ${table}`);
    lines.push(...await getInsertStatements(table));
    lines.push("");
  }

  lines.push("SET FOREIGN_KEY_CHECKS = 1;");
  lines.push("");

  return Buffer.from(lines.join("\n"), "utf8");
}
