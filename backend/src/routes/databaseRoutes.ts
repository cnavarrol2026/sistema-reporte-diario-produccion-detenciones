import { Router } from "express";
import { downloadDatabaseBackupController } from "../controllers/databaseController.js";
import { asyncHandler } from "./asyncHandler.js";

export const databaseRoutes = Router();

databaseRoutes.get("/database/backup", asyncHandler(downloadDatabaseBackupController));
