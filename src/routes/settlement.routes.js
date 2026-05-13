import express from "express";
import {
  createSettlement,
  getSettlements,
  updateSettlementStatus,
} from "../controllers/settlement.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.use(authMiddleware);
router.use(checkRole(["superadmin"])); // Only superadmin can manage settlements

router.post("/", createSettlement);
router.get("/", getSettlements);
router.patch("/:id", updateSettlementStatus);

export default router;
