import express from "express";
import { 
  createTurf, 
  getTurfs, 
  getTurfById, 
  updateTurf, 
  deleteTurf,
  getMyTurfs,
  updateTurfStatus
} from "../controllers/turf.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkPermission, checkRole } from "../middleware/rbac.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getTurfs);
router.get("/:id", getTurfById);

// Protected routes (Admin/Superadmin)
router.get("/my/all", authMiddleware, checkRole(["admin", "superadmin"]), getMyTurfs);
router.patch("/:id/status", authMiddleware, checkRole(["superadmin"]), updateTurfStatus);
router.post("/", authMiddleware, checkPermission("manage_turfs"), upload.array("images", 10), createTurf);
router.put("/:id", authMiddleware, checkPermission("manage_turfs"), upload.array("images", 10), updateTurf);
router.delete("/:id", authMiddleware, checkPermission("manage_turfs"), deleteTurf);

export default router;
