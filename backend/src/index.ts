import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { configurationRoutes } from "./routes/configurationRoutes.js";
import { dashboardRoutes } from "./routes/dashboardRoutes.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { reporteRoutes } from "./routes/reporteRoutes.js";

const app = express();

app.use(
  cors({
    origin: env.frontendUrl
  })
);
app.use(express.json());

app.use("/api", healthRoutes);
app.use("/api", configurationRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", reporteRoutes);

function getErrorStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  ) {
    return (error as { statusCode: number }).statusCode;
  }

  return 500;
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const statusCode = getErrorStatusCode(error);

  response.status(statusCode).json({
    status: "error",
    message: statusCode === 500 ? "Error interno del backend" : "Solicitud invalida",
    detail: error instanceof Error ? error.message : "Error desconocido"
  });
});

app.listen(env.port, () => {
  console.log(`Backend escuchando en http://localhost:${env.port}`);
});
