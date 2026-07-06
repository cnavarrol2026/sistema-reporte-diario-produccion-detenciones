import { Router } from "express";
import { getDatabaseHealth, getHealth } from "../controllers/healthController.js";

export const healthRoutes = Router();

healthRoutes.get("/health", getHealth);
healthRoutes.get("/health/db", getDatabaseHealth);
