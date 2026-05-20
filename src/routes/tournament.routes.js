import express from "express";
import {
  createTournament, 
  getTournaments, 
  getTournamentById, 
  updateTournament, 
  deleteTournament,
  approveTournament,
  getMyTournaments,
  registerTournament,
  getMyRegistrations,
  getAllRegistrations,
  deleteRegistration
} from "../controllers/tournament.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { checkPermission } from "../middleware/rbac.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

// User routes
router.get("/registrations/my", authMiddleware, getMyRegistrations);
router.delete("/:tournamentId/registrations/:registrationId", authMiddleware, deleteRegistration);

// Protected routes (Superadmin/Admin)
router.get("/registrations/all", authMiddleware, checkPermission("manage_tournaments"), getAllRegistrations);
router.get("/my/all", authMiddleware, checkPermission("manage_tournaments"), getMyTournaments);
router.post("/:id/register", authMiddleware, registerTournament);
router.post("/", authMiddleware, checkPermission("manage_tournaments"), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 8 }]), createTournament);
router.put("/:id", authMiddleware, checkPermission("manage_tournaments"), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 8 }]), updateTournament);
router.delete("/:id", authMiddleware, checkPermission("manage_tournaments"), deleteTournament);

// Superadmin only routes
router.patch("/:id/approve", authMiddleware, checkPermission("approve_tournaments"), approveTournament);

// Public routes
router.get("/", getTournaments);
router.get("/:id", getTournamentById);

export default router;
