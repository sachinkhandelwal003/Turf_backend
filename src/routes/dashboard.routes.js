import express from "express";
import { getDashboardStats, getPublicStats, getAppHomeData } from "../controllers/dashboard.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.get("/stats", authMiddleware, checkRole(["admin", "superadmin"]), getDashboardStats);
router.get("/public-stats", getPublicStats);
router.get("/app-home", getAppHomeData);

export default router;
