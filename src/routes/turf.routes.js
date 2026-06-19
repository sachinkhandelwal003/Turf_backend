import express from "express";

import {
  createTurf,
  getTurfs,
  getTurfById,
  updateTurf,
  deleteTurf,
  getMyTurfs,
  updateTurfStatus,
  getTurfAvailability,
  searchTurfsByName,
} from "../controllers/turf.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

import {
  checkPermission,
  checkRole,
} from "../middleware/rbac.middleware.js";

import { upload, processAndUploadImages } from "../middleware/upload.middleware.js";

const router = express.Router();


// ==============================
// PROTECTED ROUTES
// ==============================
router.get(
  "/my/all",
  authMiddleware,
  checkRole(["admin", "superadmin"]),
  getMyTurfs
);

router.patch(
  "/:id/status",
  authMiddleware,
  checkRole(["superadmin", "admin"]),
  updateTurfStatus
);

router.post(
  "/",
  authMiddleware,
  checkPermission("add_venue"),
  upload.any(), // Using any() to handle dynamic sport-specific image fields
  processAndUploadImages,
  createTurf
);

router.put(
  "/:id",
  authMiddleware,
  checkPermission("edit_venue"),
  upload.any(), // Using any() to handle dynamic sport-specific image fields
  processAndUploadImages,
  updateTurf
);

router.delete(
  "/:id",
  authMiddleware,
  checkPermission("manage_turfs"),
  deleteTurf
);


// ==============================
// REAL-TIME AVAILABILITY
// ==============================
router.get(
  "/:id/availability",
  getTurfAvailability
);


// ==============================
// PUBLIC ROUTES
// ==============================
router.get("/search", searchTurfsByName);

router.get("/", getTurfs);

router.get("/:id", getTurfById);

export default router;