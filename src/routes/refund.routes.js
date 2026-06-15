import express from "express";
import {
  requestRefund,
  getRefundStatus,
  processRefund,
  getAllRefunds,
  getMyRefunds,
} from "../controllers/refund.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

// User routes
router.post("/request", authMiddleware, requestRefund);
router.get("/my", authMiddleware, getMyRefunds);
router.get("/:refundId", authMiddleware, getRefundStatus);

// Admin routes
router.get("/admin/all", authMiddleware, checkRole(["admin", "superadmin"]), getAllRefunds);
router.post("/admin/process", authMiddleware, checkRole(["admin", "superadmin"]), processRefund);

export default router;
