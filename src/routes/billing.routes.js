import express from "express";
import { getBillingStats } from "../controllers/billing.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { isSuperAdmin } from "../middleware/role.middleware.js";

const router = express.Router();

const isAnyAdmin = (req, res, next) => {
  if (req.user.role !== "superadmin" && req.user.role !== "admin") {
    return res.status(403).json({ msg: "Access denied" });
  }
  next();
};

// All billing routes are restricted to Admins and Super Admin
router.use(authMiddleware);
router.use(isAnyAdmin);

router.get("/stats", getBillingStats);

export default router;
