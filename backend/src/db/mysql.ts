import { connect, type Connection, type FullResult, type Tx } from "@tidbcloud/serverless";
import mysql, { type Pool } from "mysql2/promise";

type WorkerDatabaseEnv = {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
};

let localPool: Pool | null = null;
let workerDatabaseEnv: WorkerDatabaseEnv | null = null;
let serverlessConnection: Connection<{ url: string; fullResult: true }> | null = null;

export function configureWorkerDatabase(env: WorkerDatabaseEnv) {
  workerDatabaseEnv = env;
}

function getServerlessConnection() {
  if (!workerDatabaseEnv) {
    throw new Error("La base de datos del Worker no esta configurada");
  }

  if (!serverlessConnection) {
    const user = encodeURIComponent(workerDatabaseEnv.user);
    const password = encodeURIComponent(workerDatabaseEnv.password);
    const host = `${workerDatabaseEnv.host}:${workerDatabaseEnv.port}`;
    const database = encodeURIComponent(workerDatabaseEnv.database);
    serverlessConnection = connect({
      url: `mysql://${user}:${password}@${host}/${database}`,
      fullResult: true
    });
  }

  return serverlessConnection;
}

function getLocalPool() {
  if (!localPool) {
    localPool = mysql.createPool({
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "reporte_detenciones",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      namedPlaceholders: true
    });
  }

  return localPool;
}

function toMysqlLikeResult(result: FullResult) {
  if (result.rows) return [result.rows, []];

  return [{
    affectedRows: result.rowsAffected ?? result.rowCount ?? 0,
    insertId: result.lastInsertId ? Number(result.lastInsertId) : 0,
    warningStatus: 0
  }, []];
}

async function executeServerless(sql: string, values?: unknown[]) {
  const result = await getServerlessConnection().execute(sql, values ?? [], { fullResult: true });
  return toMysqlLikeResult(result);
}

function createServerlessTransactionalConnection() {
  let transaction: Tx<{ url: string; fullResult: true }> | null = null;

  return {
    beginTransaction: async () => {
      transaction = await getServerlessConnection().begin();
    },
    query: async (sql: string, values?: unknown[]) => {
      if (!transaction) throw new Error("La transaccion no esta iniciada");
      const result = await transaction.execute(sql, values ?? [], { fullResult: true });
      return toMysqlLikeResult(result);
    },
    execute: async (sql: string, values?: unknown[]) => {
      if (!transaction) throw new Error("La transaccion no esta iniciada");
      const result = await transaction.execute(sql, values ?? [], { fullResult: true });
      return toMysqlLikeResult(result);
    },
    commit: async () => {
      if (!transaction) return;
      await transaction.commit();
      transaction = null;
    },
    rollback: async () => {
      if (!transaction) return;
      await transaction.rollback();
      transaction = null;
    },
    release: () => {
      transaction = null;
    }
  };
}

export const pool = {
  query: async (...args: Parameters<Pool["query"]>) => {
    if (!workerDatabaseEnv) return getLocalPool().query(...args);
    return executeServerless(args[0] as unknown as string, args[1] as unknown[] | undefined);
  },
  execute: async (...args: Parameters<Pool["execute"]>) => {
    if (!workerDatabaseEnv) return getLocalPool().execute(...args);
    return executeServerless(args[0] as unknown as string, args[1] as unknown[] | undefined);
  },
  getConnection: async () => {
    if (!workerDatabaseEnv) return getLocalPool().getConnection();
    return createServerlessTransactionalConnection();
  }
} as unknown as Pool;

export async function testDatabaseConnection() {
  const [rows] = await pool.query("SELECT 1 AS ok");
  return rows;
}
