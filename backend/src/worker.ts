import { URL } from "node:url";
import { configureWorkerDatabase } from "./db/mysql.js";
import { routeApi, type Method } from "./apiRouter.js";

type WorkerEnv = {
  DB_HOST?: string;
  DB_PORT?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
  FRONTEND_URL?: string;
};

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Expose-Headers": "Content-Disposition"
  };
}

function jsonResponse(payload: unknown, statusCode: number, origin?: string) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json"
    }
  });
}

function binaryResponse(body: Buffer, contentType: string, statusCode: number, origin?: string, filename?: string) {
  return new Response(new Uint8Array(body), {
    status: statusCode,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": contentType,
      "Content-Length": String(body.length),
      ...(filename ? { "Content-Disposition": `attachment; filename="${filename}"` } : {})
    }
  });
}

async function readBody(request: Request) {
  if (request.method === "GET" || request.method === "DELETE") return {};
  const raw = await request.text();
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

function normalizeApiUrl(request: Request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api")) {
    url.pathname = `/api${url.pathname.startsWith("/") ? "" : "/"}${url.pathname}`;
  }
  return url;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const origin = env.FRONTEND_URL ?? request.headers.get("Origin") ?? "*";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    try {
      if (!env.DB_HOST || !env.DB_USER || !env.DB_PASSWORD || !env.DB_NAME) {
        throw Object.assign(new Error("Faltan variables DB_HOST, DB_USER, DB_PASSWORD o DB_NAME en Cloudflare"), { statusCode: 500 });
      }

      configureWorkerDatabase({
        host: env.DB_HOST,
        port: Number(env.DB_PORT ?? 4000),
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME
      });

      const url = normalizeApiUrl(request);
      const body = await readBody(request);
      const result = await routeApi(request.method as Method, url, body);

      if ("body" in result) {
        return binaryResponse(result.body, result.contentType, result.statusCode, origin, result.filename);
      }

      return jsonResponse(result.payload, result.statusCode, origin);
    } catch (error) {
      const statusCode =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof (error as { statusCode?: unknown }).statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;

      return jsonResponse({
        status: "error",
        message: statusCode === 500 ? "Error interno del backend" : "Solicitud invalida",
        detail: error instanceof Error ? error.message : "Error desconocido"
      }, statusCode, origin);
    }
  }
};
