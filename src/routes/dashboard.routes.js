import express from "express";
import { getDashboardStats, getPublicStats } from "../controllers/dashboard.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkPermission } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.get("/stats", authMiddleware, checkPermission("view_dashboard"), getDashboardStats);
router.get("/public-stats", getPublicStats);

export default router;
