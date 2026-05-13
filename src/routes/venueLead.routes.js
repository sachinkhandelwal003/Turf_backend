import express from "express";
import {
  createVenueLead,
  getVenueLeads,
  updateVenueLeadStatus,
} from "../controllers/venueLead.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

// Public route to submit a lead
router.post("/", upload.fields([{ name: "photos", maxCount: 5 }]), createVenueLead);

// Protected routes for admin/superadmin to manage leads
router.get("/", authMiddleware, checkRole(["admin", "superadmin"]), getVenueLeads);
router.patch("/:id/status", authMiddleware, checkRole(["admin", "superadmin"]), updateVenueLeadStatus);

export default router;
