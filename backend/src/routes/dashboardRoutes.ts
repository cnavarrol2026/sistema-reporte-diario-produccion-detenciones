import { Router } from "express";
import { getDashboardController } from "../controllers/dashboardController.js";
import { asyncHandler } from "./asyncHandler.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/dashboard", asyncHandler(getDashboardController));
