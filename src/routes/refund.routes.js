import express from "express";
import {
  requestRefund,
  getRefundStatus,
  processRefund,
  getAllRefunds,
  getMyRefunds,
  getRefundsByAdmin,
  submitUPIDetails,
} from "../controllers/refund.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

// Admin routes
router.get("/admin", authMiddleware, checkRole(["admin", "superadmin"]), getRefundsByAdmin);
router.get("/admin/all", authMiddleware, checkRole(["admin", "superadmin"]), getAllRefunds);
router.post("/admin/process", authMiddleware, checkRole(["admin", "superadmin"]), processRefund);

// User routes
router.post("/request", authMiddleware, requestRefund);
router.get("/my", authMiddleware, getMyRefunds);
router.get("/:refundId", authMiddleware, getRefundStatus);
router.post("/:refundId/upi", authMiddleware, submitUPIDetails);

export default router;
