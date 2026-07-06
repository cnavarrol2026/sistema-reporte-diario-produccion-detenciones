import { Router } from "express";
import {
  createIndicadorController,
  createLineaController,
  createTurnoController,
  createTurnoHorarioController,
  deleteIndicadorController,
  deleteLineaController,
  deleteTurnoController,
  deleteTurnoHorarioController,
  listIndicadores,
  listLineas,
  listTurnoHorarios,
  listTurnos,
  updateIndicadorController,
  updateLineaController,
  updateTurnoController,
  updateTurnoHorarioController
} from "../controllers/configurationController.js";
import { asyncHandler } from "./asyncHandler.js";

export const configurationRoutes = Router();

configurationRoutes.get("/lineas", asyncHandler(listLineas));
configurationRoutes.post("/lineas", asyncHandler(createLineaController));
configurationRoutes.patch("/lineas/:id", asyncHandler(updateLineaController));
configurationRoutes.delete("/lineas/:id", asyncHandler(deleteLineaController));

configurationRoutes.get("/indicadores", asyncHandler(listIndicadores));
configurationRoutes.post("/indicadores", asyncHandler(createIndicadorController));
configurationRoutes.patch("/indicadores/:id", asyncHandler(updateIndicadorController));
configurationRoutes.delete("/indicadores/:id", asyncHandler(deleteIndicadorController));

configurationRoutes.get("/turnos", asyncHandler(listTurnos));
configurationRoutes.post("/turnos", asyncHandler(createTurnoController));
configurationRoutes.patch("/turnos/:id", asyncHandler(updateTurnoController));
configurationRoutes.delete("/turnos/:id", asyncHandler(deleteTurnoController));

configurationRoutes.get("/turno-horarios", asyncHandler(listTurnoHorarios));
configurationRoutes.post("/turno-horarios", asyncHandler(createTurnoHorarioController));
configurationRoutes.patch("/turno-horarios/:id", asyncHandler(updateTurnoHorarioController));
configurationRoutes.delete("/turno-horarios/:id", asyncHandler(deleteTurnoHorarioController));
