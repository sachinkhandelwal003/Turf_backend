import express from "express";
import {
  createSupportTicket,
  getSupportTickets,
  resolveSupportTicket,
} from "../controllers/support.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.post("/", createSupportTicket);
router.get("/", authMiddleware, checkRole(["superadmin"]), getSupportTickets);
router.put("/:id/resolve", authMiddleware, checkRole(["superadmin"]), resolveSupportTicket);

export default router;
