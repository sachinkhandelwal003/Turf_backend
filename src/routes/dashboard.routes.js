import express from "express";
import { getDashboardStats } from "../controllers/dashboard.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.get("/stats", authMiddleware, checkRole(["admin", "superadmin"]), getDashboardStats);

export default router;
