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
} from "../controllers/turf.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

import {
  checkPermission,
  checkRole,
} from "../middleware/rbac.middleware.js";

import { upload } from "../middleware/multer.middleware.js";

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
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "images", maxCount: 10 },
  ]),
  createTurf
);

router.put(
  "/:id",
  authMiddleware,
  checkPermission("edit_venue"),
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "images", maxCount: 10 },
  ]),
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
router.get("/", getTurfs);

router.get("/:id", getTurfById);

export default router;