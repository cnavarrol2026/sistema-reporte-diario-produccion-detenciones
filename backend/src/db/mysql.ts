import mysql, { type Pool } from "mysql2/promise";

type HyperdriveBinding = {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
};

let localPool: Pool | null = null;
let hyperdriveBinding: HyperdriveBinding | null = null;

export function configureHyperdriveDatabase(binding: HyperdriveBinding) {
  hyperdriveBinding = binding;
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

async function createHyperdriveConnection() {
  if (!hyperdriveBinding) {
    throw new Error("Hyperdrive no esta configurado");
  }

  const connection = await mysql.createConnection({
    host: hyperdriveBinding.host,
    user: hyperdriveBinding.user,
    password: hyperdriveBinding.password,
    database: hyperdriveBinding.database,
    port: hyperdriveBinding.port,
    namedPlaceholders: true,
    disableEval: true
  });

  return Object.assign(connection, {
    release: () => {
      void connection.end();
    }
  });
}

async function withConnection<T>(callback: (connection: Awaited<ReturnType<typeof createHyperdriveConnection>>) => Promise<T>) {
  const connection = await createHyperdriveConnection();
  try {
    return await callback(connection);
  } finally {
    await connection.end();
  }
}

export const pool = {
  query: async (...args: Parameters<Pool["query"]>) => {
    if (!hyperdriveBinding) return getLocalPool().query(...args);
    return withConnection((connection) => connection.query(...args));
  },
  execute: async (...args: Parameters<Pool["execute"]>) => {
    if (!hyperdriveBinding) return getLocalPool().execute(...args);
    return withConnection((connection) => connection.execute(...args));
  },
  getConnection: async () => {
    if (!hyperdriveBinding) return getLocalPool().getConnection();
    return createHyperdriveConnection();
  }
} as unknown as Pool;

export async function testDatabaseConnection() {
  const [rows] = await pool.query("SELECT 1 AS ok");
  return rows;
}
