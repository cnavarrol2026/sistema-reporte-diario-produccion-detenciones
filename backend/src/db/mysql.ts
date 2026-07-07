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

export function configureWorkerDatabase(env: WorkerDatabaseEnv) {
  workerDatabaseEnv = env;
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

async function createWorkerConnection() {
  if (!workerDatabaseEnv) {
    throw new Error("La base de datos del Worker no esta configurada");
  }

  const connection = await mysql.createConnection({
    host: workerDatabaseEnv.host,
    user: workerDatabaseEnv.user,
    password: workerDatabaseEnv.password,
    database: workerDatabaseEnv.database,
    port: workerDatabaseEnv.port,
    namedPlaceholders: true,
    disableEval: true,
    ssl: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: false
    }
  });

  return Object.assign(connection, {
    release: () => {
      void connection.end();
    }
  });
}

async function withConnection<T>(callback: (connection: Awaited<ReturnType<typeof createWorkerConnection>>) => Promise<T>) {
  const connection = await createWorkerConnection();
  try {
    return await callback(connection);
  } finally {
    await connection.end();
  }
}

export const pool = {
  query: async (...args: Parameters<Pool["query"]>) => {
    if (!workerDatabaseEnv) return getLocalPool().query(...args);
    return withConnection((connection) => connection.query(...args));
  },
  execute: async (...args: Parameters<Pool["execute"]>) => {
    if (!workerDatabaseEnv) return getLocalPool().execute(...args);
    return withConnection((connection) => connection.execute(...args));
  },
  getConnection: async () => {
    if (!workerDatabaseEnv) return getLocalPool().getConnection();
    return createWorkerConnection();
  }
} as unknown as Pool;

export async function testDatabaseConnection() {
  const [rows] = await pool.query("SELECT 1 AS ok");
  return rows;
}
