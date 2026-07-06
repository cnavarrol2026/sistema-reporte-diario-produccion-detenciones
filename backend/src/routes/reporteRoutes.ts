import { Router } from "express";
import {
  createDetencionController,
  deleteDetencionController,
  listDetencionesController,
  updateDetencionController
} from "../controllers/detencionController.js";
import {
  downloadReportePdfController,
  finalizarReporteController,
  getInformeReporteController,
  getReporteActualController,
  getReporteResumenController,
  listReportesFinalizadosController,
  updateReporteController
} from "../controllers/reporteController.js";
import { asyncHandler } from "./asyncHandler.js";

export const reporteRoutes = Router();

reporteRoutes.get("/reportes/actual", asyncHandler(getReporteActualController));
reporteRoutes.get("/reportes/finalizados", asyncHandler(listReportesFinalizadosController));
reporteRoutes.get("/reportes", asyncHandler(listReportesFinalizadosController));
reporteRoutes.get("/reportes/:id/informe", asyncHandler(getInformeReporteController));
reporteRoutes.get("/reportes/:id/resumen", asyncHandler(getReporteResumenController));
reporteRoutes.get("/reportes/:id/pdf", asyncHandler(downloadReportePdfController));
reporteRoutes.post("/reportes/:id/finalizar", asyncHandler(finalizarReporteController));
reporteRoutes.patch("/reportes/:id", asyncHandler(updateReporteController));
reporteRoutes.get("/reportes/:id/detenciones", asyncHandler(listDetencionesController));
reporteRoutes.post("/reportes/:id/detenciones", asyncHandler(createDetencionController));
reporteRoutes.patch("/detenciones/:id", asyncHandler(updateDetencionController));
reporteRoutes.delete("/detenciones/:id", asyncHandler(deleteDetencionController));
