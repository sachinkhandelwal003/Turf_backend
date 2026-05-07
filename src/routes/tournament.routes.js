import express from "express";
import { 
  createTournament, 
  getTournaments, 
  getTournamentById, 
  updateTournament, 
  deleteTournament,
  approveTournament,
  getMyTournaments
} from "../controllers/tournament.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkRole } from "../middleware/rbac.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getTournaments);
router.get("/:id", getTournamentById);

// Protected routes (Superadmin/Admin)
router.get("/my/all", authMiddleware, checkRole(["superadmin", "admin"]), getMyTournaments);
router.post("/", authMiddleware, checkRole(["superadmin", "admin"]), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 8 }]), createTournament);
router.put("/:id", authMiddleware, checkRole(["superadmin", "admin"]), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 8 }]), updateTournament);
router.delete("/:id", authMiddleware, checkRole(["superadmin", "admin"]), deleteTournament);

// Superadmin only routes
router.patch("/:id/approve", authMiddleware, checkRole(["superadmin"]), approveTournament);

export default router;
